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
    "diameter": ("diameter_m", "um", 1e-6),
    "linear_density": ("linear_density_kg_m", "tex", 1e-6),
    "specific_strength": ("specific_strength_N_m_kg", "N/tex", 1e6),
    "specific_modulus": ("specific_modulus_N_m_kg", "N/tex", 1e6),
    "specific_electrical_conductivity": ("specific_electrical_conductivity_S_m2_kg", "S m^2/kg", 1),
    "specific_thermal_conductivity": ("specific_thermal_conductivity_W_m2_K_kg", "W m^2/(K kg)", 1),
    "g_d_ratio": ("g_d_ratio", "ratio", 1),
    "ampacity": ("ampacity_A_m2", "A/mm^2", 1e6),
    "specific_volume": ("specific_volume_m3_kg", "m^3/kg", 1),
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
    meta = dict(
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
        source_sha256=source_sha256)
    meta.update(extra)
    record["measurement_metadata"][prop] = meta


def qualify(record, prop, note):
    """Keep qualifications in both measurement and public record projections."""
    meta = record["measurement_metadata"][prop]
    meta["source_qualification"] = " ".join(filter(None, [meta.get("source_qualification"), note]))
    if note not in record["conditions_notes"]:
        record["conditions_notes"] += " " + note


def density_ratio(record, numerator, prop, density_basis, qualification):
    """Explicit ratio of named-cohort means, never a paired-filament observation."""
    raw, density = record["measurement_metadata"][numerator], record["measurement_metadata"]["density"]
    raw_field, _, _ = FIELDS[numerator]
    field, unit, factor = FIELDS[prop]
    rho = record["values"]["density_kg_m3"]
    value = record["values"][raw_field] / rho
    locator = f"Ratio of cohort means: {raw['source_locator']}; {density['source_locator']}"
    add(record, prop, value / factor, None, locator, raw["source_sha256"], None,
        reported_value=None, reported_unit=None, reported_or_derived="derived",
        statistic_type="unspecified", statistic_qualification="ratio_of_cohort_means", normalization_basis="derived_from_density",
        density_basis=density_basis, density_value_kg_m3=rho,
        density_source_locator=density["source_locator"],
        derivation_formula=f"{field} = {raw_field} / density_kg_m3",
        derivation_inputs_json={raw_field: record["values"][raw_field], "density_kg_m3": rho},
        extraction_method="deterministic_cohort_density_normalization",
        uncertainty_type="not_reported",
        uncertainty_qualification="Input SDs retained on inputs; no paired covariance or complete propagated uncertainty available.")
    record["measurement_metadata"][prop]["input_provenance"] = {
        "record_id": record["record_id"], "curated_state_id": record["curated_state_id"],
        "numerator": raw.copy(), "density": density.copy()}
    qualify(record, prop, qualification)


def reciprocal_density(record):
    density = record["measurement_metadata"]["density"]
    rho = record["values"]["density_kg_m3"]
    add(record, "specific_volume", 1/rho, None, density["source_locator"], density["source_sha256"], None,
        reported_value=None, reported_unit=None, reported_or_derived="derived",
        statistic_type="unspecified", statistic_qualification="reciprocal_of_cohort_density_not_mean_specimen_volume",
        normalization_basis="derived_from_density", density_basis=density["density_basis"],
        density_value_kg_m3=rho, density_source_locator=density["source_locator"],
        derivation_formula="specific_volume_m3_kg = 1 / density_kg_m3",
        derivation_inputs_json={"density_kg_m3": rho})
    qualify(record, "specific_volume", "Calculated reciprocal of the reported cohort density, not an average of specimen-specific volumes. "
        "Density method retained; no propagated uncertainty or extra independent observation asserted.")


