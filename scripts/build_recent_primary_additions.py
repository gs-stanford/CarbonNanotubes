#!/usr/bin/env python3
"""Package audited Sun/Liu source series without borrowing cross-state properties."""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDITS = ROOT / "outputs/fiber_discovery_20261022"
OUT = ROOT / "data/curation/primary_additions"
FIELDS = {
    "tensile_strength": ("tensile_strength_Pa", "GPa", 1e9),
    "initial_modulus": ("initial_modulus_Pa", "GPa", 1e9),
    "electrical_conductivity": ("electrical_conductivity_S_m", "MS/m", 1e6),
    "thermal_conductivity": ("thermal_conductivity_W_mK", "W/(m K)", 1),
    "density": ("density_kg_m3", "g/cm^3", 1000),
}


def read_csv(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def base(doi, label, state, filename, row, family):
    return dict(record_id="rec_" + hashlib.sha1(
        f"primary-source-v1|{doi}|{state}".encode()).hexdigest()[:12],
        curated_state_id=f"{doi}|{state}", source_file=filename,
        source_sheet="primary configuration series", source_row=row,
        record_label=label, sample_name=label, material_family=family,
        form_factor="fiber_yarn", citation_raw="https://doi.org/"+doi, doi_raw=doi,
        dataset_provenance="ai_source_audited_primary_extraction",
        primary_source_verification_status="ai_source_checked_not_human_adjudicated",
        source_citation_class="peer_reviewed_research_record",
        comparison_scope="strict_candidate_missing_conditions",
        specimen_linkage="single_source_row_unverified", source_priority=0,
        extraction_method="ai_assisted_primary_source_data_audit",
        curator="CPT AI-assisted source audit", statistic_type="mean",
        sample_size_n=None, values={}, measurement_metadata={})


def add(record, prop, value, sd, locator, source_sha256, n, **extra):
    field, unit, factor = FIELDS[prop]
    value = float(value)
    sd = float(sd) if sd not in (None, "") else None
    record["values"][field] = value * factor
    record["measurement_metadata"][prop] = dict(
        reported_value=value, reported_unit=unit, reported_or_derived="reported",
        conversion_factor_to_canonical=factor,
        uncertainty_value_reported=sd,
        uncertainty_value_canonical=sd*factor if sd is not None else None,
        uncertainty_type="standard_deviation" if sd is not None else "not_reported",
        statistic_type="mean", sample_size_n=n,
        normalization_basis="not_applicable", density_basis="not_applicable",
        density_value_kg_m3=None, density_source_locator=None,
        cross_section_method=record.get("cross_section_method"),
        value_bound_type="point_estimate", derivation_formula=None,
        derivation_inputs_json=None, source_locator=locator,
        source_sha256=source_sha256, **extra)


def qualify(record, prop, note):
    """Keep qualifications in both measurement and public record projections."""
    meta = record["measurement_metadata"][prop]
    meta["source_qualification"] = " ".join(filter(None, [meta.get("source_qualification"), note]))
    if note not in record["conditions_notes"]:
        record["conditions_notes"] += " " + note


def package(filename, doi, records, hashes, held, policy):
    OUT.mkdir(parents=True, exist_ok=True)
    payload = dict(schema_version="cpt-curated-records-v1", doi=doi,
        audit_date="2026-10-22", review_status="ai_source_checked_not_human_adjudicated",
        admission_basis="User-authorized source-audited release; no independent human adjudication asserted",
        record_count=len(records), source_sha256=hashes,
        source_access="Private article copies are not redistributed; numerical facts retain source locators",
        deduplication_policy=policy, held_measurements=held, records=records)
    (OUT / filename).write_text(json.dumps(payload, indent=2, ensure_ascii=True)+"\n")
    return payload


def sun():
    folder = AUDITS / "sun_doping_audit"
    audit = json.loads((folder / "extraction.json").read_text())
    doi = audit["doi"]
    rows = read_csv(folder / "configuration_series.csv")
    book = "41467_2026_69498_MOESM3_ESM.xlsx"
    hashes = audit["source_sha256"]
    records, aliases, held = [], {}, []
    dopant_temperatures = {"N/I2-CNTFs": ("I2", 200),
                           "N/CuI-CNTFs": ("CuI", 750),
                           "N/FeCl3-CNTFs": ("FeCl3", 360)}
    cui_qualification = (
        "QA correction: original source workbook "
        "41467_2026_69498_MOESM3_ESM.xlsx, Supplementary Figure 13a!B4:C4, "
        "reports 25.97 +/- 0.09 MS/m, agreeing with main article.pdf p.5. "
        "The earlier QA claim that the workbook SD was 0.06 MS/m was incorrect; "
        "direct cell and worksheet-XML inspection confirm 0.09 MS/m. Retain SD 0.09 MS/m; "
        "no unresolved primary-source uncertainty conflict is established for this entry.")
    for row in rows:
        label, series = row["sample"], row["series"]
        # Resolve only explicit repeated controls, not identity guessed from proximity.
        if series == "named_doping_cohorts" and label == "N-CNTFs":
            held.append(dict(sample=label, source=row["source"], reason=
                "Named N cohort duplicates the 10-min values but main prose says 5 min. Retain explicitly timed series; no unique named-cohort duration inferred."))
            continue
        if label == "MoCl5-CNTFs":
            label = "MoCl5-CNTFs-48 h"
        if label == "N/MoCl5-CNTFs-48 h":
            label = "N/MoCl5-CNTFs"
        if label in aliases:
            target = aliases[label]
            target.setdefault("source_aliases", []).append(dict(source=row["source"], original_sample=row["sample"],
                reported_strength_GPa=row["strength_GPa"] or None,
                reported_conductivity_MSm=row["electrical_MSm"]))
            continue
        record = base(doi, label, label, "sun_2026.json", len(records)+1, "CNT_or_CNT_hybrid")
        record.update(material_subclass="wet-spun CNT fibers; plasma/molecular-doping controls",
            synthesis_method="CSA wet spinning", postprocessing=series,
            cross_section_method="Lateral SEM group mean diameter, circular area; FIB check separate",
            gauge_length_mm=20 if row["strength_GPa"] else None,
            measurement_method="Tensile testing / four-probe electrical conductivity" if row["strength_GPa"] else "Four-probe electrical conductivity",
            provenance_table_figure_page=f"{book} | {row['source']}",
            conditions_notes="Same named treatment cohort, not confirmed same filament. "
                "Mechanical gauge 20 mm, crosshead 1 mm/min; electrical voltage gauge 80 mm. "
                "Where present, the N stage includes O2/Ar plasma before N2/Ar. "
                "CSA-spun PCNTF is not demonstrated dopant-free. SD conditions on fixed group geometry, not a complete uncertainty budget. "
                "Main optimal N duration conflicts with source series; no unreported duration assigned.")
        if label == "N/MoCl5-CNTFs":
            record["conditions_notes"] += " Mo treatment 48 h; N duration unresolved."
        if "MoCl5" in label:
            record["conditions_notes"] += " MoCl5/MoO3 sealed-tube treatment at 300 C (main pp.8-9)."
        if row["strength_GPa"]:
            add(record, "tensile_strength", row["strength_GPa"], row["strength_SD_GPa"],
                record["provenance_table_figure_page"], hashes[book], 5,
                measurement_gauge_length_mm=20, crosshead_speed_mm_min=1)
        add(record, "electrical_conductivity", row["electrical_MSm"], row["electrical_SD_MSm"],
            record["provenance_table_figure_page"], hashes[book], 5,
            measurement_gauge_length_mm=80,
            uncertainty_qualification="Conditional on group mean area; geometry uncertainty not propagated")
        if label in dopant_temperatures:
            dopant, temperature = dopant_temperatures[label]
            record["heat_treatment_C"] = temperature
            record["postprocessing"] = f"{series}; {dopant} vapor treatment at {temperature} C"
            qualify(record, "electrical_conductivity",
                f"Main article.pdf pp.8-9: N-CNTFs and {dopant} were placed separately in a glass tube, "
                "vacuum-dried at 100 C (~1 mbar) for 24 h, flame-sealed, "
                f"then annealed at {temperature} C; acetone-washed and dried at 60 C. "
                "These are processing temperatures, not electrical measurement temperatures. "
                "The dopant comparison also changes thermal history: I2 200 C, CuI 750 C, FeCl3 360 C; "
                "it does not isolate dopant chemistry alone.")
        if label == "N/CuI-CNTFs":
            qualify(record, "electrical_conductivity", cui_qualification)
        records.append(record)
        aliases[label] = record
    held.extend(dict(reason=reason) for reason in audit["conflicts"])
    held.append(dict(sample="N/CuI-CNTFs", property="electrical_conductivity",
                     status="prior_qa_finding_retracted_primary_sources_agree",
                     reason=cui_qualification))
    held.append(dict(reason="Table 9 normalization variants and additional headline properties not added in this packet; no thermal conductivity or film Hall values assigned to fibers."))
    return package("sun_2026.json", doi, records, hashes, held,
        "One baseline; repeated Mo48 and co-doped48 controls stored as source aliases, not new samples. "
        "Ambiguous named N cohort withheld. Timed source-series values retained, including Mo48 2.395 GPa versus rounded 2.40 elsewhere.")


def liu():
    folder = AUDITS / "graphene_draw_audit"
    audit = json.loads((folder / "extraction.json").read_text())
    doi, hashes = audit["doi"], audit["source_sha256"]
    book = "41563_2026_2733_MOESM10_ESM.xlsx"
    ext = "41563_2026_2733_MOESM14_ESM.xlsx"
    si = "41563_2026_2733_MOESM1_ESM.pdf"
    panel_note = (
        "Source workbook uses E.D.Fig.6 panel names; the corresponding published mechanical "
        "panels are Extended Data Fig.7 in main article.pdf p.19. Original workbook coordinates are retained.")
    strength_repeat_note = (
        "Draw-10 strength is 5.89 +/- 0.14 GPa in MOESM10 Fig.4f!D6:E6; the separate "
        "5 mm gauge series reports 5.89 +/- 0.20 GPa in MOESM14 E.D.Fig.6b!B6:C6. "
        "Both measurement sets are retained; repeat-set identity and cross-series specimen independence "
        "are unresolved. Do not replace SDs or treat equal means as a proven duplicate.")
    modulus_repeat_note = (
        "Draw-10 modulus is 960 +/- 55 GPa in MOESM14 E.D.Fig.6d!B6:C6; the separate "
        "5 mm gauge series reports 960 +/- 25 GPa in MOESM14 E.D.Fig.6b!D6:E6. "
        "Both measurement sets are retained; repeat-set identity and cross-series specimen independence "
        "are unresolved. Do not replace SDs or treat equal means as a proven duplicate.")
    modulus_headline_note = (
        "Unresolved modulus source difference: 960 GPa in the source workbook versus "
        "963 GPa in SI Table 3 and the main abstract. Retain the workbook series value; "
        "do not silently substitute the headline value.")
    thermal_note = (
        "Main article.pdf pp.11-12: four-contact Joule heating with IR profiles below 60 C. "
        "The printed approximately 10^4 Pa pressure is described as high vacuum; this source "
        "inconsistency is unresolved. Do not replace it with 10^-4 Pa or assume negligible convection.")
    records = []
    for i, row in enumerate(read_csv(folder / "drawing_configurations.csv"), 2):
        ratio = int(row["draw_ratio"])
        record = base(doi, f"Graphene fiber, draw ratio {ratio}", f"draw-{ratio}", "liu_2026.json", i,
                      "graphene_or_GO_fiber")
        record.update(material_subclass="graphitized graphene fiber",
            synthesis_method="GO/glycerol wet spinning", postprocessing="in-spinning drawing; 1600 C then 2800 C Ar",
            density_basis="sink_float_density_not_verified_outer_area_bulk_density",
            provenance_table_figure_page=row["source"],
            conditions_notes="Same draw-ratio cohort; no identical-filament pairing. "
                "Three technical replicates; no raw covariance. Tensile rate, exact draw-series gauge and tested area method unresolved. "
                "Thermal method: four-contact Joule heating, IR profile below 60 C. "
                "Printed 10^4 Pa/high-vacuum inconsistency unresolved; do not assume 10^-4 Pa. "
                "Electrical and density points digitized from vector figures, not exact table entries. "
                "No mass-specific transport/mechanics derived from sink-float density for release.")
        for prop, value_key, sd_key, filename, locator in [
            ("tensile_strength", "strength_GPa", "strength_sd", book, f"Fig.4f D{i}:E{i}"),
            ("thermal_conductivity", "thermal_W_mK", "thermal_sd", book, f"Fig.4f B{i}:C{i}"),
            ("initial_modulus", "modulus_GPa", "modulus_sd", ext, f"E.D.Fig.6d B{i}:C{i}"),
        ]:
            add(record, prop, row[value_key], row[sd_key], f"{filename} | {locator}", hashes[filename], 3,
                replicate_type="technical")
        qualify(record, "initial_modulus", panel_note)
        qualify(record, "thermal_conductivity", thermal_note)
        if ratio == 1:
            qualify(record, "initial_modulus",
                "MOESM14 E.D.Fig.6d!B2:C2 reports 38.1 +/- 67 GPa, also consistent with main "
                "Extended Data Fig.7d. The source-reported SD exceeds the mean; retain as published "
                "without an invented correction. No independent adjudication is asserted.")
        if ratio == 10:
            qualify(record, "tensile_strength", strength_repeat_note)
            qualify(record, "initial_modulus", modulus_repeat_note)
            qualify(record, "initial_modulus", modulus_headline_note)
        for prop, value_key, sd_key, key, page, fig in [
            ("electrical_conductivity", "electrical_MSm", "electrical_sd", "electrical", 56, 49),
            ("density", "density_g_cm3", "density_sd", "density", 43, 36),
        ]:
            add(record, prop, row[value_key], row[sd_key], f"{si} | PDF page {page}, Fig.S{fig}, draw ratio {ratio}", hashes[si], 3,
                extraction_method="vector_figure_digitization", replicate_type="technical",
                digitization_sensitivity_reported_unit=audit["calibration"][key]["extraction_tolerance_y"],
                digitization_note="Full digits are extraction coordinates, not measurement precision. Half-PDF-point sensitivity is not experimental uncertainty.")
            qualify(record, prop,
                f"Vector-digitized mean and SD from {si}, PDF p.{page}, Fig.S{fig}. "
                "These are approximate figure coordinates, not exact table entries; full digits "
                "are retained only for reproducibility. Coordinate sensitivity is not experimental SD.")
        if ratio == 10:
            qualify(record, "electrical_conductivity",
                "Unresolved electrical source difference: approximately 1.3301 MS/m digitized from "
                "SI Fig.S49 (PDF p.56) versus 1.35 MS/m in SI Table 3. Retain the figure-derived "
                "full-series value and its digitization qualification; do not substitute the headline value.")
        records.append(record)
    for row in read_csv(folder / "gauge_length_series.csv"):
        gauge = int(row["gauge_length_mm"])
        record = base(doi, f"Graphene fiber, draw ratio 10, gauge {gauge} mm",
            f"draw-10-gauge-{gauge}", "liu_2026.json", len(records)+2, "graphene_or_GO_fiber")
        record.update(material_subclass="graphitized graphene fiber", gauge_length_mm=gauge,
            postprocessing="draw ratio 10; graphitized 2800 C",
            provenance_table_figure_page=row["source"],
            conditions_notes="Separate gauge-length series, three technical replicates. "
                "No conductivity/density borrowed from draw series. Rate not recovered. "
                "Repeat-set identity and specimen independence across gauge and draw series are unresolved.")
        for prop, value_key, sd_key in [("tensile_strength", "strength_GPa", "strength_sd"),
                                       ("initial_modulus", "modulus_GPa", "modulus_sd")]:
            add(record, prop, row[value_key], row[sd_key], f"{ext} | {row['source']}", hashes[ext], 3,
                measurement_gauge_length_mm=gauge, replicate_type="technical")
            qualify(record, prop, panel_note)
        if gauge == 5:
            qualify(record, "tensile_strength", strength_repeat_note)
            qualify(record, "initial_modulus", modulus_repeat_note)
            qualify(record, "initial_modulus", modulus_headline_note)
        records.append(record)
    discrepancies = [*audit["source_discrepancies"],
        dict(field="modulus_sd_at_draw_10", values=modulus_repeat_note,
             action="Both measurement sets retained; no inferred specimen independence")]
    return package("liu_2026.json", doi, records, hashes, discrepancies,
        "Five draw configurations plus all five gauge-length mechanical measurement sets, including 5 mm. "
        "Distinct source states do not prove independent specimens across series; no cross-series metric borrowing.")


if __name__ == "__main__":
    for payload in [sun(), liu()]:
        print(payload["doi"], payload["record_count"], "records",
              sum(len(r["values"]) for r in payload["records"]), "measurements")
