#!/usr/bin/env python3
"""Audit processed/public/web CNT Property Atlas data for release-blocking losses.

This script is intentionally stricter than the public-release builder. The
builder decides what is eligible for the website; this audit checks whether the
decisions and generated files would hide high-value source records, attach
implausible DOI metadata, or ship stale web data.
"""

from __future__ import annotations

import json
import math
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
PUBLIC = ROOT / "data" / "public"
WEB_PUBLIC = ROOT / "web" / "data" / "public"
REPORTS = ROOT / "reports"

PRIMARY_MATERIALS = {"CNT_or_CNT_hybrid", "graphene_or_GO_fiber", "CNT_metal_composite"}

PUBLIC_SYNC_FILES = [
    "public_records_v0.csv",
    "public_measurements_v0.csv",
    "public_publications_v0.csv",
    "public_exclusions_v0.csv",
    "public_duplicate_audit_v0.csv",
    "public_release_summary.json",
]

PROPERTY_FIELDS = {
    "density": ("density_kg_m3", "kg/m3"),
    "specific_volume": ("specific_volume_m3_kg", "m3/kg"),
    "specific_strength": ("specific_strength_N_m_kg", "N m/kg"),
    "tensile_strength": ("tensile_strength_GPa", "GPa"),
    "specific_modulus": ("specific_modulus_N_m_kg", "N m/kg"),
    "initial_modulus": ("initial_modulus_GPa", "GPa"),
    "work_of_rupture": ("rupture_work_J_kg", "J/kg"),
    "electrical_conductivity": ("electrical_conductivity_S_m", "S/m"),
    "specific_electrical_conductivity": ("specific_electrical_conductivity_S_m2_kg", "S m2/kg"),
    "thermal_conductivity": ("thermal_conductivity_W_mK", "W/m/K"),
    "specific_thermal_conductivity": ("specific_thermal_conductivity_W_m2_K_kg", "W m2/K/kg"),
    "g_d_ratio": ("g_d_ratio", "ratio"),
    "ampacity": ("ampacity_A_m2", "A/m2"),
}

MEASUREMENT_CANONICAL_FIELDS = {
    "density": ("density_kg_m3", "kg/m3"),
    "specific_volume": ("specific_volume_m3_kg", "m3/kg"),
    "diameter": ("diameter_m", "m"),
    "linear_density": ("linear_density_kg_m", "kg/m"),
    "specific_strength": ("specific_strength_N_m_kg", "N m/kg"),
    "tensile_strength": ("tensile_strength_Pa", "Pa"),
    "specific_modulus": ("specific_modulus_N_m_kg", "N m/kg"),
    "initial_modulus": ("initial_modulus_Pa", "Pa"),
    "breaking_strain": ("breaking_strain_fraction", "fraction"),
    "work_of_rupture": ("rupture_work_J_kg", "J/kg"),
    "electrical_conductivity": ("electrical_conductivity_S_m", "S/m"),
    "specific_electrical_conductivity": ("specific_electrical_conductivity_S_m2_kg", "S m2/kg"),
    "thermal_conductivity": ("thermal_conductivity_W_mK", "W/m/K"),
    "specific_thermal_conductivity": ("specific_thermal_conductivity_W_m2_K_kg", "W m2/K/kg"),
    "g_d_ratio": ("g_d_ratio", "ratio"),
    "ampacity": ("ampacity_A_m2", "A/m2"),
}

TOP_VALUE_RULES = {
    "specific_strength": {"threshold": 3.0e6, "top_n": 20},
    "tensile_strength": {"threshold": 4.0, "top_n": 20},
    "specific_modulus": {"threshold": 100.0e6, "top_n": 20},
    "initial_modulus": {"threshold": 100.0, "top_n": 20},
    "work_of_rupture": {"threshold": 50_000.0, "top_n": 20},
    "electrical_conductivity": {"threshold": 2.5e6, "top_n": 20},
    "specific_electrical_conductivity": {"threshold": 2_000.0, "top_n": 20},
    "thermal_conductivity": {"threshold": 250.0, "top_n": 20},
    "specific_thermal_conductivity": {"threshold": 0.15, "top_n": 20},
    "ampacity": {"threshold": 1.0e9, "top_n": 20},
}