def enrich_sun_cohorts(records, hashes):
    si = "41467_2026_69498_MOESM1_ESM.pdf"
    book = "41467_2026_69498_MOESM3_ESM.xlsx"
    cells = json.loads((AUDITS / "sun_doping_audit/source_data_cells.json").read_text())
    # Table 9 headers and Methods p.4 agree; the c/d footnotes are transposed.
    cohorts = {
        "PCNTFs": dict(column=0, density=1.82, area_density=(1.82, .32), diameter=(11.57,.08),
            effective_diameter=(11.77,.29), tex=(.19,.03), strength=(1.43,.05), sigma=(4693,15),
            linear_sigma=(4716,16)),
        "MoCl5-CNTFs-48 h": dict(column=2, density=1.99, area_density=(2.06,.43), diameter=(11.34,.04),
            effective_diameter=(11.46,.31), tex=(.21,.04), strength=(1.20,.03), sigma=(8702,62),
            linear_sigma=(8235,59)),
        "N/MoCl5-CNTFs": dict(column=3, density=1.93, area_density=(1.99,.20), diameter=(11.30,.02),
            effective_diameter=(11.47,.15), tex=(.20,.02), strength=(1.29,.08), sigma=(14166,48),
            linear_sigma=(13746,47)),
    }
    density_basis = "density_gradient_column_reported"
    for record in records:
        c = cohorts.get(record["sample_name"])
        if c is None:
            continue
        index = c["column"]
        label = ["PCNTFs", "N-CNTFs", "MoCl5-CNTFs", "N/MoCl5-CNTFs"][index]
        locator = f"{si} | p.36, Supplementary Table 9, {label} column"
        record["density_basis"] = density_basis
        add(record, "density", c["density"], None, f"{si} | Methods p.4; Table 9 p.36, {label}", hashes[si], None,
            density_basis=density_basis, statistic_type="unspecified", statistic_qualification="reported_cohort_density",
            measurement_method="Density-gradient column; carbon tetrachloride/dibromoethane; 24 h equilibration",
            source_alternatives=[dict(reported_value=c["area_density"][0], reported_unit="g/cm^3",
                uncertainty_value_reported=c["area_density"][1], uncertainty_type="standard_deviation",
                method="linear_density_divided_by_SEM_area", source_locator=locator)])
        qualify(record, "density",
            f"Density {c['density']} g/cm^3 is independently measured by the density-gradient column "
            f"(SI Methods p.4), not inferred from conductivity. Alternative linear-density/SEM-area "
            f"estimate {c['area_density'][0]} +/- {c['area_density'][1]} g/cm^3 retained, not a second sample. "
            "Table 9 c/d footnotes transpose the methods; use the explicit Methods and row headings. "
            "Gradient-density uncertainty and exact replicate count are not reported.")
        add(record, "diameter", *c["diameter"], locator, hashes[si], None,
            replicate_type="SEM_positions_not_independent_fibers", measurement_position_count=30,
            source_alternatives=[dict(reported_value=c["effective_diameter"][0], reported_unit="um",
                uncertainty_value_reported=c["effective_diameter"][1], method="FIB_cross_section_equivalent_diameter",
                source_locator=locator)])
        qualify(record, "diameter",
            f"Side-view SEM diameter; 30 source-workbook positions are not 30 independent fibers. "
            f"Alternative FIB-area equivalent diameter {c['effective_diameter'][0]} +/- {c['effective_diameter'][1]} um.")
        add(record, "linear_density", *c["tex"], locator, hashes[si], 3,
            measurement_method="Microbalance, 10 m fiber lengths", measurement_gauge_length_mm=10000)
        qualify(record, "linear_density", "Three separate mass/length specimens in source workbook; not the five tensile/electrical rows.")
        for prop, key in [("specific_strength", "strength"), ("specific_electrical_conductivity", "sigma")]:
            add(record, prop, *c[key], locator, hashes[si], 5,
                normalization_basis="directly_reported_mass_specific", source_normalization_method="density_gradient_column",
                density_basis=density_basis,
                density_value_kg_m3=c["density"]*1000,
                density_source_locator=record["measurement_metadata"]["density"]["source_locator"])
            qualify(record, prop,
                "Source-reported Table 9 value; source workbook arithmetic uses density-gradient density. "
                "Fixed cohort density/area in source SDs; density and geometry uncertainties are not propagated. "
                "Same named cohort, not verified same filament or direct force/linear-density normalization.")
        sigma = record["measurement_metadata"]["specific_electrical_conductivity"]
        sigma["source_alternatives"] = [dict(reported_value=c["linear_sigma"][0], reported_unit="S m^2/kg",
            uncertainty_value_reported=c["linear_sigma"][1], method="linear_density_based", source_locator=locator)]
        qualify(record, "specific_electrical_conductivity",
            f"Table 9 alternative linear-density-based value {c['linear_sigma'][0]} +/- {c['linear_sigma'][1]} S m^2/kg. "
            "Footnote e names cross-sectional density, but the reported value closes with gradient density; "
            "the method discrepancy is retained, not treated as missing data.")
        if index == 3:
            record["measurement_metadata"]["specific_strength"]["source_alternatives"] = [dict(
                reported_value=1.26, reported_unit="N/tex", uncertainty_value_reported=.07,
                method="main_text_normalization_unresolved", source_locator="article.pdf | main mechanical-performance text")]
            qualify(record, "specific_strength", "Main text reports 1.26 +/- 0.07 N/tex; SI Table 8/9 and workbook give 1.29 +/- 0.08. "
                "Use the explicit SI table/workbook convention; the main-text difference remains unresolved.")
        if index in (2,3):
            qualify(record, "specific_electrical_conductivity",
                "Alternative linear-density result differs between Table 9 and the workbook: " +
                ("8235 versus 8325.34 S m^2/kg." if index == 2 else "13746 versus 13748.39 S m^2/kg."))
        for prop, sheet in [("initial_modulus", "Supplementary Figure 14b"),
                            ("g_d_ratio", "Supplementary Figure 7d"), ("ampacity", "Figure 3d")]:
            source_row = cells[sheet][index+2]
            assert source_row[0] == label
            add(record, prop, source_row[1], source_row[2], f"{book} | {sheet}!B{index+3}:C{index+3}", hashes[book],
                None if prop == "ampacity" else 5)
        qualify(record, "g_d_ratio", "Raman intensity IG/ID, 532 nm laser; not ID/IG (SI Methods p.4, Table 2 p.29).")
        qualify(record, "ampacity", "Failure current density in ambient air, 50 mm freestanding span (SI Methods p.5). "
            "Reported SD retained; exact independent replicate count not recovered.")
        density_ratio(record, "initial_modulus", "specific_modulus", density_basis,
            "Calculated modulus/density ratio of named-cohort means using measured gradient density. "
            "Not a directly measured mass-specific modulus; no paired-filament covariance or propagated SD.")
        reciprocal_density(record)


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
    enrich_sun_cohorts(records, hashes)
    held.extend(dict(reason=reason, status="retained_source_discrepancy_not_blanket_exclusion") for reason in audit["conflicts"])
    held.append(dict(sample="N/CuI-CNTFs", property="electrical_conductivity",
                     status="prior_qa_finding_retracted_primary_sources_agree",
                     reason=cui_qualification))
    held.append(dict(reason="Table 9 named N-CNTF-only properties cannot be assigned to a timed N cohort solely by matching its raw values: main says 5 min whereas source values match 10 min. No density or endpoint property borrowed for other treatment durations. No fiber thermal conductivity reported; film Hall values excluded."))
    return package("sun_2026.json", doi, records, hashes, held,
        "One baseline; repeated Mo48 and co-doped48 controls stored as source aliases, not new samples. "
        "Ambiguous named N cohort withheld. Timed source-series values retained, including Mo48 2.395 GPa versus rounded 2.40 elsewhere.")


