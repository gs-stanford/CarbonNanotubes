#!/usr/bin/env python3
"""Materialize the source-reviewed October 25 transport admission decisions.

The staged analysis packets are not release inputs. This explicit conversion
retains their identity, adds audited provenance, and leaves holds out of CPT.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import shutil
from pathlib import Path

from build_combined_database import MEASUREMENT_DEFINITIONS, validate_primary_addition

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs/transport_admission_20261025"
STAGED = ROOT / "outputs/fiber_discovery_20261023/crosspaper_processing/stage3_kappa_sigma/cpt_admission/packets"
DECISIONS = ROOT / "data/curation/transport_admission_20261025.json"
DEST = ROOT / "data/curation/primary_additions"
STATUS = "ai_source_checked_not_human_adjudicated"
FIELDS = {prop: field for prop, field, _ in MEASUREMENT_DEFINITIONS}
SCALES = {"MS/m": 1e6, "S/m": 1., "S/cm": 100., "W/(m K)": 1.,
          "kg/m3": 1., "g/cm3": 1000., "um": 1e-6, "dtex": 1e-7,
          "GPa": 1e9, "MPa": 1e6, "N/tex": 1e6, "%": .01, "tex": 1e-6,
          "S m2/kg": 1., "W m2/(kg K)": 1.}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n")


def snapshot():
    baseline = OUT / "baseline"
    if baseline.exists():
        raise ValueError("Baseline already exists; refusing to overwrite the pre-admission release")
    baseline.mkdir(parents=True)
    paths = list((ROOT / "data/public").glob("*"))
    for path in paths:
        if path.is_file():
            shutil.copy2(path, baseline / path.name)
    write_json(baseline / "sha256.json", {p.name: digest(p) for p in paths if p.is_file()})


def source_document(path):
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    if path.suffix.lower() not in {".pdf", ".docx", ".html", ".xml"}:
        raise ValueError(f"An extraction JSON is not a primary source: {path}")
    return {"path": str(path), "sha256": digest(path),
            "access": "Local source copy; no article, figure or SI redistribution in the release."}


def add_density_derivations(record):
    rho = record["values"]["density_kg_m3"]
    for prop, rawprop, field in [
        ("specific_electrical_conductivity", "electrical_conductivity", "specific_electrical_conductivity_S_m2_kg"),
        ("specific_thermal_conductivity", "thermal_conductivity", "specific_thermal_conductivity_W_m2_K_kg"),
        ("specific_strength", "tensile_strength", "specific_strength_N_m_kg"),
        ("specific_modulus", "initial_modulus", "specific_modulus_N_m_kg"),
    ]:
        numerator = record["values"].get(FIELDS[rawprop])
        if numerator is None:
            continue
        record["values"][field] = numerator / rho
        metadata = copy.deepcopy(record["measurement_metadata"][rawprop])
        metadata.update(reported_value=None, reported_unit=None, reported_or_derived="derived",
            conversion_factor_to_canonical=None, uncertainty_value_reported=None,
            uncertainty_value_canonical=None, uncertainty_type="not_reported",
            statistic_type="unspecified", normalization_basis="derived_from_density",
            density_basis=record["density_basis"], density_value_kg_m3=rho,
            density_source_locator=record["measurement_metadata"]["density"]["source_locator"],
            derivation_formula=f"{FIELDS[rawprop]} / density_kg_m3",
            derivation_inputs_json=json.dumps({FIELDS[rawprop]: numerator, "density_kg_m3": rho}, sort_keys=True),
            source_qualification=metadata["source_qualification"] +
                " Calculated using the density of this named source state, not a directly measured specific property."
                " No uncertainty propagation without covariance or replicate linkage.")
        record["measurement_metadata"][prop] = metadata


def add_reciprocal_density(record):
    rho = record["values"]["density_kg_m3"]
    meta = copy.deepcopy(record["measurement_metadata"]["density"])
    meta.update(reported_value=None, reported_unit=None, reported_or_derived="derived",
        conversion_factor_to_canonical=None, uncertainty_value_reported=None,
        uncertainty_value_canonical=None, uncertainty_type="not_reported",
        normalization_basis="derived_from_density", density_value_kg_m3=rho,
        density_source_locator=meta["source_locator"], derivation_formula="1 / density_kg_m3",
        derivation_inputs_json=json.dumps({"density_kg_m3": rho}), statistic_type="unspecified")
    record["values"]["specific_volume_m3_kg"] = 1 / rho
    record["measurement_metadata"]["specific_volume"] = meta


def convert(name, config, cache):
    staged = json.loads((STAGED / f"{name}.json").read_text())
    doi = staged["doi"]
    publication = cache.get(doi, {})
    if publication.get("validation_status_enriched") != "verified_crossref_openalex":
        raise ValueError(f"DOI not verified in both metadata services: {doi}")
    paper = publication["crossref"]
    sources = {key: source_document(path) for key, path in config["documents"].items()}
    for doc in sources.values():
        expected = staged.get("source_sha256", {}).get(Path(doc["path"]).name)
        if expected and expected != doc["sha256"]:
            raise ValueError(f"Source changed since the staged extraction: {doc['path']}")
    filename = f"transport_{name}.json"
    records = []
    for index, original in enumerate(staged["records"], 1):
        record = copy.deepcopy(original)
        state = record["curated_state_id"]
        patch = config.get("states", {}).get(state.split("|", 1)[1], {})
        if patch.get("action") == "hold":
            continue
        record.update(config.get("record_overrides", {}))
        record.update(patch.get("record_overrides", {}))
        record["source_specimen_linkage_description"] = original["specimen_linkage"]
        if record["specimen_linkage"] not in {"same_sample_batch", "single_source_row_unverified", "aggregated_across_specimens"}:
            record["specimen_linkage"] = "single_source_row_unverified"
        record["values"].update(patch.get("values", {}))
        for prop in patch.get("remove_properties", []):
            record["values"].pop(FIELDS[prop], None)
            record["measurement_metadata"].pop(prop, None)
        record.update(record_id="rec_" + hashlib.sha1(f"primary-source-v1|{state}".encode()).hexdigest()[:12],
            stable_cohort=state.split("|", 1)[1], source_file=filename,
            source_sheet=config["source_sheet"], source_row=index, source_priority=0,
            doi_raw=doi, citation_raw=f"{staged['citation']}. https://doi.org/{doi}",
            url_raw=f"https://doi.org/{doi}", publication_title=paper["title"],
            publication_authors_short=paper["authors_short"], publication_journal=paper["journal"],
            publication_year=paper["year"], publication_published_date=paper["published_date"],
            publication_issue_pages=paper["issue_pages"], review_status=STATUS,
            primary_source_verification_status=STATUS, review_date="2026-10-25", internal_status=STATUS,
            statistic_type=config.get("statistic_type", "unspecified"), sample_size_n=None,
            normalization_basis="not_applicable", density_basis=config.get("density_basis", "unknown"),
            provenance_table_figure_page=config["source_sheet"],
            source_document_sha256=sources[config["default_document"]]["sha256"],
            comparison_note=config["qualification"],
            conditions_notes=record["conditions_notes"] + " " + config["qualification"],
            admission_action="admitted_source_checked")
        if record["material_family"] not in {"CNT_or_CNT_hybrid", "CNT_metal_composite", "graphene_or_GO_fiber"}:
            record["source_citation_class"] = "peer_reviewed_comparator"
        for prop, meta in record["measurement_metadata"].items():
            meta.update(config.get("measurement_overrides", {}).get(prop, {}))
            meta.update(patch.get("measurement_overrides", {}).get(prop, {}))
        for prop, meta in patch.get("new_measurements", {}).items():
            record["measurement_metadata"][prop] = copy.deepcopy(meta)
        for prop, column in config.get("extra_columns", {}).items():
            value = column["reported_values"][index - 1]
            meta = {k: copy.deepcopy(v) for k, v in column.items()
                    if k not in {"reported_values", "uncertainties"}}
            meta.update(reported_value=value, reported_or_derived="reported",
                uncertainty_reported=column.get("uncertainties", [None] * len(staged["records"]))[index - 1])
            record["values"][FIELDS[prop]] = value * SCALES[meta["reported_unit"]]
            record["measurement_metadata"][prop] = meta
        for prop, meta in record["measurement_metadata"].items():
            if config.get("row_locators"):
                meta["source_locator"] = config["row_locators"][index - 1] + "; " + prop
            doc = sources[meta.pop("document_key", config["default_document"])]
            meta.update(source_document_path=doc["path"], source_document_sha256=doc["sha256"],
                source_url=f"https://doi.org/{doi}", source_audited_date="2026-10-25",
                review_status=STATUS)
            meta.setdefault("sample_size_n", None)
            meta.setdefault("value_bound_type", "point_estimate")
            meta.setdefault("reported_or_derived", "reported")
            meta.setdefault("normalization_basis", "not_applicable")
            meta.setdefault("source_qualification", config["qualification"])
            meta.setdefault("statistic_type", record["statistic_type"])
            meta.setdefault("density_basis", record["density_basis"] if prop == "density" else "not_applicable")
            figure = any(s in str(meta.get("read_from", "")).lower() for s in ("fig", "digitiz", "plot"))
            meta["extraction_method"] = "ai_source_audited_primary_figure" if figure else "ai_source_audited_primary_table_or_text"
            if meta.get("reported_or_derived") == "derived":
                continue
            factor = SCALES.get(meta["reported_unit"])
            if factor is None or not math.isclose(meta["reported_value"] * factor,
                    record["values"][FIELDS[prop]], rel_tol=1e-10):
                raise ValueError(f"Non-reproducible conversion: {state}/{prop}")
            meta["conversion_factor_to_canonical"] = factor
            uncertainty = meta.get("uncertainty_reported")
            meta.setdefault("uncertainty_value_reported", uncertainty)
            meta.setdefault("uncertainty_value_canonical", uncertainty * factor if isinstance(uncertainty, (int, float)) else None)
            meta.setdefault("uncertainty_type", "reported_unspecified" if uncertainty is not None else "not_reported")
            # CPT's typed numerical uncertainty requires a magnitude. Preserve
            # graphical source uncertainty separately instead of inventing one.
            if meta["uncertainty_type"] != "not_reported" and meta["uncertainty_value_canonical"] is None:
                if not meta.get("uncertainty_definition"):
                    raise ValueError(f"Unexplained missing uncertainty: {state}/{prop}")
                meta["source_reported_uncertainty_type"] = meta["uncertainty_type"]
                meta["uncertainty_numeric_status"] = "graphical_not_extracted"
                meta["uncertainty_type"] = "not_reported"
                meta["source_qualification"] += " Source uncertainty: " + meta["uncertainty_definition"] + ". Numerical uncertainty unavailable in CPT; this does not mean the source showed no error bars."
        if config.get("derive_specific_transport") or patch.get("derive_specific_properties"):
            add_density_derivations(record)
        if record["values"].get("density_kg_m3"):
            add_reciprocal_density(record)
        validate_primary_addition(record)
        records.append(record)
    return {"schema_version": "cpt-curated-records-v1", "record_count": len(records),
            "measurement_count": sum(len(r["values"]) for r in records),
            "review_date": "2026-10-25", "review_status": STATUS,
            "admission_scope": config["qualification"], "paper": {"doi": doi, **paper},
            "documents": sources, "staged_packet_sha256": digest(STAGED / f"{name}.json"),
            "admission_decisions_sha256": digest(DECISIONS),
            "record_id_scheme": "rec_ + SHA1(primary-source-v1|curated_state_id)[:12]",
            "held_measurements": staged.get("held_measurements", []), "records": records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true")
    parser.add_argument("--write", action="store_true", help="Explicitly materialize reviewed decisions into curation")
    args = parser.parse_args()
    if args.snapshot:
        snapshot()
    if not DECISIONS.exists():
        if args.write:
            raise ValueError("Source-review decisions are not ready")
        return
    decisions = json.loads(DECISIONS.read_text())
    cache = json.loads((ROOT / "data/cache/doi_validation_cache.json").read_text())
    # Validate every packet before touching any curation input.
    packets = {name: convert(name, config, cache) for name, config in decisions["admit"].items()}
    if args.write:
        for name, packet in packets.items():
            write_json(DEST / f"transport_{name}.json", packet)
    print(json.dumps({name: {"records": p["record_count"], "measurements": p["measurement_count"]}
                      for name, p in packets.items()}, indent=2))


if __name__ == "__main__":
    main()
