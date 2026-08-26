"""Typed bounded-artifact responses for Carbon Property Tables."""

from __future__ import annotations

import csv
import hashlib
import json
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
class TemporaryPoint:
    """A user-supplied point in the display units printed on the active axes."""

    x: float
    y: float
    label: str = "User input"


@dataclass(frozen=True)
class DoiStatus:
    """Exact DOI-presence result without material-property values or record IDs."""

    query_doi: str
    in_database: bool
    doi: str | None
    title: str | None
    authors_short: str | None
    journal: str | None
    year: int | None
    role: str | None
    release: Mapping[str, Any]

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "DoiStatus":
        publication = value.get("publication")
        metadata = publication if isinstance(publication, Mapping) else {}
        return cls(
            query_doi=str(value.get("query_doi", "")),
            in_database=bool(value.get("in_database", False)),
            doi=str(metadata["doi"]) if metadata.get("doi") else None,
            title=str(metadata["title"]) if metadata.get("title") else None,
            authors_short=str(metadata["authors_short"]) if metadata.get("authors_short") else None,
            journal=str(metadata["journal"]) if metadata.get("journal") else None,
            year=int(metadata["year"]) if metadata.get("year") is not None else None,
            role=str(metadata["role"]) if metadata.get("role") else None,
            release=dict(value.get("release", {})),
        )


@dataclass(frozen=True)
class PublicationSearchResult:
    """One deduplicated publication match without record or measurement data."""

    doi: str | None
    title: str
    authors_short: str | None
    journal: str | None
    year: int | None
    role: str
    match_fields: tuple[str, ...]

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "PublicationSearchResult":
        return cls(
            doi=str(value["doi"]) if value.get("doi") else None,
            title=str(value.get("title", "")),
            authors_short=str(value["authors_short"]) if value.get("authors_short") else None,
            journal=str(value["journal"]) if value.get("journal") else None,
            year=int(value["year"]) if value.get("year") is not None else None,
            role=str(value.get("role", "original")),
            match_fields=tuple(str(item) for item in value.get("match_fields", [])),
        )


@dataclass(frozen=True)
class PublicationSearch:
    """Iterable page of publication-level search results."""

    query: str
    results: tuple[PublicationSearchResult, ...]
    has_more: bool
    release: Mapping[str, Any]

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "PublicationSearch":
        return cls(
            query=str(value.get("query", "")),
            results=tuple(PublicationSearchResult.from_dict(item) for item in value.get("results", [])),
            has_more=bool(value.get("has_more", False)),
            release=dict(value.get("release", {})),
        )

    def __iter__(self):
        return iter(self.results)

    def __len__(self) -> int:
        return len(self.results)

    def __getitem__(self, index: int) -> PublicationSearchResult:
        return self.results[index]


@dataclass(frozen=True)
class TemporaryPointRank:
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

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "TemporaryPointRank":
        return cls(
            label=str(value.get("label", "User input")),
            x=float(value.get("x", 0)),
            y=float(value.get("y", 0)),
            total_with_temporary=int(value.get("total_with_temporary", 0)),
            x_rank=int(value["x_rank"]) if value.get("x_rank") is not None else None,
            y_rank=int(value["y_rank"]) if value.get("y_rank") is not None else None,
            x_percentile=float(value["x_percentile"]) if value.get("x_percentile") is not None else None,
            y_percentile=float(value["y_percentile"]) if value.get("y_percentile") is not None else None,
            dominated_by=int(value["dominated_by"]) if value.get("dominated_by") is not None else None,
            on_pareto_frontier=bool(value["on_pareto_frontier"]) if value.get("on_pareto_frontier") is not None else None,
        )


@dataclass(frozen=True)
class TopPoint:
    """One exact, citation-backed row from the capped top-point response."""

    rank: int
    label: str
    material_family: str
    form_factor: str
    x_value: float | None
    x_unit: str
    y_value: float
    y_unit: str
    doi: str | None
    publication_title: str | None
    publication_year: int | None
    citation: str
    comparability_grade: str

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "TopPoint":
        return cls(
            rank=int(value.get("rank", 0)),
            label=str(value.get("label", "")),
            material_family=str(value.get("material_family", "")),
            form_factor=str(value.get("form_factor", "")),
            x_value=float(value["x_value"]) if value.get("x_value") is not None else None,
            x_unit=str(value.get("x_unit", "")),
            y_value=float(value.get("y_value", 0)),
            y_unit=str(value.get("y_unit", "")),
            doi=str(value["doi"]) if value.get("doi") else None,
            publication_title=str(value["publication_title"]) if value.get("publication_title") else None,
            publication_year=int(value["publication_year"]) if value.get("publication_year") is not None else None,
            citation=str(value.get("citation", "")),
            comparability_grade=str(value.get("comparability_grade", "D")),
        )

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
            "comparability_grade": self.comparability_grade,
        }


