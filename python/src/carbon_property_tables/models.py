"""Typed response objects for the Carbon Property Tables API."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping


@dataclass(frozen=True)
class CitationEntry:
    citation_id: str
    roles: tuple[str, ...]
    doi: str | None
    text: str
    bibtex: str
    record_ids: tuple[str, ...]

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "CitationEntry":
        return cls(
            citation_id=str(value.get("citation_id", "")),
            roles=tuple(str(item) for item in value.get("roles", [])),
            doi=str(value["doi"]) if value.get("doi") else None,
            text=str(value.get("text", "")),
            bibtex=str(value.get("bibtex", "")),
            record_ids=tuple(str(item) for item in value.get("record_ids", [])),
        )


@dataclass(frozen=True)
class CitationBundle:
    requirement: str
    style: str
    entries: tuple[CitationEntry, ...]
    copy_all: str
    bibtex: str

    @classmethod
    def from_dict(cls, value: Mapping[str, Any] | None) -> "CitationBundle":
        data = value or {}
        return cls(
            requirement=str(data.get("requirement", "")),
            style=str(data.get("style", "nature")),
            entries=tuple(CitationEntry.from_dict(item) for item in data.get("entries", [])),
            copy_all=str(data.get("copy_all", "")),
            bibtex=str(data.get("bibtex", "")),
        )


@dataclass(frozen=True)
class Measurement:
    measurement_id: str
    property: str
    property_label: str
    value: float
    unit: str
    display_value: float
    display_unit: str
    warning: str
    eligibility: Mapping[str, bool] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "Measurement":
        return cls(
            measurement_id=str(value.get("measurement_id", "")),
            property=str(value.get("property", "")),
            property_label=str(value.get("property_label", value.get("property", ""))),
            value=float(value["value"]),
            unit=str(value.get("unit", "")),
            display_value=float(value.get("display_value", value["value"])),
            display_unit=str(value.get("display_unit", value.get("unit", ""))),
            warning=str(value.get("warning", "none")),
            eligibility=dict(value.get("eligibility", {})),
        )


@dataclass(frozen=True)
class Record:
    record_id: str
    label: str
    sample: Mapping[str, Any]
    publication: Mapping[str, Any]
    measurements: tuple[Measurement, ...]
    conditions: Mapping[str, Any]
    provenance: Mapping[str, Any]
    comparison: Mapping[str, Any]
    source_class: Mapping[str, Any]
    quality_flags: Mapping[str, Any]
    citations: CitationBundle
    raw: Mapping[str, Any] = field(repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "Record":
        return cls(
            record_id=str(value.get("record_id", "")),
            label=str(value.get("label", "")),
            sample=dict(value.get("sample", {})),
            publication=dict(value.get("publication", {})),
            measurements=tuple(Measurement.from_dict(item) for item in value.get("measurements", [])),
            conditions=dict(value.get("conditions", {})),
            provenance=dict(value.get("provenance", {})),
            comparison=dict(value.get("comparison", {})),
            source_class=dict(value.get("source_class", {})),
            quality_flags=dict(value.get("quality_flags", {})),
            citations=CitationBundle.from_dict(value.get("citations")),
            raw=dict(value),
        )

    def measurement(self, property_key: str) -> Measurement | None:
        """Return one canonical measurement by property key."""
        return next((item for item in self.measurements if item.property == property_key), None)


@dataclass(frozen=True)
class RecordPage:
    records: tuple[Record, ...]
    next_cursor: str | None
    has_more: bool
    release: Mapping[str, Any]
    raw: Mapping[str, Any] = field(repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "RecordPage":
        pagination = value.get("pagination", {})
        return cls(
            records=tuple(Record.from_dict(item) for item in value.get("records", [])),
            next_cursor=str(pagination["next_cursor"]) if pagination.get("next_cursor") else None,
            has_more=bool(pagination.get("has_more", False)),
            release=dict(value.get("release", {})),
            raw=dict(value),
        )


@dataclass(frozen=True)
class PlotPoint:
    record_id: str
    label: str
    material_family: str
    form_factor: str
    cnt_type: str | None
    publication: Mapping[str, Any]
    provenance: Mapping[str, Any]
    x: Measurement
    y: Measurement
    raw: Mapping[str, Any] = field(repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "PlotPoint":
        return cls(
            record_id=str(value.get("record_id", "")),
            label=str(value.get("label", "")),
            material_family=str(value.get("material_family", "")),
            form_factor=str(value.get("form_factor", "")),
            cnt_type=str(value["cnt_type"]) if value.get("cnt_type") else None,
            publication=dict(value.get("publication", {})),
            provenance=dict(value.get("provenance", {})),
            x=Measurement.from_dict(value.get("x", {})),
            y=Measurement.from_dict(value.get("y", {})),
            raw=dict(value),
        )


@dataclass(frozen=True)
class PlotResult:
    axes: Mapping[str, Any]
    points: tuple[PlotPoint, ...]
    citations: CitationBundle
    next_cursor: str | None
    has_more: bool
    release: Mapping[str, Any]
    raw: Mapping[str, Any] = field(repr=False)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "PlotResult":
        pagination = value.get("pagination", {})
        return cls(
            axes=dict(value.get("axes", {})),
            points=tuple(PlotPoint.from_dict(item) for item in value.get("points", [])),
            citations=CitationBundle.from_dict(value.get("citations")),
            next_cursor=str(pagination["next_cursor"]) if pagination.get("next_cursor") else None,
            has_more=bool(pagination.get("has_more", False)),
            release=dict(value.get("release", {})),
            raw=dict(value),
        )


@dataclass(frozen=True)
class TemporaryPoint:
    """A user-supplied point expressed in the active figure's display units."""

    x: float
    y: float
    label: str = "User input"


