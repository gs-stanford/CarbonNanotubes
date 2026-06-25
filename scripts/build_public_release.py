#!/usr/bin/env python3
"""Build public v0 candidate datasets from the curated CNT property database.

Outputs:
  data/public/public_records_v0.csv
  data/public/public_measurements_v0.csv
  data/public/public_publications_v0.csv
  data/public/public_exclusions_v0.csv
  data/public/public_schema_v0.csv
  data/public/public_release_summary.json
  reports/public_release_v0_report.md
"""

from __future__ import annotations

import json
import hashlib
import re
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
CURATION = ROOT / "data" / "curation"
PUBLIC = ROOT / "data" / "public"
REPORTS = ROOT / "reports"

DOI_RE = re.compile(r"10\.\d{4,9}/[-._()/:A-Z0-9]+", re.I)

MEASUREMENT_FIELDS = [
    "density_kg_m3",
    "specific_volume_m3_kg",
    "diameter_m",
    "linear_density_kg_m",
    "specific_strength_N_m_kg",
    "tensile_strength_Pa",
    "specific_modulus_N_m_kg",
    "initial_modulus_Pa",
    "breaking_strain_fraction",
    "rupture_work_J_kg",
    "electrical_conductivity_S_m",
    "specific_electrical_conductivity_S_m2_kg",
    "thermal_conductivity_W_mK",
    "specific_thermal_conductivity_W_m2_K_kg",
    "g_d_ratio",
    "ampacity_A_m2",
]

PUBLIC_RECORD_COLUMNS = [
    "record_id",
    "public_release_status",
    "public_release_tier",
    "default_plot_visibility",
    "public_plot_badge",
    "source_publication_type",
    "value_extraction_type",
    "source_disclosure",
    "citation_requirement",
    "peer_reviewed_measurement",
    "contextual_benchmark",
    "commercial_specsheet_benchmark",
    "secondary_meta_analysis_record",
    "missing_conditions",
    "unit_inference_review_needed",
    "cross_form_comparison",
    "strict_comparison_candidate",
    "strict_comparison_ready",
    "normalized_comparison_eligible",
    "exploratory_comparison_eligible",
    "record_label",
    "sample_name",
    "public_sample_label",
    "canonical_record_id",
    "duplicate_group_id",
    "duplicate_group_size",
    "duplicate_group_role",
    "material_family",
    "form_factor",
    "cnt_type",
    "synthesis_method",
    "postprocessing",
    "comparison_scope",
    "source_citation_class",
    "evidence_tier",
    "doi_raw",
    "doi_verified",
    "url_raw",
    "publication_validation_status",
    "publication_title_verified",
    "publication_journal_verified",
    "publication_authors_full_verified",
    "publication_year_verified",
    "publication_published_date_verified",
    "publication_issue_pages_verified",
    "publication_group_key",
    "issue_types",
    "required_action",
    "density_kg_m3",
    "specific_volume_m3_kg",
    "diameter_m",
    "linear_density_kg_m",
    "specific_strength_N_m_kg",
    "tensile_strength_GPa",
    "tensile_strength_Pa",
    "specific_modulus_N_m_kg",
    "initial_modulus_GPa",
    "initial_modulus_Pa",
    "breaking_strain_fraction",
    "rupture_work_J_kg",
    "electrical_conductivity_S_m",
    "specific_electrical_conductivity_S_m2_kg",
    "thermal_conductivity_W_mK",
    "specific_thermal_conductivity_W_m2_K_kg",
    "g_d_ratio",
    "ampacity_A_m2",
    "ampacity_gauge_length_mm",
    "condition_temperature_C",
    "condition_atmosphere",
    "measurement_method",
    "gauge_length_mm",
    "strain_rate_s_inv",
    "provenance_table_figure_page",
    "publication_authors_short_verified",
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
    "duplicate_exclusion_reason",
    "citation_raw",
    "source_citation_raw",
    "source_file",
    "source_sheet",
    "source_row",
]

NORMALIZED_PROPERTIES = {
    "density",
    "specific_volume",
    "specific_strength",
    "specific_modulus",
    "specific_electrical_conductivity",
    "specific_thermal_conductivity",
}

PRIMARY_RESEARCH_MATERIALS = {"CNT_or_CNT_hybrid", "graphene_or_GO_fiber", "CNT_metal_composite"}