REQUIRED_PUBLIC_RECORDS = [
    {
        "doi": "10.1126/science.adj1082",
        "record_label": "F-CNTFs",
        "tensile_strength_GPa": 1.785,
        "specific_strength_N_m_kg": 1.7e6,
    },
    {
        "doi": "10.1126/science.adj1082",
        "record_label": "CSA-CNTFs",
        "tensile_strength_GPa": 4.674,
        "specific_strength_N_m_kg": 3.8e6,
    },
    {
        "doi": "10.1126/science.adj1082",
        "record_label": "PBO-CNTFs",
        "tensile_strength_GPa": 5.67,
        "specific_strength_N_m_kg": 4.5e6,
    },
    {
        "doi": "10.1126/science.adj1082",
        "record_label": "D-PBO-CNTFs",
        "tensile_strength_GPa": 8.12,
        "specific_strength_N_m_kg": 5.8e6,
    },
]

MATERIAL_TITLE_KEYWORDS = {
    "CNT_or_CNT_hybrid": {"nanotube", "cnt", "carbon", "fiber", "fibre", "yarn", "ribbon"},
    "CNT_metal_composite": {"nanotube", "cnt", "carbon", "copper", "metal", "wire", "composite"},
    "graphene_or_GO_fiber": {"graphene", "graphite", "carbon", "fiber", "fibre"},
}

PLOT_PERFORMANCE_KEYS = {
    "specific_electrical_conductivity",
    "electrical_conductivity",
    "specific_strength",
    "tensile_strength",
    "specific_modulus",
    "initial_modulus",
    "specific_thermal_conductivity",
    "thermal_conductivity",
    "ampacity",
    "work_of_rupture",
    "breaking_strain",
    "g_d_ratio",
}

NORMALIZED_KEYS = {
    "density",
    "specific_volume",
    "specific_strength",
    "specific_modulus",
    "specific_electrical_conductivity",
    "specific_thermal_conductivity",
}

PLOT_REPRESENTATIVE_XY_RULES = [
    ("tensile_strength", "specific_electrical_conductivity"),
    ("specific_strength", "specific_electrical_conductivity"),
    ("tensile_strength", "thermal_conductivity"),
    ("specific_strength", "thermal_conductivity"),
    ("initial_modulus", "specific_electrical_conductivity"),
]

REQUIRED_XY_PLOT_RECORDS = [
    {
        "doi": "10.1126/science.adj1082",
        "record_label": "D-PBO-CNTFs",
        "x": "tensile_strength",
        "y": "specific_electrical_conductivity",
    }
]

DEFAULT_PUBLIC_TIERS = {"peer_reviewed_research", "peer_reviewed_contextual_comparator"}
DEFAULT_EXTRACTION_TYPES = {"direct_or_source_table", "secondary_meta_analysis"}


@dataclass
class Finding:
    severity: str
    check: str
    message: str
    record_id: str | None = None
    details: dict[str, Any] | None = None


def clean(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    return text


def normalized_text(value: Any) -> str:
    text = clean(value) or ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def normalized_label(value: Any) -> str:
    return normalized_text(value).replace(" ", "")


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(path)
    return pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[])


def to_number(value: Any) -> float | None:
    text = clean(value)
    if text is None:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def close_enough(a: Any, b: Any, rel_tol: float = 0.03, abs_tol: float = 1e-12) -> bool:
    av = to_number(a)
    bv = to_number(b)
    if av is None or bv is None:
        return False
    scale = max(abs(av), abs(bv), 1.0)
    return abs(av - bv) <= max(abs_tol, rel_tol * scale)


