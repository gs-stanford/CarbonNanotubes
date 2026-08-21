"""End-to-end acceptance tour for the public Carbon Property Tables SDK."""

from __future__ import annotations

import argparse
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

from .client import CPTClient
from .convenience import resolve_property
from .exceptions import CPTValidationError
from .models import RenderedFigure, TemporaryPoint


MATERIAL_FAMILIES = (
    "carbon_fiber_comparator",
    "CNT_or_CNT_hybrid",
    "CNT_metal_composite",
    "graphene_or_GO_fiber",
)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _save_figure(figure: RenderedFigure, stem: Path) -> list[Path]:
    bundle = figure.save_bundle(stem)
    saved = list(bundle.values())
    _require(stem.with_suffix(".citations.txt").is_file(), f"Missing citation text for {stem.name}.")
    _require(stem.with_suffix(".bib").is_file(), f"Missing BibTeX for {stem.name}.")
    _require(stem.with_suffix(".manifest.json").is_file(), f"Missing reproducibility manifest for {stem.name}.")
    return saved


def _validate_image(path: Path) -> None:
    payload = path.read_bytes()
    if path.suffix == ".svg":
        _require(b"<svg" in payload[:500], f"Invalid SVG export: {path}")
    elif path.suffix == ".png":
        _require(payload.startswith(b"\x89PNG\r\n\x1a\n"), f"Invalid PNG export: {path}")
    elif path.suffix == ".pdf":
        _require(payload.startswith(b"%PDF"), f"Invalid PDF export: {path}")


def _expect_validation_error(label: str, operation: Callable[[], object]) -> str:
    try:
        operation()
    except CPTValidationError:
        return "passed"
    raise RuntimeError(f"Validation check did not fail as expected: {label}")


