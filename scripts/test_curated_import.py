#!/usr/bin/env python3
"""Independent references for the returned validation workbook and benchmarks."""
import json
import unittest
from pathlib import Path

from import_human_validation import normalized_measurement, parse_expression, import_workbook
from build_combined_database import read_curated_records, build_measurements, james_material_family, extract_dois
from build_public_release import duplicate_pair
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


class SourceExpressionTests(unittest.TestCase):
    def test_scalars_and_uncertainty_are_not_misread_as_exponents(self):
        self.assertEqual(parse_expression("1900 +/- 100".replace("+/-", "±")), (1900, None, None, 100))
        self.assertEqual(parse_expression("0.101"), (0.101, None, None, None))

    def test_range_and_error(self):
        self.assertEqual(parse_expression("1.3–1.5 ± 0.2"), (1.4, 1.3, 1.5, .2))

    def test_scientific_notation(self):
        self.assertEqual(parse_expression("0.8 ~ 1.6 × 10^(5)"), (120000, 80000, 160000, None))
        self.assertAlmostEqual(parse_expression("2.4 × 10−3")[0], .0024)
        self.assertEqual(parse_expression("1.5 × 105")[0], 150000)
        self.assertEqual(parse_expression("10^(7)")[0], 1e7)

    def test_qualitative_value_is_not_a_point(self):
        with self.assertRaises(ValueError):
            parse_expression("tens of μma)")

    def test_correction_ignores_stale_normalized_cell(self):
        value, meta = normalized_measurement(
            {"Property": "Tensile strength", "Reported value": 842.6, "Reported unit": "MPa",
             "Source table / location": "Table 1", "Record ID": "correction", "Reviewer": "Nate",
             "Review date": None, "Reviewer notes": "corrected"},
            {"raw_value": "864.2", "conversion_formula": "MPa to Pa"})
        self.assertEqual(value, 842600000)
        self.assertEqual(meta["reported_value"], 842.6)

    def test_different_specimen_survives_automatic_deduplication(self):
        row = pd.Series({"human_duplicate_decision": "Different specimen"})
        self.assertFalse(duplicate_pair(row, row)[0])

    def test_author_categories_outrank_electrodes_and_comparators(self):
        self.assertEqual(james_material_family("Individual Multiwall CNTs", "CNT", "Nanotubes", "gold electrodes"), "CNT_or_CNT_hybrid")
        self.assertEqual(james_material_family("GIC", "Other Carbon", "Graphite fibers", "comparable to copper"), "other_carbon_comparator")
        self.assertEqual(james_material_family("Unaligned Few-wall CNTs", "CNT", "CNT paper", "Doped Buckypaper"), "CNT_or_CNT_hybrid")

    def test_citation_list_separators_do_not_create_new_doi_identities(self):
        expected = ["10.1080/00018730110113644", "10.1016/j.synthmet.2014.09.037"]
        self.assertEqual(sorted(extract_dois("https://doi.org/" + expected[0] + "; https://doi.org/" + expected[1])), sorted(expected))
        self.assertEqual(sorted(extract_dois(";".join(expected))), sorted(expected))


class CuratedReleaseTests(unittest.TestCase):
    def test_review_decisions_and_values(self):
        p = json.loads((ROOT / "data/curation/human_validated_records.json").read_text())
        self.assertEqual(p["status_counts"]["✓ Valid"], 179)
        self.assertEqual(p["import_counts"]["held_incomplete_source_or_duplicate_review"], 38)
        self.assertEqual(p["import_counts"]["accepted"], 136)
        values = {m["review_candidate_id"]: r["values"][{
            "tensile_strength": "tensile_strength_Pa", "initial_modulus": "initial_modulus_Pa",
            "density": "density_kg_m3", "electrical_conductivity": "electrical_conductivity_S_m"
        }[prop]] for r in p["records"] for prop, m in r["measurement_metadata"].items()
                  if prop in {"tensile_strength", "initial_modulus", "density", "electrical_conductivity"}}
        self.assertEqual(values["fang2020-t1-r12-tensile_strength"], 842600000)
        self.assertEqual(values["yin2020-t1-r7-electrical_conductivity"], 6600)
        self.assertEqual(values["lekawa2014-t1-r16-density"], 1400)
        self.assertEqual(values["lu2024-t2-r3-electrical_conductivity"], 24000000)

    def test_build_preserves_metadata_and_no_fake_pairing(self):
        records = read_curated_records()
        measurements = build_measurements(records)
        reviewed = measurements[measurements.source_file.eq("cnt_atlas_human_validation.xlsx")]
        self.assertTrue(reviewed[reviewed.reported_or_derived.eq("reported")].reported_unit.notna().all())
        self.assertFalse(reviewed.specimen_linkage.eq("same_specimen_verified").any())
        self.assertEqual(len(set(r["record_id"] for r in records)), len(records))

    def test_every_benchmark_density_derived_value_recalculates(self):
        for record in read_curated_records():
            if record["source_file"] != "reference_benchmarks.json":
                continue
            metadata = json.loads(record["measurement_metadata_json"])
            for prop, m in metadata.items():
                if m["normalization_basis"] != "derived_from_density":
                    continue
                inputs = json.loads(m["derivation_inputs_json"])
                numerator = next(v for k, v in inputs.items() if k != "density_kg_m3")
                field = {"specific_strength": "specific_strength_N_m_kg",
                         "specific_modulus": "specific_modulus_N_m_kg",
                         "specific_electrical_conductivity": "specific_electrical_conductivity_S_m2_kg",
                         "specific_thermal_conductivity": "specific_thermal_conductivity_W_m2_K_kg"}[prop]
                self.assertAlmostEqual(record[field], numerator / inputs["density_kg_m3"])

    def test_independent_benchmark_reference_values(self):
        records = {r["record_label"]: r for r in read_curated_records() if r["source_file"] == "reference_benchmarks.json"}
        self.assertAlmostEqual(records["Na"]["electrical_conductivity_S_m"], 1 / 47.7e-9)
        self.assertAlmostEqual(records["Ca"]["specific_electrical_conductivity_S_m2_kg"], 1 / 33.6e-9 / 1550)
        self.assertAlmostEqual(records["T1200"]["specific_strength_N_m_kg"], 8e9 / 1820)
        self.assertEqual(records["M55J 6K / M55JB 6K 50B"]["thermal_conductivity_W_mK"], 155.6)
        im11 = records["HexTow IM11"]
        self.assertIn("chord", json.loads(im11["measurement_metadata_json"])["initial_modulus"]["measurement_definition"])
        self.assertEqual(im11["initial_modulus_Pa"], 324e9)


if __name__ == "__main__":
    unittest.main()