def same_doi(row: pd.Series, doi: str) -> bool:
    doi = doi.lower()
    return doi in (clean(row.get("doi_verified")) or clean(row.get("doi_raw")) or "").lower()


def add(finding_list: list[Finding], severity: str, check: str, message: str, record_id: str | None = None, **details: Any) -> None:
    finding_list.append(Finding(severity=severity, check=check, message=message, record_id=record_id, details=details or None))


def audit_public_sync(findings: list[Finding]) -> None:
    for filename in PUBLIC_SYNC_FILES:
        public_file = PUBLIC / filename
        web_file = WEB_PUBLIC / filename
        if not public_file.exists() or not web_file.exists():
            add(findings, "error", "web_data_sync", f"Missing public/web data file {filename}.")
            continue
        if public_file.read_bytes() != web_file.read_bytes():
            add(findings, "error", "web_data_sync", f"Website data is stale for {filename}.", filename=filename)


def audit_summary_counts(findings: list[Finding], public_records: pd.DataFrame, public_measurements: pd.DataFrame, public_publications: pd.DataFrame) -> None:
    summary_path = PUBLIC / "public_release_summary.json"
    if not summary_path.exists():
        add(findings, "error", "summary_counts", "Missing public_release_summary.json.")
        return
    summary = json.loads(summary_path.read_text())
    expected = {
        "public_records": len(public_records),
        "public_measurements": len(public_measurements),
        "public_publications": len(public_publications),
    }
    for key, actual in expected.items():
        reported = int(summary.get(key, -1))
        if reported != actual:
            add(findings, "error", "summary_counts", f"{key} summary count is stale.", reported=reported, actual=actual)


def audit_required_public_records(findings: list[Finding], public_records: pd.DataFrame) -> None:
    for required in REQUIRED_PUBLIC_RECORDS:
        label_key = normalized_label(required["record_label"])
        candidates = public_records[
            public_records.apply(lambda row: same_doi(row, required["doi"]), axis=1)
            & public_records["record_label"].map(normalized_label).eq(label_key)
        ]
        if candidates.empty:
            add(findings, "error", "required_science_2024_records", "Required Science 2024 CNTF row is missing.", expected=required)
            continue
        row = candidates.iloc[0]
        for field, expected in required.items():
            if field in {"doi", "record_label"}:
                continue
            if not close_enough(row.get(field), expected):
                add(
                    findings,
                    "error",
                    "required_science_2024_records",
                    f"Required Science 2024 CNTF field {field} has wrong value.",
                    record_id=clean(row.get("record_id")),
                    expected=expected,
                    actual=row.get(field),
                    label=required["record_label"],
                )


def audit_semantic_publications(findings: list[Finding], public_records: pd.DataFrame) -> None:
    primary = public_records[public_records["material_family"].isin(PRIMARY_MATERIALS)].copy()
    primary = primary[primary["publication_validation_status"].eq("verified_crossref_openalex")]
    for _, row in primary.iterrows():
        family = clean(row.get("material_family")) or ""
        keywords = MATERIAL_TITLE_KEYWORDS.get(family)
        if not keywords:
            continue
        title = normalized_text(row.get("publication_title_verified"))
        if not title:
            add(findings, "error", "semantic_publication_title", "Verified DOI lacks a title for a primary material row.", record_id=clean(row.get("record_id")))
            continue
        if not any(keyword in title for keyword in keywords):
            add(
                findings,
                "error",
                "semantic_publication_title",
                "Verified DOI title is semantically implausible for the material row.",
                record_id=clean(row.get("record_id")),
                doi=clean(row.get("doi_verified")),
                family=family,
                title=clean(row.get("publication_title_verified")),
                record_label=clean(row.get("record_label")),
            )


