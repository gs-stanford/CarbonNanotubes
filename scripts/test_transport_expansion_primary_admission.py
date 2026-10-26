#!/usr/bin/env python3
"""Independent arithmetic and state-linkage tests for the expansion release."""
import json
import math
import unittest
from pathlib import Path

from build_combined_database import validate_primary_addition


class ExpansionAdmission(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        folder = Path(__file__).resolve().parents[1] / "data/curation/primary_additions"
        cls.packets = {name: json.loads((folder / f"expansion_{name}.json").read_text())
                       for name in ("piraux1990", "vijaykumar2026", "choi2026", "piontkowski2025")}

    def test_census_and_metadata(self):
        self.assertEqual([p["record_count"] for p in self.packets.values()], [8, 2, 4, 22])
        self.assertEqual(sum(p["measurement_count"] for p in self.packets.values()), 55)
        ids = []
        for p in self.packets.values():
            for r in p["records"]:
                validate_primary_addition(r)
                ids.append(r["record_id"])
                self.assertEqual(r["primary_source_verification_status"], "ai_source_checked_not_human_adjudicated")
                self.assertNotEqual(r["specimen_linkage"], "same_specimen_verified")
                for m in r["measurement_metadata"].values():
                    self.assertTrue(m["source_document_sha256"])
                    self.assertTrue(m["source_locator"])
        self.assertEqual(len(ids), len(set(ids)))

    def test_fluorination_units_and_temperature(self):
        rows = self.packets["piraux1990"]["records"]
        for r, rho in zip(rows[:7], [230, 250, 272, 195, 31, 40, 17]):
            self.assertAlmostEqual(r["values"]["electrical_conductivity_S_m"], 100e6 / rho)
            self.assertEqual(set(r["values"]), {"electrical_conductivity_S_m"})
            self.assertAlmostEqual(r["condition_temperature_C"] + 273.15, 300)
        self.assertAlmostEqual(rows[-1]["condition_temperature_C"] + 273.15, 250)
        self.assertAlmostEqual(rows[-1]["values"]["thermal_conductivity_W_mK"], 58.91322074414752)
        m = rows[-1]["measurement_metadata"]["thermal_conductivity"]
        self.assertEqual(m["uncertainty_type"], "not_reported")
        self.assertIn("NOT experimental", m["digitization_readout_definition"])

    def test_vijay_does_not_relabel_borrowed_thermal_measurement(self):
        before, after = self.packets["vijaykumar2026"]["records"]
        self.assertNotIn("thermal_conductivity_W_mK", before["values"])
        self.assertNotIn("specific_thermal_conductivity_W_m2_K_kg", before["values"])
        self.assertEqual(after["values"]["thermal_conductivity_W_mK"], 400)
        self.assertAlmostEqual(after["values"]["electrical_conductivity_S_m"], 1e6 / 1.1)
        self.assertEqual(after["measurement_metadata"]["thermal_conductivity"]["sample_size_n"], 3)
        self.assertEqual(before["values"]["specific_strength_N_m_kg"], 1.14e6)
        self.assertEqual(after["values"]["specific_strength_N_m_kg"], 1.31e6)
        self.assertAlmostEqual(after["values"]["density_kg_m3"], 5e-7 / (math.pi * 1e-10))
        self.assertAlmostEqual(after["values"]["specific_thermal_conductivity_W_m2_K_kg"], 400 * math.pi * 1e-10 / 5e-7)

    def test_choi_signed_seebeck_preserved_and_adopted_kappa_absent(self):
        for r in self.packets["choi2026"]["records"]:
            self.assertEqual(set(r["values"]), {"electrical_conductivity_S_m"})
            seebeck, pf = r["context_measurements"]
            self.assertAlmostEqual(pf["value"], (seebeck["value"] * 1e-6)**2 * r["values"]["electrical_conductivity_S_m"] * 1000)
        self.assertEqual(self.packets["choi2026"]["records"][-1]["context_measurements"][0]["value"], -63.2)

    def test_piontkowski_no_midpoint_or_cross_fluence_pairs(self):
        rows = self.packets["piontkowski2025"]["records"]
        paired = [r for r in rows if "thermal_conductivity_W_mK" in r["values"] and "electrical_conductivity_S_m" in r["values"]]
        self.assertEqual(len(paired), 2)
        self.assertTrue(paired[0]["stable_cohort"].endswith("as_received"))
        self.assertTrue(paired[1]["stable_cohort"].endswith("before_redoping_0.30"))
        preheat = next(r for r in rows if r["stable_cohort"].endswith("preheated_800C"))
        self.assertNotIn("electrical_conductivity_S_m", preheat["values"])
        self.assertEqual(preheat["context_measurements"][0]["lower"], 2e6)
        self.assertEqual(preheat["context_measurements"][0]["upper"], 3e6)
        for r in rows:
            self.assertNotIn("diameter_m", r["values"])
            if "after_redoping" in r["stable_cohort"]:
                self.assertNotIn("thermal_conductivity_W_mK", r["values"])
            if "electrical_conductivity" in r["measurement_metadata"] and "redoping" in r["stable_cohort"]:
                m = r["measurement_metadata"]["electrical_conductivity"]
                self.assertEqual(m["uncertainty_type"], "not_reported")
                self.assertEqual(m["digitization_readout_halfwidth_canonical"], 1e5)

    def test_bounded_processing_response_independent_reference(self):
        lower = (398 / 364) / (3 / 6.7)
        upper = (398 / 364) / (2 / 6.7)
        self.assertAlmostEqual(lower, 2.441941391941392)
        self.assertAlmostEqual(upper, 3.662912087912088)
        self.assertLess(lower, 6.22)


if __name__ == "__main__":
    unittest.main()
