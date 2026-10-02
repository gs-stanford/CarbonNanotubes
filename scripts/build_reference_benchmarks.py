#!/usr/bin/env python3
"""Convert documented manufacturer/reference facts into contextual SI records."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFINITIONS = {
    "density": ("density_kg_m3", {"kg/m^3": 1, "g/cm^3": 1000, "10^3 kg/m^3": 1000}),
    "tensile_strength": ("tensile_strength_Pa", {"MPa": 1e6, "GPa": 1e9}),
    "initial_modulus": ("initial_modulus_Pa", {"GPa": 1e9}),
    "breaking_strain": ("breaking_strain_fraction", {"%": .01}),
    "diameter": ("diameter_m", {"um": 1e-6}),
    "electrical_conductivity": ("electrical_conductivity_S_m", {"S/m": 1, "MS/m": 1e6}),
    "electrical_resistivity": ("electrical_conductivity_S_m", {"10^-8 Ohm m": 1e-8, "nOhm m": 1e-9, "Ohm cm": .01}),
    "thermal_conductivity": ("thermal_conductivity_W_mK", {"W/(m K)": 1, "J/(cm s degC)": 100}),
}
DERIVED = {
    "specific_strength": ("specific_strength_N_m_kg", "tensile_strength_Pa"),
    "specific_modulus": ("specific_modulus_N_m_kg", "initial_modulus_Pa"),
    "specific_electrical_conductivity": ("specific_electrical_conductivity_S_m2_kg", "electrical_conductivity_S_m"),
    "specific_thermal_conductivity": ("specific_thermal_conductivity_W_m2_K_kg", "thermal_conductivity_W_mK"),
}


def build(sources: dict) -> dict:
    records = []
    for row in sources["benchmarks"]:
        values, metadata = {}, {}
        urls = list(dict.fromkeys([*("https://doi.org/" + d for d in row.get("dois", [])), *(f["source_url"] for f in row["facts"].values())]))
        record = {
            "record_id": "rec_" + hashlib.sha1(("reference-benchmark-v1|" + row["id"]).encode()).hexdigest()[:12],
            "source_file": "reference_benchmarks.json", "source_sheet": row["source_label"], "source_row": len(records) + 1,
            "record_label": row["label"], "sample_name": row["sample_name"],
            "citation_raw": "; ".join(urls), "url_raw": ";".join(urls),
            "material_family": row["material_family"], "form_factor": row["form_factor"],
            "material_subclass": row.get("material_subclass"),
            "dataset_provenance": "official_manufacturer_or_reference_property_table",
            "primary_source_verification_status": "verified_against_reference_specification",
            "source_citation_class": row.get("source_citation_class", "commercial_or_web_specsheet_comparator"),
            "comparison_scope": "contextual_comparator", "specimen_linkage": "single_source_row_unverified",
            "density_basis": row["density_basis"], "condition_temperature_C": row.get("condition_temperature_C"),
            "measurement_method": row.get("measurement_method"), "test_standard": row.get("test_standard"),
            "provenance_table_figure_page": row["source_label"],
            "source_export": "Source-checked engineering reference benchmark; not a paired experimental specimen",
            "extraction_method": "source_checked_reference_table", "curator": "CPT source review",
            "conditions_notes": row["conditions_notes"], "source_priority": 0,
            "values": values, "measurement_metadata": metadata,
            "source_facts": row["facts"],
        }
        for prop, fact in row["facts"].items():
            raw, unit = fact["value"], fact["unit"]
            if not isinstance(raw, (float, int)) or not math.isfinite(raw) or raw <= 0:
                raise ValueError(f"Invalid reference scalar {row['id']}/{prop}")
            field, factors = DEFINITIONS[prop]
            if unit not in factors:
                raise ValueError(f"Unsupported reference unit: {prop}/{unit}")
            resistivity = raw * factors[unit] if prop == "electrical_resistivity" else None
            values[field] = 1 / resistivity if resistivity is not None else raw * factors[unit]
            if resistivity is not None:
                prop = "electrical_conductivity"
            metadata[prop] = {
                "reported_value": raw, "reported_unit": unit, "reported_or_derived": "reported",
                "uncertainty_value_reported": None, "uncertainty_value_canonical": None, "uncertainty_type": "not_reported",
                "normalization_basis": "not_applicable", "density_basis": "not_applicable", "density_value_kg_m3": None,
                "density_source_locator": None, "cross_section_method": None, "value_bound_type": "point_estimate",
                "derivation_formula": None, "derivation_inputs_json": None, "statistic_type": fact.get("statistic_type", "unspecified"),
                "source_locator": fact["source_url"] + " | " + fact["source_locator"], "test_standard": fact.get("test_standard"),
                "reference_condition": fact.get("condition"), "source_retrieved_date": sources["retrieved_date"],
                "measurement_definition": fact.get("measurement_definition"),
                "source_revision": row.get("source_revision"),
            }
            if resistivity is not None:
                metadata[prop].update({"reported_value": None, "reported_unit": None, "reported_or_derived": "derived",
                                       "reported_input_value": raw, "reported_input_unit": unit,
                                       "derivation_formula": "electrical_conductivity_S_m = 1 / electrical_resistivity_Ohm_m",
                                       "derivation_inputs_json": json.dumps({"electrical_resistivity_Ohm_m": resistivity})})
        density = values.get("density_kg_m3")
        if density:
            for prop, (field, numerator) in DERIVED.items():
                if numerator not in values:
                    continue
                values[field] = values[numerator] / density
                parent = next(p for p, (f, _) in DEFINITIONS.items() if f == numerator)
                metadata[prop] = {
                    **metadata[parent], "reported_value": None, "reported_unit": None, "reported_or_derived": "derived",
                    "normalization_basis": "derived_from_density", "density_basis": row["density_basis"], "density_value_kg_m3": density,
                    "density_source_locator": metadata["density"]["source_locator"],
                    "derivation_formula": f"{field} = {numerator} / density_kg_m3",
                    "derivation_inputs_json": json.dumps({numerator: values[numerator], "density_kg_m3": density}, sort_keys=True),
                    "statistic_type": "unspecified",
                }
        records.append(record)
    return {"schema_version": "cpt-curated-records-v1", "retrieved_date": sources["retrieved_date"],
            "record_count": len(records), "records": records}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=ROOT / "data/curation/reference_benchmark_sources.json")
    parser.add_argument("--output", type=Path, default=ROOT / "data/curation/reference_benchmarks.json")
    args = parser.parse_args()
    data = build(json.loads(args.sources.read_text()))
    args.output.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Built {data['record_count']} source-checked reference benchmarks")


if __name__ == "__main__":
    main()