def public_matches_source_value(public_records: pd.DataFrame, source_row: pd.Series, field: str, value: float) -> bool:
    family = clean(source_row.get("material_family"))
    form = clean(source_row.get("form_factor"))
    doi = clean(source_row.get("doi_raw"))
    label = normalized_label(source_row.get("record_label"))
    candidates = public_records[
        public_records["material_family"].map(clean).eq(family)
        & public_records["form_factor"].map(clean).eq(form)
    ].copy()
    if doi:
        candidates = candidates[candidates.apply(lambda row: same_doi(row, doi), axis=1)]
    if candidates.empty:
        return False
    value_matches = candidates[candidates[field].map(lambda candidate: close_enough(candidate, value))]
    if value_matches.empty:
        return False
    if doi:
        return True
    return any(normalized_label(row.get("record_label")) == label for _, row in value_matches.iterrows())


def audit_top_source_survival(findings: list[Finding], processed_records: pd.DataFrame, public_records: pd.DataFrame) -> None:
    primary = processed_records[processed_records["material_family"].isin(PRIMARY_MATERIALS)].copy()
    for property_key, rule in TOP_VALUE_RULES.items():
        field, unit = PROPERTY_FIELDS[property_key]
        if field not in primary.columns or field not in public_records.columns:
            continue
        primary["_audit_value"] = primary[field].map(to_number)
        measured = primary[primary["_audit_value"].notna()].copy()
        if measured.empty:
            continue
        threshold = float(rule["threshold"])
        top_n = int(rule["top_n"])
        candidates = []
        for _, group in measured.groupby(["material_family", "form_factor"], dropna=False):
            top = group.sort_values("_audit_value", ascending=False).head(top_n)
            top = top[top["_audit_value"] >= threshold]
            candidates.append(top)
        if not candidates:
            continue
        top_rows = pd.concat(candidates, ignore_index=True)
        for _, row in top_rows.iterrows():
            value = float(row["_audit_value"])
            represented = public_matches_source_value(public_records, row, field, value)
            if represented:
                continue
            severity = "error"
            doi = clean(row.get("doi_raw"))
            reason = "missing from public data"
            if not doi:
                reason = "high-value primary record has no DOI and is not public"
            add(
                findings,
                severity,
                "top_source_value_survival",
                f"Top {property_key} source value is {reason}.",
                record_id=clean(row.get("record_id")),
                property=property_key,
                value=value,
                unit=unit,
                record_label=clean(row.get("record_label")),
                sample_name=clean(row.get("sample_name")),
                doi=doi,
                source_file=clean(row.get("source_file")),
                source_sheet=clean(row.get("source_sheet")),
                source_row=clean(row.get("source_row")),
            )
    if "_audit_value" in primary.columns:
        primary.drop(columns=["_audit_value"], inplace=True)


def audit_public_measurement_consistency(findings: list[Finding], public_records: pd.DataFrame, public_measurements: pd.DataFrame) -> None:
    records = public_records.set_index("record_id")
    for _, measurement in public_measurements.iterrows():
        record_id = clean(measurement.get("record_id"))
        prop = clean(measurement.get("property"))
        if not record_id or prop not in MEASUREMENT_CANONICAL_FIELDS or record_id not in records.index:
            continue
        field, _unit = MEASUREMENT_CANONICAL_FIELDS[prop]
        record_value = records.at[record_id, field] if field in records.columns else None
        measurement_value = measurement.get("value_canonical")
        if not close_enough(record_value, measurement_value):
            add(
                findings,
                "error",
                "measurement_record_consistency",
                "Public measurement value does not match the record-level canonical value.",
                record_id=record_id,
                property=prop,
                record_value=record_value,
                measurement_value=measurement_value,
            )


