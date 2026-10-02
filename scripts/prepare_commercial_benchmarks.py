#!/usr/bin/env python3
"""Add the source-checked grade tables from the benchmark research receipt."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare(candidate: dict) -> dict:
    reported = candidate["reported_values"]
    url, locator = candidate["source_url"], candidate["source_locator"]
    standard = candidate["test_standard"]
    mechanical = standard.get("mechanical") if isinstance(standard, dict) else standard
    density_standard = standard.get("density") if isinstance(standard, dict) else None

    def fact(value, unit, method=None, definition=None):
        return {"value": value, "unit": unit, "source_url": url, "source_locator": locator,
                "test_standard": method, "measurement_definition": definition,
                "condition": "Manufacturer typical/nominal fiber value; conditions not specified"}

    facts = {
        "density": fact(reported["density_g_cm3"], "g/cm^3", density_standard),
        "tensile_strength": fact(reported.get("strength_MPa", reported.get("strength_GPa")),
                                 "MPa" if "strength_MPa" in reported else "GPa", mechanical),
        "initial_modulus": fact(reported["modulus_GPa"], "GPa", mechanical, candidate["modulus_definition"]),
        "breaking_strain": fact(reported["elongation_percent"], "%", mechanical),
    }
    if "electrical_resistivity_ohm_cm" in reported:
        facts["electrical_resistivity"] = fact(reported["electrical_resistivity_ohm_cm"], "Ohm cm", definition=candidate["functional_property_scope"])
    if "thermal_conductivity_J_per_cm_s_degC" in reported:
        facts["thermal_conductivity"] = fact(reported["thermal_conductivity_J_per_cm_s_degC"], "J/(cm s degC)", definition=candidate["functional_property_scope"])
    label = candidate["grade"]
    if candidate["candidate_id"] == "honeywell-spectra-s1000-75den":
        label += " (75 denier)"
    return {
        "id": candidate["candidate_id"], "label": label, "sample_name": label,
        "material_family": "polymer_fiber_comparator" if candidate["family"] == "UHMWPE fiber" else "carbon_fiber_comparator",
        "form_factor": "fiber_yarn", "material_subclass": candidate["family"],
        "source_label": candidate["manufacturer"] + " | " + locator,
        "source_revision": candidate.get("source_date"),
        "density_basis": "manufacturer_nominal_grade_density",
        "measurement_method": "Manufacturer reference fiber properties; modulus definition: " + candidate["modulus_definition"],
        "conditions_notes": candidate["notes"] + " Modulus is " + candidate["modulus_definition"] + "; not established as an initial tangent modulus."
                            " Strength, density, strain and functional properties are not a same-specimen pairing; no missing temperature, direction, gauge length or uncertainty is inferred.",
        "facts": facts,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("--sources", type=Path, default=ROOT / "data/curation/reference_benchmark_sources.json")
    args = parser.parse_args()
    receipt = json.loads(args.receipt.read_text())
    payload = json.loads(args.sources.read_text())
    additions = [prepare(c) for c in receipt["candidates"]]
    replacement_ids = {r["id"] for r in additions}
    payload["benchmarks"] = [r for r in payload["benchmarks"] if r["id"] not in replacement_ids] + additions
    args.sources.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Prepared {len(additions)} manufacturer grades with source definitions and units")


if __name__ == "__main__":
    main()