def enrich_liu_figures(records, folder, doi):
    audit = json.loads((folder / "omitted_figure_values.json").read_text())
    if not audit["checks"]["rendered_crops_visually_reviewed"]:
        raise ValueError("Liu figure extraction requires source/crop review before admission")
    source = audit["sources"]["si"]
    if hashlib.sha256(Path(source["path"]).read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError("Liu SI differs from the calibrated source")
    density_basis = "sink_float_density_not_verified_outer_area_bulk_density"

    def new_state(row, label):
        r = base(doi, label, row["curated_state_id"].split("|", 1)[1],
                 "liu_2026.json", len(records)+2, "graphene_or_GO_fiber")
        r.update(material_subclass=row.get("material_state", "graphitized graphene fiber"),
                 provenance_table_figure_page=row["source_locator"],
                 conditions_notes=row.get("conditions_notes", "Separate source-labelled precursor cohort; no final-fiber properties borrowed."))
        records.append(r)
        return r

    def figure_value(record, prop, value, locator):
        add(record, prop, value["value_reported_unit"], value.get("uncertainty_value_reported"),
            locator, source["sha256"], value.get("sample_size_n"),
            statistic_type=value["statistic_type"],
            extraction_method=value["extraction_method"],
            density_basis=value.get("density_basis", "not_applicable"),
            cross_section_method=value.get("cross_section_method"),
            replicate_type=value.get("replicate_type"),
            digitization_sensitivity_reported_unit=value.get("digitization_sensitivity_reported_unit"),
            digitization_sensitivity_sd_reported_unit=value.get("digitization_sensitivity_sd_reported_unit"),
            source_extraction=value)
        qualify(record, prop, "Figure-digitized mean/SD; full digits are extraction coordinates, not measurement precision. "
            "Coordinate sensitivity is retained separately and is not experimental SD. " +
            value.get("density_method_qualification", ""))
        if value.get("resolution_limited_sd"):
            qualify(record, prop, "The source SD is digitized with resolution-limited precision: "
                "coordinate sensitivity exceeds 20% of the extracted SD; the mean remains resolved.")

    for row in audit["raman_drawing"]["records"]:
        record = next((r for r in records if r["curated_state_id"] == row["curated_state_id"]), None)
        if record is None:
            record = new_state(row, f"Graphene fiber, draw ratio {row['draw_ratio']}")
        raw, reciprocal = row["raw_d_g"], row["g_d"]
        add(record, "g_d_ratio", reciprocal["value_canonical"], None, row["source_locator"], source["sha256"], None,
            reported_value=None, reported_unit=None, reported_or_derived="derived", statistic_type="unspecified",
            derivation_formula="g_d_ratio = 1 / digitized_d_g_ratio",
            derivation_inputs_json={"digitized_d_g_ratio": raw["value_reported_unit"]},
            extraction_method="reciprocal_of_calibrated_figure_ratio",
            digitization_sensitivity_interval=reciprocal["digitization_sensitivity_interval"],
            source_extraction=raw)
        qualify(record, "g_d_ratio", row["conditions_notes"] +
            " Full digits are extraction coordinates; reciprocal sensitivity is not experimental uncertainty.")

    for row in audit["precursor_density"]["records"]:
        record = new_state(row, f"Graphene oxide precursor fiber, draw ratio {row['draw_ratio']}")
        record.update(density_basis=density_basis, postprocessing="GOF precursor before graphitization")
        figure_value(record, "density", row["density"], row["source_locator"])
        reciprocal_density(record)

    for row in audit["thermal_summary"]["records"]:
        record = new_state(row, f"{row['source_state_label']}, thermal-treatment measurement set")
        record.update(density_basis=density_basis, heat_treatment_C=row["treatment_temperature_C"],
                      source_series_key=row["source_series_key"], measurement_set_id=row["measurement_set_id"],
                      independence_status=row["independence_status"])
        for prop in ("density", "diameter"):
            figure_value(record, prop, row["measurements"][prop], row["source_locator"])
            qualify(record, prop, "Same named Fig.38e thermal state; no mechanical, transport or Raman properties borrowed. "
                "Draw ratio and exact specimen identity are not independently established in this figure.")
            overlap = row.get("possible_overlap", [])
            if overlap:
                record["measurement_metadata"][prop]["possible_population_overlap_states"] = overlap
                qualify(record, prop, "Possible population overlap with " + ", ".join(overlap) +
                    "; retained as a separate source measurement set, not an additional independent specimen population.")
        reciprocal_density(record)


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
                "Mass-specific ratios explicitly use same-draw-cohort sink-float density; "
                "not confirmed same-filament or direct linear-mass normalization.")
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
        record["measurement_metadata"]["density"]["density_basis"] = record["density_basis"]
        qualify(record, "density", "Sink-float density (SI PDF p.7, printed p.6); equivalence to outer-envelope bulk "
            "density used in mechanical/transport area estimates is unverified.")
        for numerator, prop in [("tensile_strength", "specific_strength"), ("initial_modulus", "specific_modulus"),
                                ("electrical_conductivity", "specific_electrical_conductivity"),
                                ("thermal_conductivity", "specific_thermal_conductivity")]:
            density_ratio(record, numerator, prop, record["density_basis"],
                "Calculated ratio of same-draw-cohort means using sink-float density, not a source-reported "
                "specific property or a mean of paired-filament ratios. Liquid accessibility/porosity and "
                "equivalence to outer-area bulk density are unresolved; not direct load-per-linear-mass "
                "or proof that geometry effects are removed. Input SDs and digitization sensitivities retained "
                "in input provenance; no derived SD assigned. " +
                record["measurement_metadata"][numerator].get("source_qualification", ""))
        reciprocal_density(record)
        qualify(record, "tensile_strength", "Additional comparison-panel alternative: source workbook MOESM14 "
            "E.D.Fig.6e!E3:F7 lists (strength GPa, modulus GPa) pairs (0.43,23.8), (2.6,296), "
            "(3.8,578), (4.6,822), (5.5,960), without draw labels/SD. Retain the explicitly draw-labelled "
            "mean/SD series; do not map or overwrite with these unresolved comparison-panel pairs.")
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
    enrich_liu_figures(records, folder, doi)
    discrepancies = [*audit["source_discrepancies"],
        dict(field="modulus_sd_at_draw_10", values=modulus_repeat_note,
             action="Both measurement sets retained; no inferred specimen independence")]
    return package("liu_2026.json", doi, records, hashes, discrepancies,
        "Five full draw configurations, Raman-only draw 2, five gauge-length mechanical sets, "
        "five GOF precursor-density states and four thermal-treatment geometry sets. "
        "Distinct source states do not prove independent specimens across series; no cross-series metric borrowing.")


if __name__ == "__main__":
    for payload in [sun(), liu()]:
        print(payload["doi"], payload["record_count"], "records",
              sum(len(r["values"]) for r in payload["records"]), "measurements")