def truthy(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def frontend_group_part(value: Any, fallback: str = "unspecified") -> str:
    text = normalized_text(value).replace(" ", "_")
    return text or fallback


def frontend_publication_group_key(row: pd.Series) -> str:
    doi = clean(row.get("doi_verified")) or clean(row.get("doi_raw"))
    if doi and doi.lower().startswith("10."):
        return f"doi:{doi.lower()}"
    return "|".join(
        [
            "publication",
            frontend_group_part(row.get("publication_title_verified") or row.get("citation_raw") or row.get("source_file")),
            frontend_group_part(row.get("publication_authors_short_verified")),
            clean(row.get("publication_year_verified")) or "n.d.",
        ]
    )


def frontend_representative_group_key(row: pd.Series) -> str:
    return "|".join(
        [
            frontend_publication_group_key(row),
            clean(row.get("material_family")) or "",
            clean(row.get("form_factor")) or "",
            frontend_group_part(row.get("cnt_type")),
        ]
    )


def frontend_priority_keys(x: str, y: str) -> list[str]:
    keys = [key for key in [x, y] if key in PLOT_PERFORMANCE_KEYS]
    return list(dict.fromkeys(keys))


def frontend_display_value(row: pd.Series, property_key: str) -> float | None:
    field = PROPERTY_FIELDS[property_key][0]
    return to_number(row.get(field))


def frontend_record_dominates(candidate: pd.Series, target: pd.Series, keys: list[str]) -> bool:
    strictly_better = False
    for key in keys:
        candidate_value = frontend_display_value(candidate, key)
        target_value = frontend_display_value(target, key)
        if candidate_value is None or target_value is None:
            return False
        tolerance = max(abs(candidate_value), abs(target_value), 1.0) * 1e-9
        if candidate_value + tolerance < target_value:
            return False
        if candidate_value > target_value + tolerance:
            strictly_better = True
    return strictly_better


def frontend_eligible_xy_records(public_records: pd.DataFrame, x: str, y: str) -> pd.DataFrame:
    x_field = PROPERTY_FIELDS[x][0]
    y_field = PROPERTY_FIELDS[y][0]
    eligible = public_records.copy()
    eligible["_audit_x"] = eligible[x_field].map(to_number)
    eligible["_audit_y"] = eligible[y_field].map(to_number)
    eligible = eligible[eligible["_audit_x"].notna() & eligible["_audit_y"].notna()].copy()
    eligible = eligible[eligible["public_release_tier"].isin(DEFAULT_PUBLIC_TIERS)]
    eligible = eligible[eligible["value_extraction_type"].isin(DEFAULT_EXTRACTION_TYPES)]
    if x in NORMALIZED_KEYS and y in NORMALIZED_KEYS:
        eligible = eligible[eligible["normalized_comparison_eligible"].map(truthy)]
    return eligible


def frontend_representative_ids(eligible: pd.DataFrame, x: str, y: str) -> set[str]:
    keys = frontend_priority_keys(x, y)
    if len(keys) < 2:
        field = PROPERTY_FIELDS[keys[0] if keys else y][0]
        retained: set[str] = set()
        for _, group in eligible.groupby(eligible.apply(frontend_representative_group_key, axis=1), dropna=False):
            values = group[field].map(to_number)
            if values.notna().any():
                retained.add(str(group.loc[values.idxmax(), "record_id"]))
        return retained

    retained = set()
    group_keys = eligible.apply(frontend_representative_group_key, axis=1)
    for _, group in eligible.groupby(group_keys, dropna=False):
        for index, row in group.iterrows():
            dominated = any(
                other_index != index and frontend_record_dominates(other, row, keys)
                for other_index, other in group.iterrows()
            )
            if not dominated:
                retained.add(str(row["record_id"]))
    return retained


def audit_frontend_representative_extremes(findings: list[Finding], public_records: pd.DataFrame) -> None:
    for x, y in PLOT_REPRESENTATIVE_XY_RULES:
        eligible = frontend_eligible_xy_records(public_records, x, y)
        if eligible.empty:
            continue
        retained_ids = frontend_representative_ids(eligible, x, y)
        group_keys = eligible.apply(frontend_representative_group_key, axis=1)
        for group_key, group in eligible.groupby(group_keys, dropna=False):
            if len(group) < 2:
                continue
            for axis, value_column, property_key in [("x", "_audit_x", x), ("y", "_audit_y", y)]:
                max_value = group[value_column].max()
                top_rows = group[group[value_column].map(lambda value: close_enough(value, max_value))]
                if any(str(row["record_id"]) in retained_ids for _, row in top_rows.iterrows()):
                    continue
                row = top_rows.iloc[0]
                add(
                    findings,
                    "error",
                    "frontend_representative_extreme_survival",
                    "Frontend scatter reduction would hide a same-paper axis extreme.",
                    record_id=clean(row.get("record_id")),
                    x=x,
                    y=y,
                    hidden_axis=axis,
                    hidden_property=property_key,
                    value=max_value,
                    record_label=clean(row.get("record_label")),
                    doi=clean(row.get("doi_verified")) or clean(row.get("doi_raw")),
                    representative_group=group_key,
                )

    for required in REQUIRED_XY_PLOT_RECORDS:
        eligible = frontend_eligible_xy_records(public_records, required["x"], required["y"])
        retained_ids = frontend_representative_ids(eligible, required["x"], required["y"])
        label_key = normalized_label(required["record_label"])
        matches = eligible[
            eligible.apply(lambda row: same_doi(row, required["doi"]), axis=1)
            & eligible["record_label"].map(normalized_label).eq(label_key)
        ]
        if matches.empty:
            add(findings, "error", "required_xy_plot_records", "Required record is not eligible for the active XY plot.", expected=required)
            continue
        row = matches.iloc[0]
        if str(row["record_id"]) not in retained_ids:
            add(
                findings,
                "error",
                "required_xy_plot_records",
                "Required high-performance record would be hidden by frontend representative reduction.",
                record_id=clean(row.get("record_id")),
                expected=required,
            )


def write_reports(findings: list[Finding]) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    payload = {
        "status": "fail" if any(f.severity == "error" for f in findings) else "pass",
        "finding_counts": {
            "error": sum(1 for f in findings if f.severity == "error"),
            "warning": sum(1 for f in findings if f.severity == "warning"),
        },
        "findings": [asdict(f) for f in findings],
    }
    (REPORTS / "public_data_integrity_audit.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = ["# Public Data Integrity Audit", ""]
    lines.append(f"Status: **{payload['status'].upper()}**")
    lines.append("")
    lines.append(f"- Errors: {payload['finding_counts']['error']}")
    lines.append(f"- Warnings: {payload['finding_counts']['warning']}")
    if findings:
        lines.extend(["", "## Findings", ""])
        for finding in findings:
            record = f" `{finding.record_id}`" if finding.record_id else ""
            lines.append(f"- **{finding.severity.upper()}** `{finding.check}`{record}: {finding.message}")
            if finding.details:
                compact = json.dumps(finding.details, ensure_ascii=False, sort_keys=True)
                lines.append(f"  - `{compact}`")
    else:
        lines.extend(["", "No release-blocking findings."])
    (REPORTS / "public_data_integrity_audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    findings: list[Finding] = []
    processed_records = read_csv(PROCESSED / "combined_records.csv")
    public_records = read_csv(PUBLIC / "public_records_v0.csv")
    public_measurements = read_csv(PUBLIC / "public_measurements_v0.csv")
    public_publications = read_csv(PUBLIC / "public_publications_v0.csv")

    audit_public_sync(findings)
    audit_summary_counts(findings, public_records, public_measurements, public_publications)
    audit_required_public_records(findings, public_records)
    audit_semantic_publications(findings, public_records)
    audit_top_source_survival(findings, processed_records, public_records)
    audit_public_measurement_consistency(findings, public_records, public_measurements)
    audit_frontend_representative_extremes(findings, public_records)
    write_reports(findings)

    errors = sum(1 for finding in findings if finding.severity == "error")
    warnings = sum(1 for finding in findings if finding.severity == "warning")
    result = {"status": "fail" if errors else "pass", "errors": errors, "warnings": warnings}
    print(json.dumps(result, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