def run_feature_tour(client: CPTClient, output_dir: str | Path) -> dict[str, Any]:
    """Exercise every public SDK feature and write inspectable artifacts."""
    destination = Path(output_dir).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)

    release_payload = client.release()
    release = release_payload.get("release", {})
    properties = client.properties()
    _require(release_payload.get("api_version") == "v1", "Unexpected CPT API version.")
    _require(int(release.get("record_count", 0)) > 0, "The active release contains no records.")
    _require(bool(properties), "The API returned no supported properties.")
    known_doi = client.doi_status("10.1126/science.adj1082")
    _require(known_doi.in_database, "Known DOI was not found by the bounded DOI lookup.")
    _require(known_doi.title is not None, "Known DOI lookup omitted publication metadata.")
    _require(not client.has_doi("10.5555/cpt.definitely-absent"), "Absent DOI was reported as present.")

    property_aliases = {
        "specific strength": resolve_property("Specific Strength"),
        "specific cond": resolve_property("Specific cond"),
        "tenacity": resolve_property("tenacity"),
    }
    _require(
        property_aliases
        == {
            "specific strength": "specific_strength",
            "specific cond": "specific_electrical_conductivity",
            "tenacity": "specific_strength",
        },
        "Readable property-name resolution failed.",
    )

    figures = {
        "scatter": client.scatter(
            "specific_strength",
            "specific_electrical_conductivity",
            log_x=True,
            log_y=True,
            peer_reviewed=True,
            material_family=["CNT_or_CNT_hybrid", "CNT_metal_composite"],
            top=5,
            top_by="y",
            formats=("svg", "png", "pdf"),
            temporary=TemporaryPoint(1.8, 12.0, "My candidate CNT fiber"),
        ),
        "ranked": client.ranked(
            "density",
            "tensile_strength",
            peer_reviewed=True,
            material_family=MATERIAL_FAMILIES,
            top=5,
            top_by="y",
        ),
        "trend": client.trend(
            "density",
            "tensile_strength",
            peer_reviewed=True,
            material_family=MATERIAL_FAMILIES,
            top=5,
            top_by="y",
        ),
        "ashby": client.ashby(
            "density",
            "specific_strength",
            peer_reviewed=True,
            material_family=MATERIAL_FAMILIES,
            top=5,
            top_by="y",
        ),
    }

    artifact_paths: list[Path] = []
    figure_report: dict[str, Any] = {}
    for name, figure in figures.items():
        _require(figure.kind == name, f"Expected {name} response, received {figure.kind}.")
        _require(figure.point_count > 0, f"The {name} figure contains no points.")
        _require(bool(figure.citations.entries), f"The {name} figure contains no citations.")
        _require(len(figure.top_points) <= 5, f"The {name} response exceeded its top-row cap.")
        saved = _save_figure(figure, destination / name)
        for path in saved:
            _validate_image(path)
        artifact_paths.extend(saved)
        figure_report[name] = {
            "point_count": figure.point_count,
            "top_rows": len(figure.top_points),
            "citation_count": len(figure.citations.entries),
            "formats": list(figure.available_formats),
        }

    scatter = figures["scatter"]
    _require(scatter.temporary_point is not None, "Temporary-point ranking was not returned.")
    top_table_path = scatter.save_top_table(destination / "scatter-top-five.csv")
    top_citations_path = destination / "scatter-top-five.citations.txt"
    _require(top_table_path.is_file(), "Bounded top-table CSV was not written.")
    _require(top_citations_path.is_file(), "Bounded top-table citations were not written.")
    artifact_paths.extend((top_table_path, top_citations_path))

    validation_checks = {
        "top_row_cap": _expect_validation_error(
            "top row cap",
            lambda: client.scatter("density", "tensile_strength", top=11),
        ),
        "same_scatter_axes": _expect_validation_error(
            "same scatter axes",
            lambda: client.scatter("density", "density"),
        ),
        "unsupported_export": _expect_validation_error(
            "unsupported export",
            lambda: client.scatter("density", "tensile_strength", formats=("csv",)),
        ),
        "reserved_filter": _expect_validation_error(
            "reserved filter",
            lambda: client.scatter("density", "tensile_strength", limit=5),
        ),
    }

    report = {
        "status": "passed",
        "api_url": client.base_url,
        "release": {
            "release_id": release.get("release_id"),
            "backend": release.get("backend"),
            "record_count": release.get("record_count"),
            "measurement_count": release.get("measurement_count"),
            "publication_count": release.get("publication_count"),
        },
        "property_count": len(properties),
        "property_aliases": property_aliases,
        "doi_lookup": {
            "query_doi": known_doi.query_doi,
            "in_database": known_doi.in_database,
            "title": known_doi.title,
        },
        "figures": figure_report,
        "temporary_point": {
            "label": scatter.temporary_point.label,
            "x_rank": scatter.temporary_point.x_rank,
            "y_rank": scatter.temporary_point.y_rank,
            "on_pareto_frontier": scatter.temporary_point.on_pareto_frontier,
        },
        "validation_checks": validation_checks,
        "artifacts": sorted(path.name for path in artifact_paths),
    }
    report_path = destination / "feature-tour-report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Exercise every public Carbon Property Tables SDK feature against a live API."
    )
    parser.add_argument(
        "--api-url",
        default=None,
        help="CPT deployment URL. Defaults to the production service or CPT_API_URL.",
    )
    parser.add_argument(
        "--output-dir",
        default="cpt-feature-tour-output",
        help="Directory for figures, bounded tables, citations, and the JSON report.",
    )
    parser.add_argument("--timeout", type=float, default=90.0, help="Per-request timeout in seconds.")
    args = parser.parse_args()

    report = run_feature_tour(CPTClient(args.api_url, timeout=args.timeout), args.output_dir)
    print(json.dumps(report, indent=2, sort_keys=True))
    print(f"\nCPT feature tour passed. Artifacts: {Path(args.output_dir).expanduser().resolve()}")


if __name__ == "__main__":
    main()
