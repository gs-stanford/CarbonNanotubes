#!/usr/bin/env python3
"""Build reviewer-facing curation tables from processed CNT database outputs.

Outputs:
  data/curation/record_curation_queue.csv
  data/curation/publication_curation_queue.csv
  data/curation/issue_summary.csv
  data/curation/property_coverage_summary.csv
  data/curation/workbook_payload.json
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
CURATION = ROOT / "data" / "curation"
DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)


REVIEW_COLUMNS = [
    "curation_decision",
    "include_public",
    "reviewer",
    "review_date",
    "confidence_score_reviewed",
    "official_sample_name",
    "official_material_family",
    "official_form_factor",
    "official_cnt_type",
    "official_synthesis_method",
    "official_postprocessing",
    "official_measurement_method",
    "official_condition_temperature_C",
    "official_condition_atmosphere",
    "official_gauge_length_mm",
    "official_strain_rate_s_inv",
    "official_provenance_table_figure_page",
    "duplicate_group_id",
    "primary_record_id",
    "curation_notes",
]


def clean(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    return text


def normalize_doi(value: Any) -> str | None:
    text = clean(value)
    if not text:
        return None
    match = DOI_RE.search(text)
    if not match:
        return None
    return match.group(0).rstrip(" .,)];").lower()


def extract_dois(value: Any) -> list[str]:
    text = clean(value) or ""
    dois = set()
    for part in text.split(";"):
        dois.update(m.group(0).rstrip(" .,)];").lower() for m in DOI_RE.finditer(part))
    return sorted(dois)


def flatten_issue_map(issues: pd.DataFrame) -> pd.DataFrame:
    if issues.empty:
        return pd.DataFrame(columns=["record_id", "issue_types", "issue_messages", "issue_count"])
    grouped = (
        issues.groupby("record_id")
        .agg(
            issue_types=("issue_type", lambda s: ";".join(sorted(set(str(v) for v in s if clean(v))))),
            issue_messages=("message", lambda s: " | ".join(str(v) for v in s if clean(v))),
            issue_count=("issue_id", "count"),
        )
        .reset_index()
    )
    return grouped


def add_publication_status(records: pd.DataFrame, publications: pd.DataFrame) -> pd.DataFrame:
    pub_by_doi: dict[str, dict[str, Any]] = {}
    for _, row in publications.iterrows():
        doi = normalize_doi(row.get("doi_input")) or normalize_doi(row.get("doi_verified"))
        if doi:
            pub_by_doi[doi] = row.to_dict()

    statuses = []
    titles = []
    authors = []
    authors_full = []
    journals = []
    years = []
    dates = []
    issue_pages = []
    verified_dois = []
    pub_group_keys = []
    for _, record in records.iterrows():
        dois = extract_dois(record.get("doi_raw"))
        matched = [pub_by_doi[d] for d in dois if d in pub_by_doi]
        status_values = [clean(pub.get("validation_status_enriched")) for pub in matched if clean(pub.get("validation_status_enriched"))]
        statuses.append(";".join(sorted(set(status_values))) if status_values else ("missing_doi" if not dois else "doi_not_in_publication_table"))
        titles.append(" | ".join(dict.fromkeys(clean(pub.get("title_verified")) or "" for pub in matched if clean(pub.get("title_verified")))) or None)
        authors.append(" | ".join(dict.fromkeys(clean(pub.get("authors_short_verified")) or "" for pub in matched if clean(pub.get("authors_short_verified")))) or None)
        authors_full.append(" | ".join(dict.fromkeys(clean(pub.get("authors_full_verified")) or "" for pub in matched if clean(pub.get("authors_full_verified")))) or None)
        journals.append(" | ".join(dict.fromkeys(clean(pub.get("journal_verified")) or "" for pub in matched if clean(pub.get("journal_verified")))) or None)
        years.append(" | ".join(dict.fromkeys(str(int(float(pub.get("year_verified")))) for pub in matched if clean(pub.get("year_verified")))) or None)
        dates.append(" | ".join(dict.fromkeys(clean(pub.get("published_date_verified")) or "" for pub in matched if clean(pub.get("published_date_verified")))) or None)
        issue_pages.append(" | ".join(dict.fromkeys(clean(pub.get("issue_pages_verified")) or "" for pub in matched if clean(pub.get("issue_pages_verified")))) or None)
        verified_dois.append(";".join(dict.fromkeys(clean(pub.get("doi_verified")) or "" for pub in matched if clean(pub.get("doi_verified")))) or None)
        if dois:
            pub_group_keys.append(dois[0])
        elif clean(record.get("url_raw")):
            pub_group_keys.append(clean(record.get("url_raw")))
        elif clean(record.get("reference_keys")):
            pub_group_keys.append(f"ref:{record.get('reference_keys')}")
        else:
            pub_group_keys.append(f"source:{record.get('source_file')}:{record.get('source_sheet')}:{record.get('source_row')}")

    records = records.copy()
    records["doi_verified"] = verified_dois
    records["publication_validation_status"] = statuses
    records["publication_title_verified"] = titles
    records["publication_authors_short_verified"] = authors
    records["publication_authors_full_verified"] = authors_full
    records["publication_journal_verified"] = journals
    records["publication_year_verified"] = years
    records["publication_published_date_verified"] = dates
    records["publication_issue_pages_verified"] = issue_pages
    records["publication_group_key"] = pub_group_keys
    group_counts = records["publication_group_key"].value_counts()
    records["publication_group_record_count"] = records["publication_group_key"].map(group_counts).astype(int)
    return records


def required_action(row: pd.Series) -> str:
    actions: list[str] = []
    issue_types = clean(row.get("issue_types")) or ""
    pub_status = clean(row.get("publication_validation_status")) or ""
    source_class = clean(row.get("source_citation_class")) or ""
    non_literature_comparator = source_class in {
        "commercial_or_web_specsheet_comparator",
        "mixed_peer_reviewed_and_commercial_comparator",
    }
    if "not_found" in pub_status or "doi_validation" in issue_types:
        actions.append("fix_or_remove_bad_doi")
    if "missing_doi" in pub_status and non_literature_comparator:
        actions.append("review_non_literature_comparator_disclosure")
    elif "missing_doi" in pub_status:
        actions.append("find_primary_publication")
    if "missing_reference" in issue_types:
        actions.append("find_primary_publication")
    if "unit_inference" in issue_types:
        actions.append("verify_tensile_strength_unit")
    if "missing_conditions" in issue_types:
        actions.append("extract_test_conditions")
    if int(row.get("publication_group_record_count") or 0) > 1:
        actions.append("check_duplicate_or_multi_sample_group")
    actions = list(dict.fromkeys(actions))
    return ";".join(actions) if actions else "ready_for_manual_review"


def build_review_queue(records: pd.DataFrame, issues: pd.DataFrame, publications: pd.DataFrame) -> pd.DataFrame:
    issue_map = flatten_issue_map(issues)
    queue = records.merge(issue_map, on="record_id", how="left")
    queue["issue_types"] = queue["issue_types"].fillna("")
    queue["issue_messages"] = queue["issue_messages"].fillna("")
    queue["issue_count"] = queue["issue_count"].fillna(0).astype(int)
    queue = add_publication_status(queue, publications)
    queue["required_action"] = queue.apply(required_action, axis=1)
    queue["curation_decision"] = "needs_review"
    queue["include_public"] = ""
    queue["reviewer"] = ""
    queue["review_date"] = ""
    queue["confidence_score_reviewed"] = ""
    for column in REVIEW_COLUMNS:
        if column.startswith("official_"):
            source_col = column.replace("official_", "")
            queue[column] = queue[source_col] if source_col in queue.columns else ""
    queue["duplicate_group_id"] = ""
    queue["primary_record_id"] = ""
    queue["curation_notes"] = ""

    important_cols = REVIEW_COLUMNS + [
        "required_action",
        "record_id",
        "source_file",
        "source_sheet",
        "source_row",
        "record_label",
        "sample_name",
        "material_family",
        "form_factor",
        "cnt_type",
        "synthesis_method",
        "postprocessing",
        "comparison_scope",
        "source_citation_class",
        "evidence_tier",
        "comparison_note",
        "doi_raw",
        "doi_verified",
        "url_raw",
        "publication_validation_status",
        "publication_title_verified",
        "publication_authors_short_verified",
        "publication_authors_full_verified",
        "publication_journal_verified",
        "publication_year_verified",
        "publication_published_date_verified",
        "publication_issue_pages_verified",
        "publication_group_key",
        "publication_group_record_count",
        "issue_types",
        "issue_count",
        "issue_messages",
        "density_g_cm3_raw",
        "density_kg_m3",
        "specific_volume_m3_kg",
        "diameter_um_raw",
        "diameter_m",
        "linear_density_tex_raw",
        "linear_density_kg_m",
        "tenacity_N_tex_raw",
        "specific_strength_N_m_kg",
        "tensile_strength_GPa_raw",
        "tensile_strength_GPa",
        "tensile_strength_Pa",
        "tensile_strength_unit_inference",
        "initial_modulus_N_tex_raw",
        "specific_modulus_N_m_kg",
        "initial_modulus_GPa",
        "initial_modulus_Pa",
        "breaking_strain_pct_raw",
        "breaking_strain_fraction",
        "rupture_work_J_g_raw",
        "rupture_work_J_kg",
        "electrical_conductivity_S_cm_raw",
        "electrical_conductivity_MS_m_raw",
        "electrical_conductivity_S_m",
        "specific_electrical_conductivity_S_m2_kg",
        "thermal_conductivity_W_mK_raw",
        "thermal_conductivity_W_mK",
        "specific_thermal_conductivity_W_m2_K_kg",
        "g_d_ratio_raw",
        "g_d_ratio",
        "ampacity_A_cm2_raw",
        "ampacity_A_m2",
        "ampacity_gauge_length_mm",
        "condition_temperature_C",
        "condition_atmosphere",
        "measurement_method",
        "gauge_length_mm",
        "strain_rate_s_inv",
        "provenance_table_figure_page",
        "secondary_source_doi_raw",
        "secondary_source_title",
        "secondary_source_authors_short",
        "secondary_source_journal",
        "secondary_source_year",
        "original_reference_raw",
        "doi_resolution_status",
        "doi_resolution_score",
        "duplicate_of_record_id",
        "duplicate_match_score",
        "source_export",
        "extraction_method",
        "citation_raw",
        "source_citation_raw",
    ]
    existing = [col for col in important_cols if col in queue.columns]
    remaining = [col for col in queue.columns if col not in existing and not col.endswith("_raw")]
    queue = queue[existing + remaining]

    material_rank = {
        "CNT_or_CNT_hybrid": 0,
        "graphene_or_GO_fiber": 1,
        "CNT_metal_composite": 2,
        "carbon_fiber_comparator": 3,
        "other_carbon_comparator": 4,
        "polymer_fiber_comparator": 5,
        "metal_comparator": 6,
        "ceramic_or_glass_comparator": 7,
    }
    action_rank = queue["required_action"].str.contains("fix_or_remove_bad_doi", na=False).astype(int) * -10
    queue["_sort_material"] = queue["material_family"].map(material_rank).fillna(9)
    queue["_sort_action"] = action_rank
    queue = queue.sort_values(["_sort_action", "_sort_material", "issue_count", "source_priority", "source_row"], ascending=[True, True, False, True, True])
    return queue.drop(columns=["_sort_material", "_sort_action"])


def property_coverage(records: pd.DataFrame) -> pd.DataFrame:
    properties = [
        ("density", "density_kg_m3"),
        ("specific_volume", "specific_volume_m3_kg"),
        ("diameter", "diameter_m"),
        ("linear_density", "linear_density_kg_m"),
        ("specific_strength", "specific_strength_N_m_kg"),
        ("tensile_strength", "tensile_strength_Pa"),
        ("specific_modulus", "specific_modulus_N_m_kg"),
        ("initial_modulus", "initial_modulus_Pa"),
        ("breaking_strain", "breaking_strain_fraction"),
        ("work_of_rupture", "rupture_work_J_kg"),
        ("electrical_conductivity", "electrical_conductivity_S_m"),
        ("specific_electrical_conductivity", "specific_electrical_conductivity_S_m2_kg"),
        ("thermal_conductivity", "thermal_conductivity_W_mK"),
        ("specific_thermal_conductivity", "specific_thermal_conductivity_W_m2_K_kg"),
        ("g_d_ratio", "g_d_ratio"),
        ("ampacity", "ampacity_A_m2"),
    ]
    rows = []
    for family, sub in records.groupby("material_family", dropna=False):
        for prop, field in properties:
            rows.append(
                {
                    "material_family": family,
                    "property": prop,
                    "field": field,
                    "records_with_value": int(sub[field].notna().sum()) if field in sub else 0,
                    "records_total": int(len(sub)),
                    "coverage_fraction": round(float(sub[field].notna().mean()), 4) if field in sub and len(sub) else 0,
                }
            )
    return pd.DataFrame(rows)


def issue_summary(issues: pd.DataFrame, records: pd.DataFrame) -> pd.DataFrame:
    if issues.empty:
        return pd.DataFrame(columns=["issue_type", "records", "issue_rows"])
    by_type = issues.groupby("issue_type").agg(records=("record_id", "nunique"), issue_rows=("issue_id", "count")).reset_index()
    by_family = issues.merge(records[["record_id", "material_family"]], on="record_id", how="left")
    family_counts = by_family.groupby(["issue_type", "material_family"]).size().reset_index(name="count")
    family_summary = family_counts.groupby("issue_type").apply(
        lambda df: "; ".join(f"{row.material_family}:{row['count']}" for _, row in df.sort_values("count", ascending=False).iterrows()),
        include_groups=False,
    )
    by_type["by_material_family"] = by_type["issue_type"].map(family_summary)
    return by_type.sort_values(["records", "issue_type"], ascending=[False, True])


def dataframe_to_jsonable(df: pd.DataFrame, max_rows: int | None = None) -> list[list[Any]]:
    if max_rows is not None:
        df = df.head(max_rows)
    clean_df = df.astype(object).where(pd.notna(df), None)
    rows: list[list[Any]] = [list(clean_df.columns)]
    rows.extend(clean_df.values.tolist())
    return rows


def build_payload(queue: pd.DataFrame, pubs: pd.DataFrame, issues_df: pd.DataFrame, coverage_df: pd.DataFrame) -> dict[str, Any]:
    readme = pd.DataFrame(
        [
            {"Field": "Purpose", "Value": "Manual curation workbook for CNT property database seed records."},
            {"Field": "Public rule", "Value": "Only set include_public=Yes after DOI/source, units, duplicate status, sample metadata, and conditions are reviewed."},
            {"Field": "Strict comparison", "Value": "Same material form, same property basis, compatible method/conditions."},
            {"Field": "Normalized comparison", "Value": "Different samples allowed when normalized metrics are defensible."},
            {"Field": "Exploratory comparison", "Value": "Cross-form comparison allowed only with visible flags."},
            {"Field": "Condition blocker", "Value": "Missing gauge length, strain rate, method, atmosphere, or temperature prevents true strict comparison."},
            {"Field": "Comparator disclosure", "Value": "Commercial, MatWeb, or manufacturer-source comparator rows are contextual engineering benchmarks and must be visibly labeled in public plots."},
        ]
    )
    validation_summary = pubs["validation_status_enriched"].value_counts(dropna=False).rename_axis("validation_status").reset_index(name="count")
    decision_lists = pd.DataFrame(
        {
            "curation_decision": pd.Series(["needs_review", "accept", "reject", "merge_duplicate", "needs_source_lookup"]),
            "include_public": pd.Series(["", "Yes", "No"]),
            "confidence_score_reviewed": pd.Series(["", "1", "2", "3", "4", "5"]),
            "official_form_factor": pd.Series(["fiber_yarn", "sheet_mat_film", "buckypaper", "foam_aerogel", "forest_array", "individual_nanotube_or_bundle", "bulk", "unknown"]),
            "official_material_family": pd.Series(
                [
                    "CNT_or_CNT_hybrid",
                    "graphene_or_GO_fiber",
                    "CNT_metal_composite",
                    "carbon_fiber_comparator",
                    "other_carbon_comparator",
                    "polymer_fiber_comparator",
                    "metal_comparator",
                    "ceramic_or_glass_comparator",
                ]
            ),
        }
    )
    return {
        "sheets": {
            "README": dataframe_to_jsonable(readme),
            "Review Queue": dataframe_to_jsonable(queue),
            "Publication Queue": dataframe_to_jsonable(pubs),
            "Issue Summary": dataframe_to_jsonable(issues_df),
            "Property Coverage": dataframe_to_jsonable(coverage_df),
            "Validation Summary": dataframe_to_jsonable(validation_summary),
            "Dropdown Values": dataframe_to_jsonable(decision_lists),
        }
    }


def main() -> None:
    CURATION.mkdir(parents=True, exist_ok=True)
    records = pd.read_csv(PROCESSED / "combined_records.csv")
    issues = pd.read_csv(PROCESSED / "source_issues.csv")
    pubs = pd.read_csv(PROCESSED / "publications_enriched.csv")

    queue = build_review_queue(records, issues, pubs)
    coverage_df = property_coverage(records)
    issues_df = issue_summary(issues, records)

    queue.to_csv(CURATION / "record_curation_queue.csv", index=False)
    pubs.to_csv(CURATION / "publication_curation_queue.csv", index=False)
    issues_df.to_csv(CURATION / "issue_summary.csv", index=False)
    coverage_df.to_csv(CURATION / "property_coverage_summary.csv", index=False)

    payload = build_payload(queue, pubs, issues_df, coverage_df)
    (CURATION / "workbook_payload.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    summary = {
        "record_curation_rows": len(queue),
        "publication_curation_rows": len(pubs),
        "issue_summary_rows": len(issues_df),
        "property_coverage_rows": len(coverage_df),
        "top_required_actions": queue["required_action"].value_counts().head(10).to_dict(),
        "outputs": sorted(path.name for path in CURATION.iterdir() if path.is_file()),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
