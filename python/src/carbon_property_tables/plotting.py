"""Publication-oriented rendering with intentionally bounded data extraction."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from io import BytesIO
import math
import re
from typing import Any

from .exceptions import CPTValidationError
from .models import (
    CitationBundle,
    PlotPoint,
    RenderedFigure,
    TemporaryPoint,
    TemporaryPointRank,
    TopPoint,
)


MAX_TOP_POINTS = 10
MAX_RANKED_POINTS = 25

PERFORMANCE_PROPERTIES = {
    "ampacity",
    "breaking_strain",
    "electrical_conductivity",
    "initial_modulus",
    "specific_electrical_conductivity",
    "specific_modulus",
    "specific_strength",
    "specific_thermal_conductivity",
    "tensile_strength",
    "thermal_conductivity",
    "toughness",
    "work_of_rupture",
    "youngs_modulus",
}

DEFAULT_COLORS = {
    "CNT_or_CNT_hybrid": "#0072B2",
    "CNT_metal_composite": "#D55E00",
    "graphene_or_GO_fiber": "#009E73",
    "carbon_fiber_comparator": "#4D4D4D",
    "other_carbon_comparator": "#7A7A7A",
    "polymer_fiber_comparator": "#E69F00",
    "metal_comparator": "#CC79A7",
    "ceramic_or_glass_comparator": "#56B4E9",
}

FAMILY_LABELS = {
    "CNT_or_CNT_hybrid": "CNT",
    "CNT_metal_composite": "CNT-metal composite",
    "graphene_or_GO_fiber": "Graphene / graphite",
    "carbon_fiber_comparator": "Carbon fiber",
    "other_carbon_comparator": "Other carbon",
    "polymer_fiber_comparator": "Polymer",
    "metal_comparator": "Metal",
    "ceramic_or_glass_comparator": "Ceramic / glass",
}

DEFAULT_MARKERS = {
    "fiber_yarn": "o",
    "sheet_mat_film": "v",
    "forest_array": "^",
    "individual_nanotube_or_bundle": "D",
    "buckypaper": "s",
}

FORM_LABELS = {
    "fiber_yarn": "Fiber / yarn",
    "sheet_mat_film": "Sheet / mat / film",
    "forest_array": "Forest / array",
    "individual_nanotube_or_bundle": "Individual tube / bundle",
    "buckypaper": "Buckypaper",
}


def _clean_group_part(value: object, fallback: str = "unspecified") -> str:
    clean = re.sub(r"[^a-z0-9]+", "_", str(value or "").lower()).strip("_")
    return clean or fallback


def _publication_key(point: PlotPoint) -> str:
    doi = str(point.publication.get("doi") or "").strip().lower()
    if doi:
        return f"doi:{doi}"
    return "|".join(
        [
            "publication",
            _clean_group_part(point.publication.get("title")),
            _clean_group_part(point.publication.get("authors_short")),
            str(point.publication.get("year") or "n.d."),
        ]
    )


def _group_key(point: PlotPoint) -> str:
    return "|".join(
        [
            _publication_key(point),
            point.material_family,
            point.form_factor,
            _clean_group_part(point.cnt_type),
        ]
    )


def _axis_value(point: PlotPoint, axis: str) -> float:
    measurement = point.x if axis == "x" else point.y
    return measurement.display_value


def _priority_axes(x_property: str, y_property: str) -> tuple[str, ...]:
    axes = []
    if y_property in PERFORMANCE_PROPERTIES:
        axes.append("y")
    if x_property in PERFORMANCE_PROPERTIES:
        axes.append("x")
    return tuple(axes or ["y", "x"])


def _compare_key(point: PlotPoint, x_property: str, y_property: str) -> tuple[Any, ...]:
    priorities = tuple(-_axis_value(point, axis) for axis in _priority_axes(x_property, y_property))
    year = point.publication.get("year")
    year_value = float(year) if isinstance(year, (int, float)) else 0.0
    return (*priorities, -year_value, point.record_id)


def _dominates(candidate: PlotPoint, target: PlotPoint, axes: Sequence[str]) -> bool:
    strictly_better = False
    for axis in axes:
        candidate_value = _axis_value(candidate, axis)
        target_value = _axis_value(target, axis)
        tolerance = max(abs(candidate_value), abs(target_value), 1.0) * 1e-9
        if candidate_value + tolerance < target_value:
            return False
        if candidate_value > target_value + tolerance:
            strictly_better = True
    return strictly_better


def representative_points(
    points: Sequence[PlotPoint], x_property: str, y_property: str, kind: str
) -> tuple[PlotPoint, ...]:
    """Apply the Atlas one-publication/material/form/type representative rule."""
    groups: dict[str, list[PlotPoint]] = defaultdict(list)
    for point in points:
        groups[_group_key(point)].append(point)

    performance_axes = tuple(
        axis
        for axis, property_name in (("x", x_property), ("y", y_property))
        if property_name in PERFORMANCE_PROPERTIES
    )
    retained: list[PlotPoint] = []
    for group in groups.values():
        if kind in {"scatter", "ashby"} and len(performance_axes) == 2:
            frontier = [
                point
                for point in group
                if not any(other.record_id != point.record_id and _dominates(other, point, performance_axes) for other in group)
            ]
            retained.extend(sorted(frontier, key=lambda point: _compare_key(point, x_property, y_property)))
        else:
            retained.append(min(group, key=lambda point: _compare_key(point, x_property, y_property)))
    return tuple(sorted(retained, key=lambda point: (point.material_family, _compare_key(point, x_property, y_property))))


def _top_axis(top_by: str, x_property: str, y_property: str) -> str:
    if top_by == "auto":
        if y_property in PERFORMANCE_PROPERTIES:
            return "y"
        if x_property in PERFORMANCE_PROPERTIES:
            return "x"
        raise CPTValidationError("Top-point extraction requires at least one performance property.")
    if top_by not in {"x", "y"}:
        raise CPTValidationError("top_by must be 'auto', 'x', or 'y'.")
    property_name = x_property if top_by == "x" else y_property
    if property_name not in PERFORMANCE_PROPERTIES:
        raise CPTValidationError(f"{property_name} is not a higher-is-better performance property.")
    return top_by


def _citation_for_record(citations: CitationBundle, record_id: str) -> str:
    texts = [
        entry.text
        for entry in citations.entries
        if record_id in entry.record_ids and ({"original", "compilation"}.intersection(entry.roles))
    ]
    return " | ".join(dict.fromkeys(texts))


def _top_points(
    points: Sequence[PlotPoint],
    citations: CitationBundle,
    *,
    top: int,
    top_by: str,
    x_property: str,
    y_property: str,
) -> tuple[TopPoint, ...]:
    ranked = _ranked_plot_points(
        points,
        top=top,
        top_by=top_by,
        x_property=x_property,
        y_property=y_property,
    )
    rows = []
    for rank, point in enumerate(ranked, start=1):
        year = point.publication.get("year")
        rows.append(
            TopPoint(
                rank=rank,
                label=point.label,
                material_family=FAMILY_LABELS.get(point.material_family, point.material_family.replace("_", " ")),
                form_factor=FORM_LABELS.get(point.form_factor, point.form_factor.replace("_", " ")),
                x_value=point.x.display_value,
                x_unit=point.x.display_unit,
                y_value=point.y.display_value,
                y_unit=point.y.display_unit,
                doi=str(point.publication.get("doi")) if point.publication.get("doi") else None,
                publication_title=str(point.publication.get("title")) if point.publication.get("title") else None,
                publication_year=int(year) if isinstance(year, (int, float)) else None,
                citation=_citation_for_record(citations, point.record_id),
            )
        )
    return tuple(rows)


def _ranked_plot_points(
    points: Sequence[PlotPoint],
    *,
    top: int,
    top_by: str,
    x_property: str,
    y_property: str,
) -> tuple[PlotPoint, ...]:
    if not isinstance(top, int) or not 0 <= top <= MAX_TOP_POINTS:
        raise CPTValidationError(f"top must be an integer from 0 to {MAX_TOP_POINTS}.")
    if top == 0:
        return ()
    axis = _top_axis(top_by, x_property, y_property)
    return tuple(sorted(points, key=lambda point: (-_axis_value(point, axis), point.record_id))[:top])


def _rank(values: Sequence[float], temporary: float) -> tuple[int, float]:
    rank = 1 + sum(value > temporary for value in values)
    total = len(values) + 1
    percentile = 100.0 if total == 1 else 100.0 * (total - rank) / (total - 1)
    return rank, percentile


def _temporary_rank(
    points: Sequence[PlotPoint], temporary: TemporaryPoint | None, x_property: str, y_property: str
) -> TemporaryPointRank | None:
    if temporary is None:
        return None
    if not math.isfinite(temporary.x) or not math.isfinite(temporary.y):
        raise CPTValidationError("Temporary-point coordinates must be finite numbers.")
    x_rank = x_percentile = y_rank = y_percentile = None
    if x_property in PERFORMANCE_PROPERTIES:
        x_rank, x_percentile = _rank([point.x.display_value for point in points], temporary.x)
    if y_property in PERFORMANCE_PROPERTIES:
        y_rank, y_percentile = _rank([point.y.display_value for point in points], temporary.y)

    dominated_by = on_frontier = None
    if x_property in PERFORMANCE_PROPERTIES and y_property in PERFORMANCE_PROPERTIES:
        tolerance_x = max(abs(temporary.x), 1.0) * 1e-9
        tolerance_y = max(abs(temporary.y), 1.0) * 1e-9
        dominated_by = sum(
            point.x.display_value + tolerance_x >= temporary.x
            and point.y.display_value + tolerance_y >= temporary.y
            and (point.x.display_value > temporary.x + tolerance_x or point.y.display_value > temporary.y + tolerance_y)
            for point in points
        )
        on_frontier = dominated_by == 0

    return TemporaryPointRank(
        label=temporary.label.strip() or "User input",
        x=temporary.x,
        y=temporary.y,
        total_with_temporary=len(points) + 1,
        x_rank=x_rank,
        y_rank=y_rank,
        x_percentile=x_percentile,
        y_percentile=y_percentile,
        dominated_by=dominated_by,
        on_pareto_frontier=on_frontier,
    )


def _source_label(point: PlotPoint) -> str:
    authors = str(point.publication.get("authors_short") or "").strip()
    year = point.publication.get("year")
    if authors and year:
        return f"{authors} {int(year) if isinstance(year, (int, float)) else year}"
    if authors:
        return authors
    if year:
        return str(year)
    return point.label


def _format_unit(unit: str) -> str:
    """Render ASCII exponent notation as publication-style math text."""
    superscript_map = str.maketrans("⁻⁰¹²³⁴⁵⁶⁷⁸⁹", "-0123456789")
    normalized = re.sub(
        r"[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+",
        lambda match: f"$^{{{match.group(0).translate(superscript_map)}}}$",
        unit,
    )
    return re.sub(r"\^(-?\d+)", lambda match: f"$^{{{match.group(1)}}}$", normalized)


def _principal_frame(values: Any) -> tuple[Any, Any, Any]:
    import numpy as np

    center = values.mean(axis=0)
    centered = values - center
    if len(values) == 2:
        direction = values[1] - values[0]
    else:
        covariance = np.cov(centered, rowvar=False)
        eigenvalues, eigenvectors = np.linalg.eigh(covariance)
        direction = eigenvectors[:, int(np.argmax(eigenvalues))]
    norm = float(np.linalg.norm(direction))
    if not math.isfinite(norm) or norm < 1e-12:
        direction = np.array([1.0, 0.0])
    else:
        direction = direction / norm
    normal = np.array([-direction[1], direction[0]])
    return center, direction, normal


def _robust_region_core(values: Any) -> Any:
    import numpy as np

    if len(values) <= 4:
        return values
    core = values
    for _ in range(2):
        center, _, normal = _principal_frame(core)
        residuals = np.abs((values - center) @ normal)
        median_residual = float(np.median(residuals))
        mad = float(np.median(np.abs(residuals - median_residual))) * 1.4826
        cutoff = max(float(np.quantile(residuals, 0.80)), median_residual + 2.6 * mad, 0.018)
        order = np.argsort(residuals)
        retained = values[residuals <= cutoff]
        minimum = min(len(values), 5)
        core = retained if len(retained) >= minimum else values[order[:minimum]]
    return core


def _ashby_region(values: Any) -> Any | None:
    import numpy as np

    if len(values) < 2:
        return None
    core = _robust_region_core(values)
    center, direction, normal = _principal_frame(core)
    projected = core - center
    longitudinal = projected @ direction
    transverse = projected @ normal
    if len(core) <= 4:
        lower = float(longitudinal.min())
        upper = float(longitudinal.max())
    else:
        lower, upper = (float(value) for value in np.quantile(longitudinal, [0.02, 0.98]))
    if upper - lower < 0.035:
        midpoint = (lower + upper) / 2
        lower, upper = midpoint - 0.0175, midpoint + 0.0175

    transverse_center = float(np.median(transverse))
    residuals = np.abs(transverse - transverse_center)
    spread_quantile = 1.0 if len(core) <= 4 else 0.86
    robust_spread = float(np.quantile(residuals, spread_quantile))
    minimum_width = 0.036 if len(core) <= 4 else 0.045
    maximum_width = 0.10 if len(core) <= 4 else 0.14
    half_width = min(max(robust_spread * 1.35 + 0.022, minimum_width), maximum_width)
    end_padding = min(max(half_width * 0.62, 0.018), 0.065)
    lower -= end_padding
    upper += end_padding

    midpoint = (lower + upper) / 2
    half_length = max((upper - lower) / 2, 0.025)
    end_width = min(max(half_width * (0.46 if len(core) <= 4 else 0.32), 0.014), half_width * 0.70)
    edge = []
    for side in (1.0, -1.0):
        points = []
        progress_values = np.linspace(-1.0, 1.0, 20)
        if side < 0:
            progress_values = progress_values[::-1]
        for progress in progress_values:
            taper = math.sqrt(max(0.0, 1.0 - float(progress) ** 2))
            width = end_width + (half_width - end_width) * taper**0.78
            longitudinal_value = midpoint + float(progress) * half_length
            point = center + direction * longitudinal_value + normal * (transverse_center + side * width)
            points.append(np.clip(point, 0.005, 0.995))
        edge.extend(points)
    return np.asarray(edge)


def _draw_ashby_regions(axis: Any, points: Sequence[PlotPoint], palette: Mapping[str, str]) -> list[Any]:
    import numpy as np

    x_logs = np.asarray([math.log10(point.x.display_value) for point in points])
    y_logs = np.asarray([math.log10(point.y.display_value) for point in points])
    x_min, x_max = float(x_logs.min()), float(x_logs.max())
    y_min, y_max = float(y_logs.min()), float(y_logs.max())
    x_span = max(x_max - x_min, 1.0)
    y_span = max(y_max - y_min, 1.0)
    x_min -= x_span * 0.04
    x_max += x_span * 0.04
    y_min -= y_span * 0.04
    y_max += y_span * 0.04
    x_span = x_max - x_min
    y_span = y_max - y_min

    families: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for point in points:
        families[point.material_family].append(
            (
                (math.log10(point.x.display_value) - x_min) / x_span,
                (math.log10(point.y.display_value) - y_min) / y_span,
            )
        )

    labels = []
    for family, family_values in sorted(families.items()):
        normalized_region = _ashby_region(np.asarray(family_values, dtype=float))
        if normalized_region is None:
            continue
        x_values = 10 ** (x_min + normalized_region[:, 0] * x_span)
        y_values = 10 ** (y_min + normalized_region[:, 1] * y_span)
        color = palette.get(family, "#666666")
        axis.fill(
            x_values,
            y_values,
            facecolor=color,
            edgecolor=color,
            alpha=0.11,
            linewidth=0.75,
            zorder=1,
        )
        label_x = 10 ** (x_min + float(np.median(normalized_region[:, 0])) * x_span)
        label_y = 10 ** (y_min + float(np.quantile(normalized_region[:, 1], 0.82)) * y_span)
        labels.append(
            axis.text(
                label_x,
                label_y,
                FAMILY_LABELS.get(family, family.replace("_", " ")),
                color=color,
                fontsize=7,
                fontweight="bold",
                ha="center",
                va="center",
                bbox={"boxstyle": "square,pad=0.12", "facecolor": "white", "edgecolor": "none", "alpha": 0.72},
                zorder=4,
            )
        )
    return labels


def _render_images(
    points: Sequence[PlotPoint],
    *,
    kind: str,
    temporary: TemporaryPoint | None,
    annotation_points: Sequence[PlotPoint],
    log_x: bool,
    log_y: bool,
    colors: Mapping[str, str] | None,
) -> Mapping[str, bytes]:
    try:
        import matplotlib.pyplot as plt
        from adjustText import adjust_text
        from matplotlib.lines import Line2D
    except ImportError as error:
        raise ImportError("Install carbon-property-tables to use figure rendering.") from error

    if (kind == "ashby" or log_x) and any(point.x.display_value <= 0 for point in points):
        raise CPTValidationError("Every x value must be positive on a logarithmic figure.")
    if (kind == "ashby" or log_y) and any(point.y.display_value <= 0 for point in points):
        raise CPTValidationError("Every y value must be positive on a logarithmic figure.")

    palette = {**DEFAULT_COLORS, **dict(colors or {})}
    x_label = points[0].x.property_label
    y_label = points[0].y.property_label
    x_unit = points[0].x.display_unit
    y_unit = points[0].y.display_unit

    with plt.rc_context(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
            "font.size": 8,
            "axes.labelsize": 8,
            "axes.linewidth": 0.8,
            "xtick.labelsize": 7,
            "ytick.labelsize": 7,
            "legend.fontsize": 7,
            "xtick.direction": "out",
            "ytick.direction": "out",
            "pdf.fonttype": 42,
            "ps.fonttype": 42,
            "svg.fonttype": "none",
        }
    ):
        if kind == "ranked":
            figure, axis = plt.subplots(figsize=(7.1, 4.8), constrained_layout=True)
            displayed = sorted(points, key=lambda point: (-point.y.display_value, point.record_id))[:MAX_RANKED_POINTS]
            y_positions = list(range(len(displayed)))[::-1]
            for position, point in zip(y_positions, displayed):
                axis.hlines(position, 0, point.y.display_value, color="#C8CECA", linewidth=0.7, zorder=1)
                axis.scatter(
                    point.y.display_value,
                    position,
                    s=32,
                    marker=DEFAULT_MARKERS.get(point.form_factor, "o"),
                    color=palette.get(point.material_family, "#666666"),
                    edgecolor="#202622",
                    linewidth=0.45,
                    zorder=3,
                )
            axis.set_yticks(y_positions, [_source_label(point) for point in displayed])
            axis.set_xlabel(f"{y_label} ({_format_unit(y_unit)})")
            axis.set_ylabel("")
            axis.spines[["top", "right", "left"]].set_visible(False)
            axis.grid(True, axis="x", color="#D9DEDA", linewidth=0.45, zorder=0)
            axis.tick_params(axis="y", length=0)
            if log_y:
                axis.set_xscale("log")
            if temporary is not None:
                if log_y and temporary.y <= 0:
                    raise CPTValidationError("Temporary y must be positive on a logarithmic ranked plot.")
                axis.axvline(temporary.y, color="#151A17", linewidth=1.0, linestyle=(0, (4, 3)), zorder=2)
                axis.text(temporary.y, 1.01, temporary.label, transform=axis.get_xaxis_transform(), ha="center", va="bottom", fontweight="bold")
        else:
            figure, axis = plt.subplots(figsize=(7.1, 4.8), constrained_layout=True)
            grouped: dict[tuple[str, str], list[PlotPoint]] = defaultdict(list)
            for point in points:
                grouped[(point.material_family, point.form_factor)].append(point)
            for (family, form_factor), group in sorted(grouped.items()):
                axis.scatter(
                    [point.x.display_value for point in group],
                    [point.y.display_value for point in group],
                    s=34,
                    marker=DEFAULT_MARKERS.get(form_factor, "o"),
                    color=palette.get(family, "#666666"),
                    edgecolor="#202622",
                    linewidth=0.45,
                    alpha=0.94,
                    zorder=3,
                )
            axis.set_xlabel(f"{x_label} ({_format_unit(x_unit)})")
            axis.set_ylabel(f"{y_label} ({_format_unit(y_unit)})")
            if kind == "ashby":
                log_x = log_y = True
            if log_x:
                axis.set_xscale("log")
            if log_y:
                axis.set_yscale("log")
            axis.spines[["top", "right"]].set_visible(False)
            axis.grid(True, which="major", color="#D9DEDA", linewidth=0.45, zorder=0)
            axis.grid(True, which="minor", color="#E7EAE7", linewidth=0.3, linestyle=(0, (2, 4)), zorder=0)
            fixed_labels = _draw_ashby_regions(axis, points, palette) if kind == "ashby" else []
            if fixed_labels:
                adjust_text(
                    fixed_labels,
                    x=[point.x.display_value for point in points],
                    y=[point.y.display_value for point in points],
                    ax=axis,
                    ensure_inside_axes=True,
                    expand=(1.08, 1.18),
                    force_text=(0.24, 0.42),
                    force_static=(0.04, 0.08),
                    force_pull=(0.025, 0.035),
                )
            moving_labels = [
                axis.text(
                    point.x.display_value,
                    point.y.display_value,
                    _source_label(point),
                    fontsize=7,
                    fontweight="bold",
                    ha="center",
                    va="center",
                    zorder=6,
                )
                for point in annotation_points
            ]
            target_x = [point.x.display_value for point in annotation_points]
            target_y = [point.y.display_value for point in annotation_points]
            if temporary is not None:
                if log_x and temporary.x <= 0:
                    raise CPTValidationError("Temporary x must be positive on a logarithmic plot.")
                if log_y and temporary.y <= 0:
                    raise CPTValidationError("Temporary y must be positive on a logarithmic plot.")
                axis.scatter(
                    [temporary.x],
                    [temporary.y],
                    marker="*",
                    s=120,
                    color="#151A17",
                    edgecolor="white",
                    linewidth=0.8,
                    zorder=7,
                )
                moving_labels.append(
                    axis.text(
                        temporary.x,
                        temporary.y,
                        temporary.label,
                        fontsize=7.5,
                        fontweight="bold",
                        ha="center",
                        va="center",
                        color="#151A17",
                        zorder=8,
                    )
                )
                target_x.append(temporary.x)
                target_y.append(temporary.y)
            if moving_labels:
                adjust_text(
                    moving_labels,
                    x=[point.x.display_value for point in points],
                    y=[point.y.display_value for point in points],
                    target_x=target_x,
                    target_y=target_y,
                    objects=fixed_labels or None,
                    ax=axis,
                    prevent_crossings=True,
                    ensure_inside_axes=True,
                    expand=(1.10, 1.24),
                    force_text=(0.38, 0.55),
                    force_static=(0.12, 0.22),
                    force_pull=(0.015, 0.025),
                    min_arrow_len=4,
                    arrowprops={"arrowstyle": "-", "color": "#8A918B", "linewidth": 0.55},
                )

        active_families = sorted({point.material_family for point in points})
        active_forms = sorted({point.form_factor for point in points})
        family_handles = [
            Line2D(
                [0],
                [0],
                marker="o",
                linestyle="none",
                markersize=5.5,
                markerfacecolor=palette.get(family, "#666666"),
                markeredgecolor="none",
                label=FAMILY_LABELS.get(family, family.replace("_", " ")),
            )
            for family in active_families
        ]
        form_handles = [
            Line2D(
                [0],
                [0],
                marker=DEFAULT_MARKERS.get(form, "o"),
                linestyle="none",
                markersize=5.5,
                markerfacecolor="#6A716C",
                markeredgecolor="none",
                label=FORM_LABELS.get(form, form.replace("_", " ")),
            )
            for form in active_forms
        ]
        family_legend = axis.legend(
            handles=family_handles,
            frameon=False,
            title="Material",
            title_fontsize=7,
            loc="lower left",
            bbox_to_anchor=(0.0, 1.02),
            ncol=min(4, max(1, len(family_handles))),
            handletextpad=0.35,
            columnspacing=0.9,
        )
        family_legend.get_title().set_fontweight("bold")
        family_legend.set_in_layout(True)
        axis.add_artist(family_legend)
        form_legend = axis.legend(
            handles=form_handles,
            frameon=False,
            title="Form",
            title_fontsize=7,
            loc="lower right",
            bbox_to_anchor=(1.0, 1.02),
            ncol=min(4, max(1, len(form_handles))),
            handletextpad=0.35,
            columnspacing=0.9,
        )
        form_legend.get_title().set_fontweight("bold")
        form_legend.set_in_layout(True)
        figure.text(
            0.995,
            0.002,
            "Carbon Property Tables | cite original sources and the Atlas",
            ha="right",
            va="bottom",
            fontsize=5.8,
            color="#A5AAA6",
        )

        images: dict[str, bytes] = {}
        for format_name, dpi in (("svg", 300), ("pdf", 300), ("png", 600)):
            buffer = BytesIO()
            figure.savefig(buffer, format=format_name, dpi=dpi, bbox_inches="tight", facecolor="white")
            images[format_name] = buffer.getvalue()
        plt.close(figure)
        return images


def render_figure(
    points: Sequence[PlotPoint],
    citations: CitationBundle,
    *,
    kind: str,
    x_property: str,
    y_property: str,
    top: int = 0,
    top_by: str = "auto",
    temporary: TemporaryPoint | None = None,
    log_x: bool = False,
    log_y: bool = False,
    colors: Mapping[str, str] | None = None,
    release: Mapping[str, Any] | None = None,
    points_are_representative: bool = False,
) -> RenderedFigure:
    if kind not in {"scatter", "ranked", "ashby"}:
        raise CPTValidationError("kind must be 'scatter', 'ranked', or 'ashby'.")
    if not points:
        raise CPTValidationError("No verified records match the requested figure.")
    selected = tuple(points) if points_are_representative else representative_points(points, x_property, y_property, kind)
    top_rows = _top_points(
        selected,
        citations,
        top=top,
        top_by=top_by,
        x_property=x_property,
        y_property=y_property,
    )
    annotation_points = _ranked_plot_points(
        selected,
        top=min(top, 3),
        top_by=top_by,
        x_property=x_property,
        y_property=y_property,
    )
    temporary_rank = _temporary_rank(selected, temporary, x_property, y_property)
    images = _render_images(
        selected,
        kind=kind,
        temporary=temporary,
        annotation_points=annotation_points,
        log_x=log_x,
        log_y=log_y,
        colors=colors,
    )
    return RenderedFigure(
        kind=kind,
        x_property=x_property,
        y_property=y_property,
        point_count=len(selected),
        top_points=top_rows,
        citations=citations,
        temporary_point=temporary_rank,
        release=dict(release or {}),
        _images=images,
    )
