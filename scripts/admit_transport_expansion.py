#!/usr/bin/env python3
"""Admit the four source-audited transport papers without inventing paired states.

Run without --write to inspect the proposed census. Source PDFs stay private.
Intervals and properties outside CPT's schema remain in the provenance packet.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import math
import shutil

from admit_transport_records import (
    ROOT, DEST, FIELDS, SCALES, STATUS, add_reciprocal_density, digest,
    source_document, write_json,
)
from build_combined_database import validate_primary_addition

STAGE = ROOT / "outputs/fiber_discovery_20261023/crosspaper_processing/stage4_expansion"
OUT = ROOT / "outputs/transport_expansion_admission_20261025"
PAPERS = {
    "piraux1990": "10.1103/physrevb.41.4961",
    "vijaykumar2026": "10.1002/smll.202513355",
    "choi2026": "10.1016/j.cej.2025.171739",
    "piontkowski2025": "10.1021/acs.jpcc.5c05657",
}


def rows(name):
    with (STAGE / name).open() as handle:
        return list(csv.DictReader(handle))


def base(name, state, label, qualification, locator, temperature=None, family="CNT_or_CNT_hybrid"):
    doi = PAPERS[name]
    identity = f"{doi}|{name}_{state}"
    return {
        "record_id": "rec_" + hashlib.sha1(f"primary-source-v1|{identity}".encode()).hexdigest()[:12],
        "curated_state_id": identity, "stable_cohort": f"{name}_{state}",
        "record_label": label, "sample_name": label, "source_file": f"expansion_{name}.json",
        "source_sheet": locator, "source_row": 0, "source_priority": 0,
        "doi_raw": doi, "url_raw": f"https://doi.org/{doi}",
        "material_family": family, "form_factor": "fiber_yarn",
        "source_citation_class": "peer_reviewed_research_record" if family == "CNT_or_CNT_hybrid" else "peer_reviewed_comparator",
        "dataset_provenance": "ai_source_audited_primary_extraction",
        "primary_source_verification_status": STATUS, "review_status": STATUS,
        "internal_status": STATUS, "review_date": "2026-10-25",
        "curator": "CPT AI-assisted primary-source audit",
        "extraction_method": "ai_assisted_primary_source_data_audit",
        "comparison_scope": "strict_candidate_missing_conditions",
        "specimen_linkage": "same_sample_batch", "statistic_type": "unspecified",
        "sample_size_n": None, "normalization_basis": "not_applicable", "density_basis": "unknown",
        "condition_temperature_C": temperature - 273.15 if temperature is not None else None,
        "conditions_notes": qualification, "comparison_note": qualification,
        "provenance_table_figure_page": locator,
        "admission_action": "admitted_source_checked",
        "values": {}, "measurement_metadata": {}, "context_measurements": [],
    }


def measurement(record, prop, value, unit, locator=None, *, uncertainty=None, uncertainty_type="reported_unspecified",
                n=None, figure=False, qualification=None, **extra):
    factor = SCALES[unit]
    record["values"][FIELDS[prop]] = float(value) * factor
    record["measurement_metadata"][prop] = {
        "reported_value": float(value), "reported_unit": unit, "reported_or_derived": "reported",
        "conversion_factor_to_canonical": factor,
        "uncertainty_value_reported": uncertainty,
        "uncertainty_value_canonical": uncertainty * factor if uncertainty is not None else None,
        "uncertainty_type": uncertainty_type if uncertainty is not None else "not_reported",
        "statistic_type": "mean" if uncertainty_type == "standard_deviation" and uncertainty is not None else "unspecified",
        "sample_size_n": n, "value_bound_type": "point_estimate",
        "source_locator": locator or record["source_sheet"],
        "source_qualification": qualification or record["comparison_note"],
        "extraction_method": "ai_source_audited_primary_figure" if figure else "ai_source_audited_primary_table_or_text",
        "normalization_basis": "not_applicable", "density_basis": "not_applicable",
        **extra,
    }


def derived(record, prop, value, formula, inputs, locator=None, **extra):
    measurement(record, prop, value, "S/m" if prop == "electrical_conductivity" else "kg/m3", locator,
                reported_or_derived="derived", derivation_formula=formula,
                derivation_inputs_json=json.dumps(inputs, sort_keys=True), **extra)
    record["measurement_metadata"][prop].update(reported_value=None, reported_unit=None,
                                                conversion_factor_to_canonical=None)


def piraux():
    output = []
    for row in rows("piraux1990_electrical_states.csv"):
        r = base("piraux1990", f"{row['sample']}_300K", f"Fluorinated VGCF C{row['carbon_to_fluorine_x']}F, sample {row['sample']}",
                 row["qualification"] + ". Individual fibers in four composition batches, not seven independent treatments. No measured matching pristine thermal baseline.",
                 row["locator"], 300, "carbon_fiber_comparator")
        r.update(material_subclass="fluorine-intercalated vapor-grown graphite fiber",
                 synthesis_method=row["host"], postprocessing=f"{row['process']}; reaction {row['reaction_days']} days; stage {row['stage']}",
                 condition_method=row["electrical_method"], specimen_linkage="single_source_row_unverified")
        rho = float(row["rho_microohm_cm"])
        derived(r, "electrical_conductivity", 1 / (rho * 1e-8), "1 / (resistivity_uohm_cm * 1e-8)", {"resistivity_uohm_cm": rho})
        r["source_facts"] = {"carbon_to_fluorine_x": float(row["carbon_to_fluorine_x"]),
                             "resistivity_at_4p2K_microohm_cm": float(row["rho_at_4p2K_microohm_cm"])}
        output.append(r)
    p = json.loads((STAGE / "piraux1990_paired_250K.json").read_text())
    r = base("piraux1990", "batch1_250K", "Fluorinated VGCF C4.1F, batch 1 at 250 K", p["qualification"] + ". " + p["linkage"] + ". " + p["missing"], p["locator"], 250, "carbon_fiber_comparator")
    r.update(material_subclass="fluorine-intercalated vapor-grown graphite fiber", condition_method=p["thermal_method"],
             source_specimen_linkage_description=p["linkage"])
    derived(r, "electrical_conductivity", p["sigma_MS_m"] * 1e6, "1 / (resistivity_uohm_cm * 1e-8)",
            {"resistivity_uohm_cm": p["rho_microohm_cm"]}, figure=True,
            digitization_readout_interval_canonical=[1e8 / x for x in reversed(p["rho_readout_interval_microohm_cm"])],
            digitization_readout_definition=p["readout_interval_definition"])
    measurement(r, "thermal_conductivity", p["kappa_W_mK"], "W/(m K)", figure=True,
                digitization_readout_interval_canonical=p["kappa_readout_interval_W_mK"],
                digitization_readout_definition=p["readout_interval_definition"],
                thermal_bundle_fiber_count=5)
    output.append(r)
    return output


def vijaykumar():
    output = []
    for i, row in enumerate(rows("vijaykumar2026_states.csv")):
        q = ("Same prepared formulation, not identical-strand certification. The as-spun thermal value cited in this article is borrowed from Song 2025 and is not admitted as a new measurement. "
             "Density is calculated from circular diameter and linear density; approximate tensile strength and Weibull specific strength are distinct statistics. "
             + row["measurement_temperature"] + ". " + row["conditioning"])
        r = base("vijaykumar2026", "as_spun" if i == 0 else "annealed_800C_8h", "CSA-spun CNT fiber, " + row["state"], q, row["locator"])
        r.update(material_subclass="acid-spun few-wall CNT fiber", synthesis_method="CSA spinning; acetone coagulation; Meijo CNT aspect ratio about 5500",
                 postprocessing="as spun" if i == 0 else "800 C, 8 h, nitrogen",
                 condition_method=row["electrical_method"] + "; " + row["thermal_method"],
                 density_basis="circular_cross_section_and_linear_density")
        rho = float(row["rho_microohm_m"])
        derived(r, "electrical_conductivity", 1 / (rho * 1e-6), "1 / (resistivity_uohm_m * 1e-6)", {"resistivity_uohm_m": rho})
        if i:
            measurement(r, "thermal_conductivity", 400, "W/(m K)", "Main section 4.6, PDF p13, annealed specimens", uncertainty=55,
                        uncertainty_type="standard_deviation", n=3, measurement_atmosphere="vacuum")
        else:
            r["context_measurements"].append({"property": "thermal_conductivity", "value": 380, "unit": "W/m/K", "status": "borrowed_not_measured_here", "source_doi": "10.1063/5.0244895"})
        measurement(r, "diameter", 20, "um", uncertainty=1)
        measurement(r, "linear_density", float(row["linear_density_dtex"]), "dtex", uncertainty=.3)
        measurement(r, "specific_strength", float(row["Weibull_specific_strength_N_tex"]), "N/tex", source_statistic_type="weibull_characteristic", n=17,
                    normalization_basis="directly_reported_mass_specific")
        measurement(r, "tensile_strength", 2.1, "GPa", source_statistic_type="approximately reported; not replicate mean")
        lam = float(row["linear_density_dtex"]) * 1e-7
        density = lam / (math.pi * (20e-6)**2 / 4)
        derived(r, "density", density, "linear_density_kg_m / (pi * diameter_m**2 / 4)",
                {"linear_density_kg_m": lam, "diameter_m": 20e-6}, density_basis=r["density_basis"])
        # Preserve the directly reported Weibull-specific strength instead of replacing it with 2.1 GPa / density.
        for prop in ("electrical_conductivity", "thermal_conductivity"):
            if prop not in r["measurement_metadata"]:
                continue
            target = "specific_" + prop
            value = r["values"][FIELDS[prop]]
            r["values"][FIELDS[target]] = value / density
            m = copy.deepcopy(r["measurement_metadata"][prop])
            m.update(reported_or_derived="derived", reported_value=None, reported_unit=None, conversion_factor_to_canonical=None,
                     uncertainty_value_reported=None, uncertainty_value_canonical=None, uncertainty_type="not_reported",
                     normalization_basis="derived_from_density", density_basis=r["density_basis"], density_value_kg_m3=density,
                     derivation_formula=f"{FIELDS[prop]} / density_kg_m3",
                     derivation_inputs_json=json.dumps({FIELDS[prop]: value, "density_kg_m3": density}),
                     source_qualification=q + " No propagated uncertainty without replicate/covariance information.")
            r["measurement_metadata"][target] = m
        add_reciprocal_density(r)
        output.append(r)
    return output


def choi():
    output = []
    for i, row in enumerate(rows("choi2026_electrical_Seebeck_states.csv")):
        q = row["qualification"] + ". " + row["thermal_provenance"] + ". Values follow the results, not contradictory introductory summaries."
        r = base("choi2026", row["state"].replace(" ", "_"), row["state"], q, row["locator"], 298)
        r.update(material_subclass="CSA-spun mixed single/double-wall CNT fiber", synthesis_method="CSA wet spinning, draw ratio 2.2",
                 postprocessing=row["treatment"] + "; " + row["additional_doping"],
                 condition_method="electrical conductivity and Seebeck characterization; main methods PDF pp2-4")
        measurement(r, "electrical_conductivity", float(row["sigma_MS_m"]), "MS/m")
        # Signed Seebeck and power factor are outside the current 16-property public schema.
        # Retain them as source facts, never relabel them as conductivity or discard their signs.
        r["context_measurements"] = [
            {"property": "seebeck_coefficient", "value": float(row["Seebeck_microV_K"]), "unit": "uV/K", "reported_or_derived": "reported", "source_locator": row["locator"]},
            {"property": "power_factor", "value": float(row["calculated_power_factor_mW_mK2"]), "unit": "mW/m/K^2", "reported_or_derived": "derived", "formula": "Seebeck_V_K**2 * conductivity_S_m"},
        ]
        r["source_facts"] = {"conflict_audit": str(STAGE / "source_conflicts.json"), "thermal_value_adopted_not_measured": 482}
        output.append(r)
    return output


def piontkowski():
    cond = json.loads((STAGE / "piontkowski2025_conditions.json").read_text())
    q = ". ".join(cond[k] for k in ("received_state", "geometry", "measurement_temperature", "measurement_atmosphere", "linkage", "limit"))
    output = {}
    for row in rows("piontkowski2025_thermal_series.csv"):
        fluence = float(row["laser_fluence_J_cm2"])
        state = row["state"] if not fluence else f"before_redoping_{fluence:.2f}"
        r = base("piontkowski2025", state, "Wet-spun CNT fiber, " + state.replace("_", " "), q, row["locator"])
        r.update(material_subclass=cond["host"], synthesis_method="wet spinning",
                 postprocessing=(cond["received_state"] if state == "as_received" else cond["preheat"] + ("; " + cond["laser"] + f"; fluence {fluence} J/cm2" if fluence else "")),
                 condition_method=cond["thermal_method"])
        n = 3 if state == "as_received" else 1 if fluence == .30 else None
        error = float(row["kappa_SD_W_mK"]) if row["kappa_SD_W_mK"] else None
        measurement(r, "thermal_conductivity", float(row["kappa_W_mK"]), "W/(m K)", uncertainty=error,
                    uncertainty_type="standard_deviation", n=n, sample_size_description=row["thermal_n"])
        if state == "as_received":
            measurement(r, "electrical_conductivity", 6.7, "MS/m", uncertainty=.6, uncertainty_type="standard_deviation", n=3)
        if state == "preheated_800C":
            r["context_measurements"].append({"property": "electrical_conductivity", "lower": 2e6, "upper": 3e6,
                "unit": "S/m", "value_bound_type": "reported_approximate_range", "source_locator": row["locator"],
                "qualification": "No midpoint admitted as a measured value; not a confidence interval."})
        r["source_facts"] = {"laser_fluence_J_cm2": fluence if fluence else None, "diameter_assumed_for_transport_um": 25,
                             "redoping": False, "thermal_n_description": row["thermal_n"]}
        output[state] = r
    for row in rows("piontkowski2025_electrical_series.csv"):
        fluence = float(row["laser_fluence_J_cm2"])
        state = f"{row['state']}_{fluence:.2f}"
        if state not in output:
            r = base("piontkowski2025", state, "Wet-spun CNT fiber, " + state.replace("_", " "), q, row["locator"])
            r.update(material_subclass=cond["host"], synthesis_method="wet spinning", condition_method="four-probe electrical conductivity",
                     postprocessing=cond["preheat"] + "; " + cond["laser"] + f"; fluence {fluence} J/cm2; {row['state']}")
            r["source_facts"] = {"laser_fluence_J_cm2": fluence, "redoping": row["state"] == "after_redoping",
                                 "redopant_chemistry": cond["redopant_chemistry"], "diameter_assumed_for_transport_um": 25}
            output[state] = r
        r = output[state]
        measurement(r, "electrical_conductivity", float(row["sigma_MS_m"]), "MS/m", row["locator"], figure=True,
                    digitization_readout_halfwidth_canonical=1e5, digitization_readout_definition=row["readout_definition"],
                    qualification=q + ". " + row["qualification"])
    return list(output.values())


def build_packets():
    cache = json.loads((ROOT / "data/cache/doi_validation_cache.json").read_text())
    packets = {}
    for name, builder in [("piraux1990", piraux), ("vijaykumar2026", vijaykumar), ("choi2026", choi), ("piontkowski2025", piontkowski)]:
        validation = cache[PAPERS[name]]
        if validation["validation_status_enriched"] != "verified_crossref_openalex":
            raise ValueError(f"Publication identity not verified by both services: {name}")
        paper = validation["crossref"]
        doc = source_document(STAGE / "sources" / f"{name}_main.pdf")
        records = builder()
        for i, r in enumerate(records, 1):
            r.update(source_row=i, citation_raw=f"{paper['authors_short']}. {paper['title']}. {paper['journal']} ({paper['year']}). https://doi.org/{PAPERS[name]}",
                     publication_title=paper["title"], publication_authors_short=paper["authors_short"],
                     publication_journal=paper["journal"], publication_year=paper["year"],
                     publication_published_date=paper["published_date"], publication_issue_pages=paper["issue_pages"],
                     source_document_sha256=doc["sha256"])
            for m in r["measurement_metadata"].values():
                m.update(source_document_path=doc["path"], source_document_sha256=doc["sha256"],
                         source_url=r["url_raw"], source_audited_date="2026-10-25", review_status=STATUS)
            validate_primary_addition(r)
        packets[name] = {"schema_version": "cpt-curated-records-v1", "review_status": STATUS,
                         "paper": {"doi": PAPERS[name], **paper}, "documents": {"main": doc},
                         "records": records, "record_count": len(records),
                         "measurement_count": sum(len(r["values"]) for r in records)}
    return packets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if args.snapshot:
        baseline = OUT / "baseline"
        if baseline.exists():
            raise ValueError("Refusing to replace the pre-change release")
        baseline.mkdir(parents=True)
        paths = [p for p in (ROOT / "data/public").glob("*") if p.is_file()]
        for p in paths:
            shutil.copy2(p, baseline / p.name)
        write_json(baseline / "sha256.json", {p.name: digest(p) for p in paths})
    packets = build_packets()
    if args.write:
        for name, packet in packets.items():
            write_json(DEST / f"expansion_{name}.json", packet)
        write_json(OUT / "admission_manifest.json", {
            "review_status": STATUS, "source_decisions_sha256": digest(STAGE / "source_decisions.json"),
            "source_decisions": json.loads((STAGE / "source_decisions.json").read_text())["decisions"],
            "packets": {name: {"record_count": p["record_count"], "measurement_count": p["measurement_count"],
                               "record_ids": [r["record_id"] for r in p["records"]]} for name, p in packets.items()},
            "boundary": "Primary measured states only. Reviews are mechanism sources; NASA compilation, estimated composite and cross-temperature pairs remain analysis context. Choi Seebeck/PF and Piontkowski conductivity range are retained in packets, outside the scalar public-property schema.",
        })
    print(json.dumps({name: {"records": p["record_count"], "measurements": p["measurement_count"]} for name, p in packets.items()}, indent=2))


if __name__ == "__main__":
    main()