@dataclass(frozen=True)
class RenderedFigure:
    """Server-rendered figure package without the complete coordinate table."""

    kind: str
    x_property: str
    y_property: str
    point_count: int
    top_points: tuple[TopPoint, ...]
    citations: CitationBundle
    temporary_point: TemporaryPointRank | None
    comparability: Mapping[str, Any]
    release: Mapping[str, Any]
    generated_at: str
    request: Mapping[str, Any] = field(repr=False)
    _images: Mapping[str, bytes] = field(repr=False)

    @classmethod
    def from_dict(
        cls,
        value: Mapping[str, Any],
        images: Mapping[str, bytes],
        request: Mapping[str, Any] | None = None,
    ) -> "RenderedFigure":
        axes = value.get("axes", {})
        x_axis = axes.get("x", {}) if isinstance(axes, Mapping) else {}
        y_axis = axes.get("y", {}) if isinstance(axes, Mapping) else {}
        temporary = value.get("temporary_point")
        return cls(
            kind=str(value.get("kind", "")),
            x_property=str(x_axis.get("key", "")) if isinstance(x_axis, Mapping) else "",
            y_property=str(y_axis.get("key", "")) if isinstance(y_axis, Mapping) else "",
            point_count=int(value.get("point_count", 0)),
            top_points=tuple(TopPoint.from_dict(item) for item in value.get("top_points", [])),
            citations=CitationBundle.from_dict(value.get("citations")),
            temporary_point=TemporaryPointRank.from_dict(temporary) if isinstance(temporary, Mapping) else None,
            comparability=dict(value.get("comparability", {})),
            release=dict(value.get("release", {})),
            generated_at=str(value.get("generated_at", "")),
            request=dict(request or {}),
            _images=dict(images),
        )

    def _repr_svg_(self) -> str:
        """Render directly in Jupyter when SVG was requested."""
        if "svg" not in self._images:
            return "<p>SVG was not requested for this Carbon Property Tables figure.</p>"
        return self._images["svg"].decode("utf-8")

    @property
    def available_formats(self) -> tuple[str, ...]:
        return tuple(self._images)

    def top_table(self) -> tuple[dict[str, Any], ...]:
        """Return only the explicitly requested, capped top rows."""
        return tuple(point.as_dict() for point in self.top_points)

    def save(self, path: str | Path) -> Path:
        """Save a requested SVG, PDF, or PNG plus citation sidecars."""
        destination = Path(path)
        format_name = destination.suffix.lower().lstrip(".")
        if format_name not in {"svg", "pdf", "png"}:
            raise ValueError("Figure path must end in .svg, .pdf, or .png.")
        if format_name not in self._images:
            raise ValueError(f"{format_name.upper()} was not requested; available formats: {', '.join(self.available_formats)}.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(self._images[format_name])
        destination.with_name(f"{destination.stem}.citations.txt").write_text(self.citations.copy_all + "\n", encoding="utf-8")
        destination.with_name(f"{destination.stem}.bib").write_text(self.citations.bibtex + "\n", encoding="utf-8")
        return destination

    def reproducibility_manifest(self) -> dict[str, Any]:
        """Return a value-free recipe tying the figure to its request, release, and citations."""
        identity = {
            "request": dict(self.request),
            "release_id": self.release.get("release_id"),
            "source_hash": self.release.get("source_hash"),
        }
        fingerprint = hashlib.sha256(
            json.dumps(identity, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        ).hexdigest()
        return {
            "schema": "cpt-figure-manifest-v2",
            "figure_fingerprint": fingerprint,
            "generated_at": self.generated_at,
            "figure": {
                "kind": self.kind,
                "x_property": self.x_property,
                "y_property": self.y_property,
                "point_count": self.point_count,
                "formats": list(self.available_formats),
            },
            "request": dict(self.request),
            "release": dict(self.release),
            "comparability": dict(self.comparability),
            "citation_policy": self.citations.requirement,
            "citations": [
                {"citation_id": entry.citation_id, "roles": list(entry.roles), "doi": entry.doi, "text": entry.text}
                for entry in self.citations.entries
            ],
        }

    def save_bundle(self, path: str | Path) -> dict[str, Path]:
        """Save every requested image format plus citation and reproducibility sidecars."""
        destination = Path(path)
        stem = destination.with_suffix("") if destination.suffix else destination
        stem.parent.mkdir(parents=True, exist_ok=True)
        saved: dict[str, Path] = {}
        for format_name, payload in self._images.items():
            image_path = stem.with_suffix(f".{format_name}")
            image_path.write_bytes(payload)
            saved[format_name] = image_path
        citations_path = stem.with_suffix(".citations.txt")
        bibtex_path = stem.with_suffix(".bib")
        manifest_path = stem.with_suffix(".manifest.json")
        citations_path.write_text(self.citations.copy_all + "\n", encoding="utf-8")
        bibtex_path.write_text(self.citations.bibtex + "\n", encoding="utf-8")
        manifest_path.write_text(
            json.dumps(self.reproducibility_manifest(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        saved.update({"citations": citations_path, "bibtex": bibtex_path, "manifest": manifest_path})
        return saved

    def save_top_table(self, path: str | Path) -> Path:
        """Save the bounded top rows as CSV; the complete plotted dataset is unavailable."""
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
        destination.with_name(f"{destination.stem}.citations.txt").write_text(self.citations.copy_all + "\n", encoding="utf-8")
        return destination