def clean(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    return text


def stable_id(prefix: str, *parts: Any) -> str:
    raw = "|".join("" if part is None else str(part) for part in parts)
    return f"{prefix}_{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:12]}"


def split_values(value: Any) -> list[str]:
    text = clean(value)
    if not text:
        return []
    return [part.strip() for part in text.split(";") if part.strip()]


def extract_dois(value: Any) -> list[str]:
    out: set[str] = set()
    for part in split_values(value):
        out.update(match.group(0).rstrip(" .,)];").lower() for match in DOI_RE.finditer(part))
    return sorted(out)


def issue_set(row: pd.Series) -> set[str]:
    return set(split_values(row.get("issue_types")))


def has_measurements(row: pd.Series) -> bool:
    return any(pd.notna(row.get(field)) for field in MEASUREMENT_FIELDS if field in row.index)


def normalized_text(value: Any) -> str:
    text = clean(value) or ""
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def bad_public_label(value: Any) -> bool:
    text = clean(value)
    if not text:
        return True
    lower = text.lower()
    return bool(re.fullmatch(r"\(?\d+\)?", text) or lower in {"unknown", "not reported", "not reported/ can not calculate", "nan"})


def public_sample_label(row: pd.Series) -> str:
    sample = clean(row.get("sample_name"))
    label = clean(row.get("record_label"))
    if sample and not bad_public_label(sample):
        return sample
    if label and not bad_public_label(label):
        return label
    title = clean(row.get("publication_title_verified")) or clean(row.get("publication_title"))
    family = clean(row.get("material_family")) or "Material"
    form = clean(row.get("form_factor")) or "sample"
    year = clean(row.get("publication_year_verified")) or clean(row.get("publication_year"))
    if title:
        first_words = " ".join(title.split()[:5])
        return f"{family} {form} from {first_words}"
    return " ".join(part for part in [family, form, year] if part)


def release_decision(row: pd.Series) -> dict[str, Any]:
    source_class = clean(row.get("source_citation_class")) or "unknown"
    material_family = clean(row.get("material_family")) or "unknown"
    pub_status = clean(row.get("publication_validation_status")) or "missing_doi"
    issues = issue_set(row)
    has_values = has_measurements(row)

    peer_reviewed_measurement = (
        source_class == "peer_reviewed_research_record"
        and pub_status == "verified_crossref_openalex"
        and material_family in PRIMARY_RESEARCH_MATERIALS
    )
    literature_backed_benchmark = (
        source_class in {"mixed_peer_reviewed_and_commercial_comparator", "peer_reviewed_comparator"}
        and pub_status == "verified_crossref_openalex"
    )
    commercial_benchmark = source_class == "commercial_or_web_specsheet_comparator"
    secondary_meta_analysis = (
        source_class == "peer_reviewed_meta_analysis_record"
        and pub_status == "verified_crossref_openalex"
        and clean(row.get("doi_resolution_status")) == "accepted"
    )
    secondary_research = secondary_meta_analysis and material_family in PRIMARY_RESEARCH_MATERIALS
    secondary_contextual_benchmark = secondary_meta_analysis and material_family not in PRIMARY_RESEARCH_MATERIALS
    contextual_benchmark = literature_backed_benchmark or commercial_benchmark or secondary_contextual_benchmark
    peer_reviewed_publication = pub_status == "verified_crossref_openalex" and (
        peer_reviewed_measurement or literature_backed_benchmark or secondary_meta_analysis
    )
    value_extraction_type = "secondary_meta_analysis" if secondary_meta_analysis else "direct_or_source_table"

    missing_conditions = "missing_conditions" in issues
    unit_inference = "unit_inference" in issues
    cross_form = clean(row.get("form_factor")) not in {None, "fiber_yarn"}
    strict_candidate = clean(row.get("comparison_scope")) == "strict_candidate_missing_conditions"
    strict_ready = peer_reviewed_measurement and strict_candidate and not missing_conditions and not unit_inference
    normalized_eligible = peer_reviewed_measurement or secondary_research or contextual_benchmark

    exclusion_reasons: list[str] = []
    if not has_values:
        exclusion_reasons.append("no_canonical_measurements")
    if "duplicate_candidate" in issues or clean(row.get("duplicate_of_record_id")):
        exclusion_reasons.append("secondary_duplicate_of_higher_priority_record")
    if source_class == "url_only_research_record":
        exclusion_reasons.append("research_record_url_only_needs_doi")
    if source_class == "unresolved_or_internal_source":
        exclusion_reasons.append("internal_seed_or_unresolved_source")
    if source_class == "peer_reviewed_research_record" and pub_status != "verified_crossref_openalex":
        exclusion_reasons.append("doi_not_verified_for_public_release")
    if source_class == "unknown":
        exclusion_reasons.append("unknown_source_class")

    include = has_values and (peer_reviewed_measurement or contextual_benchmark or secondary_meta_analysis) and "secondary_duplicate_of_higher_priority_record" not in exclusion_reasons
    if not include and not exclusion_reasons:
        exclusion_reasons.append("not_in_public_v0_release_rule")

    if peer_reviewed_measurement or secondary_research:
        tier = "peer_reviewed_research"
        status = "include_v0_primary_literature_candidate"
        default_visibility = "default_on"
        badge = "Peer-reviewed research"
        disclosure = "DOI-backed peer-reviewed research record. Secondary-extracted values carry a separate extraction warning."
    elif literature_backed_benchmark or secondary_contextual_benchmark:
        tier = "peer_reviewed_contextual_comparator"
        status = "include_v0_peer_reviewed_contextual_comparator"
        default_visibility = "default_on_as_benchmark"
        badge = "Peer-reviewed comparator"
        disclosure = "DOI-backed comparator or benchmark value. Use only as contextual comparison unless material/form/conditions match the target comparison."
    elif commercial_benchmark:
        tier = "commercial_contextual_comparator"
        status = "include_v0_contextual_benchmark_non_peer_reviewed"
        default_visibility = "default_off_optional_benchmark"
        badge = "Commercial/spec-sheet benchmark"
        disclosure = "Comparator benchmark from manufacturer, MatWeb, or web/spec-sheet source; show only as contextual engineering benchmark."
    else:
        tier = "excluded_internal"
        status = "exclude_v0"
        default_visibility = "not_public"
        badge = "Internal only"
        disclosure = "Excluded from public v0: " + "; ".join(exclusion_reasons)

    if commercial_benchmark:
        source_publication_type = "commercial_or_specsheet"
    elif peer_reviewed_publication:
        source_publication_type = "peer_reviewed_journal"
    elif pub_status == "verified_crossref_openalex":
        source_publication_type = "doi_verified_source"
    else:
        source_publication_type = "unverified_or_internal"

    return {
        "include_public_v0": include,
        "public_release_status": status,
        "public_release_tier": tier,
        "default_plot_visibility": default_visibility,
        "public_plot_badge": badge,
        "source_publication_type": source_publication_type,
        "value_extraction_type": value_extraction_type,
        "source_disclosure": disclosure,
        "citation_requirement": "Cite the original source and the CNT property database when using plotted values.",
        "peer_reviewed_measurement": peer_reviewed_measurement,
        "contextual_benchmark": contextual_benchmark,
        "commercial_specsheet_benchmark": commercial_benchmark or source_class == "mixed_peer_reviewed_and_commercial_comparator",
        "secondary_meta_analysis_record": secondary_meta_analysis,
        "missing_conditions": missing_conditions,
        "unit_inference_review_needed": unit_inference,
        "cross_form_comparison": cross_form,
        "strict_comparison_candidate": strict_candidate,
        "strict_comparison_ready": strict_ready,
        "normalized_comparison_eligible": normalized_eligible or secondary_meta_analysis,
        "exploratory_comparison_eligible": include,
        "exclusion_reasons": ";".join(exclusion_reasons),
        "public_sample_label": public_sample_label(row),
        "canonical_record_id": clean(row.get("record_id")),
        "duplicate_group_id": None,
        "duplicate_group_size": 1,
        "duplicate_group_role": "unique",
        "duplicate_exclusion_reason": None,
    }


def enrich_records(queue: pd.DataFrame) -> pd.DataFrame:
    decisions = queue.apply(release_decision, axis=1, result_type="expand")
    base = queue.copy().drop(columns=[column for column in decisions.columns if column in queue.columns])
    enriched = pd.concat([base, decisions], axis=1)
    return enriched


def row_doi_set(row: pd.Series) -> set[str]:
    dois = set(extract_dois(row.get("doi_verified")) + extract_dois(row.get("doi_raw")))
    return {doi.lower() for doi in dois if doi}


def publication_fallback_key(row: pd.Series) -> str:
    dois = row_doi_set(row)
    if dois:
        return "doi:" + "|".join(sorted(dois))
    title = normalized_text(row.get("publication_title_verified") or row.get("publication_title") or row.get("citation_raw"))
    year = clean(row.get("publication_year_verified") or row.get("publication_year"))
    if title:
        return f"title:{title}|{year or ''}"
    url = clean(row.get("url_raw"))
    if url:
        return f"url:{url.lower()}"
    return f"record:{clean(row.get('record_id'))}"


def close_enough(a: Any, b: Any, tolerance: float = 0.025) -> bool:
    if pd.isna(a) or pd.isna(b):
        return False
    try:
        av = float(a)
        bv = float(b)
    except (TypeError, ValueError):
        return False
    scale = max(abs(av), abs(bv), 1.0)
    return abs(av - bv) <= tolerance * scale


def measurement_overlap(row_a: pd.Series, row_b: pd.Series) -> tuple[int, int, list[str]]:
    overlaps = [field for field in MEASUREMENT_FIELDS if field in row_a.index and field in row_b.index and pd.notna(row_a.get(field)) and pd.notna(row_b.get(field))]
    matches = [field for field in overlaps if close_enough(row_a.get(field), row_b.get(field))]
    return len(matches), len(overlaps), matches


def row_label_aliases(row: pd.Series) -> set[str]:
    aliases = {
        normalized_text(row.get("public_sample_label")),
        normalized_text(row.get("sample_name")),
        normalized_text(row.get("record_label")),
    }
    return {alias for alias in aliases if alias and alias not in {"data", "score", "unknown"}}


def duplicate_pair(row_a: pd.Series, row_b: pd.Series) -> tuple[bool, float, str]:
    if clean(row_a.get("material_family")) != clean(row_b.get("material_family")):
        return False, 0.0, "different_material_family"
    if clean(row_a.get("form_factor")) != clean(row_b.get("form_factor")):
        return False, 0.0, "different_form_factor"

    dois_a = row_doi_set(row_a)
    dois_b = row_doi_set(row_b)
    same_publication = bool(dois_a.intersection(dois_b)) or publication_fallback_key(row_a) == publication_fallback_key(row_b)
    if not same_publication:
        return False, 0.0, "different_publication"

    matches, overlaps, matched_fields = measurement_overlap(row_a, row_b)
    if overlaps == 0:
        return False, 0.0, "no_measurement_overlap"
    score = matches / overlaps
    same_label = bool(row_label_aliases(row_a).intersection(row_label_aliases(row_b)))
    secondary_involved = bool(row_a.get("secondary_meta_analysis_record")) or bool(row_b.get("secondary_meta_analysis_record"))

    if overlaps >= 2 and matches == overlaps and (same_label or secondary_involved):
        return True, score, "same DOI/material/form/sample and all overlapping measurements match"
    return False, score, f"{matches}/{overlaps} measurements matched"


def duplicate_priority(row: pd.Series) -> tuple[int, int, int, int, int]:
    source_file = clean(row.get("source_file")) or ""
    source_class = clean(row.get("source_citation_class")) or ""
    extraction_type = clean(row.get("value_extraction_type")) or ""
    if source_class == "peer_reviewed_research_record" and source_file == "literature_addendum_records.tsv":
        source_rank = 0
    elif source_class == "peer_reviewed_research_record":
        source_rank = 1
    elif extraction_type == "secondary_meta_analysis":
        source_rank = 4
    elif bool(row.get("contextual_benchmark")):
        source_rank = 5
    else:
        source_rank = 3
    measurement_count = sum(pd.notna(row.get(field)) for field in MEASUREMENT_FIELDS if field in row.index)
    missing_penalty = 1 if bool(row.get("missing_conditions")) else 0
    unit_penalty = 1 if bool(row.get("unit_inference_review_needed")) else 0
    label_penalty = 1 if bad_public_label(row.get("public_sample_label")) else 0
    return (source_rank, missing_penalty, unit_penalty, label_penalty, -measurement_count)


def apply_duplicate_canonicalization(enriched: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    out = enriched.copy()
    for column in [
        "duplicate_group_id",
        "duplicate_group_role",
        "canonical_record_id",
        "duplicate_exclusion_reason",
        "public_release_status",
        "public_release_tier",
        "default_plot_visibility",
        "exclusion_reasons",
        "duplicate_of_record_id",
    ]:
        if column in out.columns:
            out[column] = out[column].astype("object")
    candidates = out[out["include_public_v0"]].copy()
    if candidates.empty:
        return out, pd.DataFrame()

    candidate_indices = list(candidates.index)
    parent = {idx: idx for idx in candidate_indices}
    pair_reasons: dict[tuple[int, int], tuple[float, str]] = {}

    def find(idx: int) -> int:
        while parent[idx] != idx:
            parent[idx] = parent[parent[idx]]
            idx = parent[idx]
        return idx

    def union(a: int, b: int) -> None:
        ra = find(a)
        rb = find(b)
        if ra != rb:
            parent[rb] = ra

    buckets: dict[tuple[str, str, str], list[int]] = {}
    for idx, row in candidates.iterrows():
        key = (publication_fallback_key(row), clean(row.get("material_family")) or "", clean(row.get("form_factor")) or "")
        buckets.setdefault(key, []).append(idx)

    for indices in buckets.values():
        for pos, idx_a in enumerate(indices):
            row_a = candidates.loc[idx_a]
            for idx_b in indices[pos + 1 :]:
                row_b = candidates.loc[idx_b]
                is_duplicate, score, reason = duplicate_pair(row_a, row_b)
                if is_duplicate:
                    union(idx_a, idx_b)
                    pair_reasons[(idx_a, idx_b)] = (score, reason)

    groups: dict[int, list[int]] = {}
    for idx in candidate_indices:
        groups.setdefault(find(idx), []).append(idx)

    audit_rows: list[dict[str, Any]] = []
    for indices in groups.values():
        if len(indices) == 1:
            continue
        canonical_idx = sorted(indices, key=lambda idx: duplicate_priority(candidates.loc[idx]))[0]
        group_id = stable_id("dupgrp", *sorted(candidates.loc[indices, "record_id"].astype(str).tolist()))
        canonical_record_id = clean(out.at[canonical_idx, "record_id"])
        for idx in indices:
            role = "canonical" if idx == canonical_idx else "duplicate_collapsed"
            out.at[idx, "duplicate_group_id"] = group_id
            out.at[idx, "duplicate_group_size"] = len(indices)
            out.at[idx, "duplicate_group_role"] = role
            out.at[idx, "canonical_record_id"] = canonical_record_id
            if idx != canonical_idx:
                best_pair_score = 0.0
                best_pair_reason = "duplicate of canonical public record"
                for key, (score, reason) in pair_reasons.items():
                    if idx in key or canonical_idx in key:
                        if score >= best_pair_score:
                            best_pair_score = score
                            best_pair_reason = reason
                out.at[idx, "include_public_v0"] = False
                out.at[idx, "public_release_status"] = "exclude_duplicate_collapsed"
                out.at[idx, "public_release_tier"] = "excluded_duplicate"
                out.at[idx, "default_plot_visibility"] = "not_public"
                out.at[idx, "duplicate_of_record_id"] = canonical_record_id
                out.at[idx, "duplicate_match_score"] = round(float(best_pair_score), 4)
                out.at[idx, "duplicate_exclusion_reason"] = best_pair_reason
                reasons = split_values(out.at[idx, "exclusion_reasons"])
                if "duplicate_collapsed_into_canonical_public_record" not in reasons:
                    reasons.append("duplicate_collapsed_into_canonical_public_record")
                out.at[idx, "exclusion_reasons"] = ";".join(reasons)

            audit_rows.append(
                {
                    "duplicate_group_id": group_id,
                    "record_id": clean(out.at[idx, "record_id"]),
                    "duplicate_group_role": role,
                    "canonical_record_id": canonical_record_id,
                    "duplicate_group_size": len(indices),
                    "duplicate_match_score": clean(out.at[idx, "duplicate_match_score"]),
                    "duplicate_exclusion_reason": clean(out.at[idx, "duplicate_exclusion_reason"]),
                    "public_sample_label": clean(out.at[idx, "public_sample_label"]),
                    "source_file": clean(out.at[idx, "source_file"]),
                    "source_row": clean(out.at[idx, "source_row"]),
                    "doi_verified": clean(out.at[idx, "doi_verified"]),
                    "publication_title_verified": clean(out.at[idx, "publication_title_verified"]),
                    "material_family": clean(out.at[idx, "material_family"]),
                    "form_factor": clean(out.at[idx, "form_factor"]),
                    "public_release_tier": clean(out.at[idx, "public_release_tier"]),
                    "value_extraction_type": clean(out.at[idx, "value_extraction_type"]),
                }
            )

    return out, pd.DataFrame(audit_rows)


def build_public_records(enriched: pd.DataFrame) -> pd.DataFrame:
    public = enriched[enriched["include_public_v0"]].copy()
    existing = [col for col in PUBLIC_RECORD_COLUMNS if col in public.columns]
    return public[existing].sort_values(["public_release_tier", "material_family", "publication_year_verified", "sample_name"], na_position="last")


def build_exclusions(enriched: pd.DataFrame) -> pd.DataFrame:
    excluded = enriched[~enriched["include_public_v0"]].copy()
    cols = [
        "record_id",
        "exclusion_reasons",
        "source_citation_class",
        "evidence_tier",
        "publication_validation_status",
        "record_label",
        "sample_name",
        "material_family",
        "form_factor",
        "doi_raw",
        "url_raw",
        "issue_types",
        "required_action",
        "source_file",
        "source_sheet",
        "source_row",
    ]
    existing = [col for col in cols if col in excluded.columns]
    return excluded[existing].sort_values(["exclusion_reasons", "material_family", "source_file", "source_row"], na_position="last")


def build_public_measurements(measurements: pd.DataFrame, public_records: pd.DataFrame) -> pd.DataFrame:
    record_flags = public_records[
        [
            "record_id",
            "public_release_tier",
            "default_plot_visibility",
            "public_plot_badge",
            "peer_reviewed_measurement",
            "contextual_benchmark",
            "commercial_specsheet_benchmark",
            "secondary_meta_analysis_record",
            "missing_conditions",
            "unit_inference_review_needed",
            "cross_form_comparison",
            "strict_comparison_ready",
            "normalized_comparison_eligible",
            "exploratory_comparison_eligible",
            "doi_verified",
            "publication_title_verified",
            "publication_journal_verified",
            "publication_year_verified",
        ]
    ]
    public_measurements = measurements.merge(record_flags, on="record_id", how="inner")
    public_measurements["normalized_metric"] = public_measurements["property"].isin(NORMALIZED_PROPERTIES)
    public_measurements["strict_plot_eligible"] = public_measurements["strict_comparison_ready"]
    public_measurements["normalized_plot_eligible"] = (
        public_measurements["normalized_metric"] & public_measurements["normalized_comparison_eligible"]
    )
    public_measurements["exploratory_plot_eligible"] = public_measurements["exploratory_comparison_eligible"]
    public_measurements["measurement_warning"] = "none"
    tensile_mask = public_measurements["property"].eq("tensile_strength") & public_measurements["unit_inference_review_needed"]
    public_measurements.loc[tensile_mask, "measurement_warning"] = "tensile_strength_unit_inferred_from_source_scale"
    public_measurements.loc[
        public_measurements["commercial_specsheet_benchmark"] & public_measurements["measurement_warning"].eq("none"),
        "measurement_warning",
    ] = "contextual_benchmark_not_primary_peer_reviewed_measurement"
    public_measurements.loc[
        public_measurements["secondary_meta_analysis_record"] & public_measurements["measurement_warning"].eq("none"),
        "measurement_warning",
    ] = "secondary_meta_analysis_value_needs_primary_source_crosscheck"
    sort_cols = ["property", "public_release_tier", "material_family", "record_id"]
    return public_measurements.sort_values(sort_cols)


def build_public_publications(public_records: pd.DataFrame, pubs: pd.DataFrame) -> pd.DataFrame:
    dois = set()
    urls = set()
    for _, row in public_records.iterrows():
        dois.update(extract_dois(row.get("doi_raw")))
        dois.update(extract_dois(row.get("doi_verified")))
        dois.update(extract_dois(row.get("secondary_source_doi_raw")))
        urls.update(split_values(row.get("url_raw")))

    public_pubs = pubs[
        pubs["doi_verified"].map(lambda value: clean(value) in dois)
        | pubs["doi_input"].map(lambda value: clean(value) in dois)
        | pubs["url_input"].map(lambda value: clean(value) in urls)
    ].copy()

    public_pubs["public_source_type"] = public_pubs["validation_status_enriched"].map(
        lambda status: "peer_reviewed_publication" if status == "verified_crossref_openalex" else "web_or_specsheet_source"
    )

    def referenced_count(pub: pd.Series) -> int:
        doi_values = set(extract_dois(pub.get("doi_input")) + extract_dois(pub.get("doi_verified")))
        url_values = set(split_values(pub.get("url_input")))
        count = 0
        for _, record in public_records.iterrows():
            record_dois = set(extract_dois(record.get("doi_raw")) + extract_dois(record.get("doi_verified")))
            record_dois.update(extract_dois(record.get("secondary_source_doi_raw")))
            record_urls = set(split_values(record.get("url_raw")))
            if doi_values.intersection(record_dois) or url_values.intersection(record_urls):
                count += 1
        return count

    public_pubs["source_record_count_public_v0"] = public_pubs.apply(referenced_count, axis=1)
    return public_pubs.sort_values(["public_source_type", "year_verified", "journal_verified"], na_position="last")


def build_public_schema() -> pd.DataFrame:
    rows = [
        ("public_release_status", "Inclusion status assigned by the public v0 release rules."),
        ("public_release_tier", "Peer-reviewed research, peer-reviewed contextual comparator, commercial contextual comparator, or excluded internal row."),
        ("default_plot_visibility", "Frontend hint for whether the point should be visible by default."),
        ("public_plot_badge", "Short label for legends/tooltips."),
        ("source_publication_type", "Publication/source quality: peer-reviewed journal, DOI-verified source, commercial/spec-sheet, or internal/unverified."),
        ("value_extraction_type", "Whether the plotted value was extracted directly from a source table/figure in this pipeline or imported from a peer-reviewed secondary/meta-analysis dataset."),
        ("public_sample_label", "Clean public-facing sample label; raw workbook IDs such as `(39)` are not used as primary public titles."),
        ("source_disclosure", "Public wording explaining how to interpret the source."),
        ("citation_requirement", "Required citation instruction for use of plotted values."),
        ("peer_reviewed_measurement", "True only for DOI-verified CNT/graphene research records."),
        ("contextual_benchmark", "True for non-CNT comparator/reference materials."),
        ("commercial_specsheet_benchmark", "True when commercial, MatWeb, manufacturer, or mixed commercial provenance is involved."),
        ("secondary_meta_analysis_record", "True when the row comes from a peer-reviewed secondary/meta-analysis workbook with original DOI resolved but values not independently re-extracted in this pipeline."),
        ("missing_conditions", "True when method, atmosphere, gauge length, strain rate, or other strict-comparison metadata are missing."),
        ("unit_inference_review_needed", "True when a raw unit/scale was inferred and should be visibly reviewed before final official release."),
        ("cross_form_comparison", "True when form factor is not fiber_yarn; cross-form plots must be visually flagged."),
        ("strict_comparison_candidate", "True when the row could become strict-comparison eligible after condition metadata are curated."),
        ("strict_comparison_ready", "True only when strict-comparison requirements are currently met."),
        ("normalized_comparison_eligible", "True when normalized/Ashby-style comparison is defensible with visible source flags."),
        ("exploratory_comparison_eligible", "True for all records included in public v0 exploratory plots."),
        ("normalized_metric", "Measurement-level flag for density/specific-property metrics used in normalized comparisons."),
        ("strict_plot_eligible", "Measurement-level flag mirroring strict_comparison_ready."),
        ("normalized_plot_eligible", "Measurement-level flag for normalized metrics on normalized-eligible records."),
        ("exploratory_plot_eligible", "Measurement-level flag for v0 exploratory plotting."),
        ("measurement_warning", "Measurement-level warning text for inferred units or non-primary benchmark provenance."),
        ("exclusion_reasons", "Semicolon-delimited reason a source record was excluded from public v0."),
        ("secondary_source_*", "Citation metadata for a peer-reviewed compilation source such as the Bulmer/James meta-analysis workbook."),
        ("duplicate_of_record_id", "Higher-priority public/internal record that appears to duplicate this secondary row."),
        ("duplicate_group_*", "Canonicalized duplicate group metadata used to prevent duplicate source rows from plotting as independent scientific points."),
        ("canonical_record_id", "Record ID selected as the canonical plotted representative of a duplicate group."),
    ]
    return pd.DataFrame(rows, columns=["field", "description"])


def write_report(summary: dict[str, Any], public_records: pd.DataFrame, exclusions: pd.DataFrame) -> None:
    tier_counts = public_records["public_release_tier"].value_counts().to_dict()
    material_counts = public_records["material_family"].value_counts().to_dict()
    exclusion_counts = exclusions["exclusion_reasons"].value_counts().to_dict()
    strict_ready = int(public_records["strict_comparison_ready"].sum())
    normalized_ready = int(public_records["normalized_comparison_eligible"].sum())
    exploratory_ready = int(public_records["exploratory_comparison_eligible"].sum())

    lines = [
        "# Public CNT Property Dataset v0 Report",
        "",
        "Generated from the internal processed and curation tables.",
        "",
        "## Output Files",
        "",
        "| File | Purpose |",
        "| --- | --- |",
        "| `data/public/public_records_v0.csv` | Public candidate row-level records with source/evidence flags. |",
        "| `data/public/public_measurements_v0.csv` | Long-form measurements filtered to public candidate records. |",
        "| `data/public/public_publications_v0.csv` | Source/publication rows referenced by public candidate records. |",
        "| `data/public/public_exclusions_v0.csv` | Internal records excluded from public v0 with explicit reasons. |",
        "| `data/public/public_schema_v0.csv` | Field descriptions for public release flags. |",
        "| `data/public/public_release_summary.json` | Machine-readable counts and release-rule summary. |",
        "",
        "## Release Rules",
        "",
        "- Include DOI-verified CNT/graphene/CNT-metal records as `peer_reviewed_research` candidates.",
        "- Treat Crossref/OpenAlex-resolved James/Bulmer rows as DOI-backed source records with `value_extraction_type=secondary_meta_analysis`, not as a material or legend class.",
        "- Include DOI-backed non-target materials as `peer_reviewed_contextual_comparator` and manufacturer/MatWeb/spec-sheet rows as `commercial_contextual_comparator`.",
        "- Collapse duplicate source rows into a single canonical public record using DOI, material/form, and canonical measurement-vector agreement.",
        "- Exclude URL-only research records, unresolved internal seed rows, records with unverified DOI status, and rows without canonical measurements.",
        "- Do not treat contextual benchmark rows as primary CNT measurements.",
        "",
        "## Counts",
        "",
        f"- Internal records assessed: {summary['records_assessed']}",
        f"- Public candidate records: {summary['public_records']}",
        f"- Public candidate measurements: {summary['public_measurements']}",
        f"- Public source/publication rows: {summary['public_publications']}",
        f"- Excluded internal records: {summary['excluded_records']}",
        f"- Strict-comparison-ready records: {strict_ready}",
        f"- Normalized/exploratory candidate records: {normalized_ready}/{exploratory_ready}",
        "",
        "## Public Records By Tier",
        "",
        "| Tier | Records |",
        "| --- | ---: |",
    ]
    for tier, count in tier_counts.items():
        lines.append(f"| `{tier}` | {count} |")
    lines.extend(["", "## Public Records By Material Family", "", "| Material family | Records |", "| --- | ---: |"])
    for material, count in material_counts.items():
        lines.append(f"| `{material}` | {count} |")
    lines.extend(["", "## Exclusion Reasons", "", "| Reason | Records |", "| --- | ---: |"])
    for reason, count in exclusion_counts.items():
        lines.append(f"| `{reason}` | {count} |")
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "The v0 public layer is suitable for building the website data API and exploratory plots. It is not yet an official final dataset.",
            "",
            "Strict comparison is intentionally conservative: current CNT fiber rows still lack structured method, atmosphere, gauge-length, and strain-rate metadata, so they are flagged as candidates rather than strict-ready records.",
            "",
            "Commercial, MatWeb, and manufacturer-source rows are included only to support contextual Ashby-style benchmarks. The website should keep them out of strict filters and label them visibly in legends/tooltips.",
        ]
    )
    (REPORTS / "public_release_v0_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    queue = pd.read_csv(CURATION / "record_curation_queue.csv")
    measurements = pd.read_csv(PROCESSED / "measurements_long.csv")
    pubs = pd.read_csv(PROCESSED / "publications_enriched.csv")

    enriched = enrich_records(queue)
    enriched, duplicate_audit = apply_duplicate_canonicalization(enriched)
    public_records = build_public_records(enriched)
    exclusions = build_exclusions(enriched)
    public_measurements = build_public_measurements(measurements, public_records)
    public_pubs = build_public_publications(public_records, pubs)
    public_schema = build_public_schema()

    public_records.to_csv(PUBLIC / "public_records_v0.csv", index=False)
    public_measurements.to_csv(PUBLIC / "public_measurements_v0.csv", index=False)
    public_pubs.to_csv(PUBLIC / "public_publications_v0.csv", index=False)
    exclusions.to_csv(PUBLIC / "public_exclusions_v0.csv", index=False)
    public_schema.to_csv(PUBLIC / "public_schema_v0.csv", index=False)
    duplicate_audit.to_csv(PUBLIC / "public_duplicate_audit_v0.csv", index=False)

    summary = {
        "records_assessed": int(len(enriched)),
        "public_records": int(len(public_records)),
        "public_measurements": int(len(public_measurements)),
        "public_publications": int(len(public_pubs)),
        "excluded_records": int(len(exclusions)),
        "public_records_by_tier": public_records["public_release_tier"].value_counts().to_dict(),
        "public_records_by_material_family": public_records["material_family"].value_counts().to_dict(),
        "public_measurements_by_property": public_measurements["property"].value_counts().to_dict(),
        "excluded_records_by_reason": exclusions["exclusion_reasons"].value_counts().to_dict(),
        "strict_comparison_ready_records": int(public_records["strict_comparison_ready"].sum()),
        "records_requiring_missing_condition_warning": int(public_records["missing_conditions"].sum()),
        "records_requiring_unit_inference_warning": int(public_records["unit_inference_review_needed"].sum()),
        "commercial_or_specsheet_benchmark_records": int(public_records["commercial_specsheet_benchmark"].sum()),
        "duplicate_groups_detected": int(duplicate_audit["duplicate_group_id"].nunique()) if not duplicate_audit.empty else 0,
        "duplicate_records_collapsed": int((duplicate_audit["duplicate_group_role"] == "duplicate_collapsed").sum()) if not duplicate_audit.empty else 0,
        "outputs": sorted(
            {
                path.name for path in PUBLIC.iterdir() if path.is_file()
            }
            | {"public_release_summary.json"}
        ),
    }
    (PUBLIC / "public_release_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_report(summary, public_records, exclusions)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