@dataclass(frozen=True)
class TemporaryPointRank:
    """Bounded comparison of a temporary point against the plotted reference set."""

    label: str
    x: float
    y: float
    total_with_temporary: int
    x_rank: int | None
    y_rank: int | None
    x_percentile: float | None
    y_percentile: float | None
    dominated_by: int | None
    on_pareto_frontier: bool | None


@dataclass(frozen=True)
class TopPoint:
    """One exact, citation-backed row from the bounded top-point table."""

    rank: int
    label: str
    material_family: str
    form_factor: str
    x_value: float
    x_unit: str
    y_value: float
    y_unit: str
    doi: str | None
    publication_title: str | None
    publication_year: int | None
    citation: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "rank": self.rank,
            "label": self.label,
            "material_family": self.material_family,
            "form_factor": self.form_factor,
            "x_value": self.x_value,
            "x_unit": self.x_unit,
            "y_value": self.y_value,
            "y_unit": self.y_unit,
            "doi": self.doi,
            "publication_title": self.publication_title,
            "publication_year": self.publication_year,
            "citation": self.citation,
        }


@dataclass(frozen=True)
class RenderedFigure:
    """Publication-oriented figure output without exposing the complete point table."""

    kind: str
    x_property: str
    y_property: str
    point_count: int
    top_points: tuple[TopPoint, ...]
    citations: CitationBundle
    temporary_point: TemporaryPointRank | None
    release: Mapping[str, Any]
    _images: Mapping[str, bytes] = field(repr=False)

    def _repr_svg_(self) -> str:
        """Render directly in Jupyter without returning underlying coordinates."""
        return self._images["svg"].decode("utf-8")

    def top_table(self) -> tuple[dict[str, Any], ...]:
        """Return only the explicitly bounded top rows represented by this figure."""
        return tuple(point.as_dict() for point in self.top_points)

    def save(self, path: str | Path) -> Path:
        """Save SVG, PDF, or PNG plus mandatory citation sidecars."""
        destination = Path(path)
        format_name = destination.suffix.lower().lstrip(".")
        if format_name not in self._images:
            raise ValueError("Figure path must end in .svg, .pdf, or .png.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(self._images[format_name])
        destination.with_name(f"{destination.stem}.citations.txt").write_text(
            self.citations.copy_all + "\n", encoding="utf-8"
        )
        destination.with_name(f"{destination.stem}.bib").write_text(
            self.citations.bibtex + "\n", encoding="utf-8"
        )
        return destination

    def save_top_table(self, path: str | Path) -> Path:
        """Save the bounded top rows as CSV; the full plotted dataset is not exported."""
        destination = Path(path)
        if destination.suffix.lower() != ".csv":
            raise ValueError("Top-point table path must end in .csv.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        rows = self.top_table()
        fieldnames = list(rows[0]) if rows else ["rank"]
        with destination.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        destination.with_name(f"{destination.stem}.citations.txt").write_text(
            self.citations.copy_all + "\n", encoding="utf-8"
        )
        return destination
