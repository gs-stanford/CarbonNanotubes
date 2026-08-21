"""Optional publication-oriented Matplotlib helpers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .client import CPTClient


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


def scatter(
    client: "CPTClient",
    x: str,
    y: str,
    *,
    use_display_units: bool = True,
    log_x: bool = False,
    log_y: bool = False,
    colors: Mapping[str, str] | None = None,
    ax: Any = None,
    **filters: Any,
):
    """Plot paired records; the returned PlotResult retains every required citation."""
    try:
        import matplotlib.pyplot as plt
    except ImportError as error:
        raise ImportError("Install carbon-property-tables[plot] to use plotting helpers.") from error

    result = client.plot_data(x, y, **filters)
    palette = {**DEFAULT_COLORS, **dict(colors or {})}
    with plt.rc_context(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
            "font.size": 8,
            "axes.labelsize": 8,
            "xtick.labelsize": 7,
            "ytick.labelsize": 7,
            "legend.fontsize": 7,
            "axes.linewidth": 0.8,
            "xtick.direction": "out",
            "ytick.direction": "out",
            "svg.fonttype": "none",
        }
    ):
        if ax is None:
            _, ax = plt.subplots(figsize=(3.5, 3.0), constrained_layout=True)
        grouped: dict[str, list[Any]] = {}
        for point in result.points:
            grouped.setdefault(point.material_family, []).append(point)
        for family, points in sorted(grouped.items()):
            x_values = [point.x.display_value if use_display_units else point.x.value for point in points]
            y_values = [point.y.display_value if use_display_units else point.y.value for point in points]
            ax.scatter(
                x_values,
                y_values,
                s=24,
                color=palette.get(family, "#666666"),
                edgecolor="white",
                linewidth=0.45,
                label=family.replace("_", " "),
                zorder=3,
            )
        x_axis = result.axes.get("x", {})
        y_axis = result.axes.get("y", {})
        x_unit = x_axis.get("display_unit" if use_display_units else "canonical_unit", "")
        y_unit = y_axis.get("display_unit" if use_display_units else "canonical_unit", "")
        ax.set_xlabel(f"{x_axis.get('label', x)} ({x_unit})")
        ax.set_ylabel(f"{y_axis.get('label', y)} ({y_unit})")
        if log_x:
            ax.set_xscale("log")
        if log_y:
            ax.set_yscale("log")
        ax.spines[["top", "right"]].set_visible(False)
        ax.grid(True, which="major", color="#D9DEDA", linewidth=0.45, zorder=0)
        ax.legend(frameon=False, loc="best")
        return ax.figure, ax, result
