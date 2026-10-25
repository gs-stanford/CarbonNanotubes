#!/usr/bin/env python3
"""Independent reference arithmetic and release-contract tests for transport data."""
import copy
import csv
import hashlib
import json
import unittest
from pathlib import Path

import pandas as pd

from admit_transport_records import DECISIONS, ROOT, STAGED, convert
from build_combined_database import build_measurements, read_curated_records, validate_primary_addition
from build_public_release import duplicate_pair


class TransportAdmission(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.decisions = json.loads(DECISIONS.read_text())
        cls.cache = json.loads((ROOT / "data/cache/doi_validation_cache.json").read_text())
        cls.packets = {name: convert(name, conf, cls.cache)
                       for name, conf in cls.decisions["admit"].items()}
        cls.records = [r for p in cls.packets.values() for r in p["records"]]

    def test_all_values_are_qualified_and_inputs_match_sources(self):
        for r in self.records:
            validate_primary_addition(r)
            self.assertNotEqual(r["specimen_linkage"], "same_specimen_verified")
            self.assertEqual(r["review_status"], "ai_source_checked_not_human_adjudicated")
            for prop, m in r["measurement_metadata"].items():
                self.assertTrue(m.get("source_qualification"), (r["record_id"], prop))
                self.assertNotIn(m["source_locator"], {"see extraction", "same", ""})
                self.assertEqual(hashlib.sha256(Path(
                    m["source_document_path"]).read_bytes()).hexdigest(), m["source_document_sha256"])
                self.assertFalse(m["source_document_path"].endswith(".json"))

    def test_piraux_resistivity_conversion_and_no_borrowed_geometry(self):
        r = self.packets["piraux_1985"]["records"][0]
        self.assertEqual(r["source_citation_class"], "peer_reviewed_comparator")
        self.assertAlmostEqual(r["values"]["electrical_conductivity_S_m"], 1 / (25.6e-8))
        self.assertEqual(r["values"]["thermal_conductivity_W_mK"], 184)
        self.assertEqual(set(r["values"]), {"electrical_conductivity_S_m", "thermal_conductivity_W_mK"})
        m = r["measurement_metadata"]["electrical_conductivity"]
        self.assertEqual(m["reported_or_derived"], "derived")
        self.assertEqual(json.loads(m["derivation_inputs_json"]), {"resistivity_uohm_cm": 25.6})

    def test_ma_2018_uses_290K_not_peak(self):
        r = self.packets["ma_2018"]["records"][0]
        self.assertAlmostEqual(r["condition_temperature_C"] + 273.15, 290)
        self.assertEqual(r["values"]["electrical_conductivity_S_m"], 516000)
        self.assertEqual(r["values"]["thermal_conductivity_W_mK"], 94.8)
        self.assertNotEqual(r["values"]["thermal_conductivity_W_mK"], 95.8)

    def test_no_held_book_pairs(self):
        identities = {r["curated_state_id"] for r in self.records}
        for hold in self.decisions["holds"]:
            self.assertNotIn(hold["state"], identities)

    def test_every_staged_row_has_a_decision(self):
        with (STAGED.parent / "admission_manifest.csv").open() as handle:
            staged = {r["staging_id"] for r in csv.DictReader(handle)}
        admitted = {r["curated_state_id"] for r in self.records}
        held = {r["state"] for r in self.decisions["holds"]}
        self.assertEqual(len(staged), 26)
        self.assertEqual(len(admitted), 24)
        self.assertEqual(staged - admitted, held & staged)

    def test_song_specific_values_are_reported_not_recomputed(self):
        r = self.packets["song_2025"]["records"][3]
        self.assertEqual(r["values"]["specific_electrical_conductivity_S_m2_kg"], 5100)
        self.assertEqual(r["values"]["specific_thermal_conductivity_W_m2_K_kg"], .24)
        m = r["measurement_metadata"]["specific_thermal_conductivity"]
        self.assertEqual(m["reported_or_derived"], "reported")
        self.assertEqual(m["uncertainty_value_canonical"], .03)

    def test_heo_conflicting_geometry_is_not_used_to_normalize(self):
        r = self.packets["heo_2026"]["records"][3]
        self.assertAlmostEqual(r["values"]["tensile_strength_Pa"], 3.26e9)
        self.assertAlmostEqual(r["values"]["linear_density_kg_m"], .17e-6)
        self.assertEqual(r["values"]["density_kg_m3"], 2000)
        self.assertNotIn("specific_electrical_conductivity_S_m2_kg", r["values"])
        self.assertNotIn("specific_strength_N_m_kg", r["values"])
        self.assertIn("do not satisfy", r["comparison_note"])

    def test_nguyen_original_units_and_errors(self):
        r = self.packets["nguyen_2024"]["records"][1]
        self.assertEqual(r["values"]["electrical_conductivity_S_m"], 74700)
        self.assertEqual(r["measurement_metadata"]["electrical_conductivity"]["uncertainty_value_canonical"], 8000)
        self.assertNotIn("density_kg_m3", r["values"])

    def test_li_named_states_and_density_are_not_mixed(self):
        a, b = self.packets["li_2024"]["records"]
        self.assertEqual(a["values"]["initial_modulus_Pa"], 642e9)
        self.assertEqual(b["values"]["initial_modulus_Pa"], 901e9)
        self.assertAlmostEqual(a["values"]["specific_strength_N_m_kg"], 2.9e9 / 2020)
        self.assertAlmostEqual(a["values"]["specific_thermal_conductivity_W_m2_K_kg"], 1590 / 2020)
        self.assertAlmostEqual(b["values"]["breaking_strain_fraction"], .21 / 100)
        self.assertNotIn("density_kg_m3", b["values"])
        self.assertNotIn("specific_strength_N_m_kg", b["values"])
        m = a["measurement_metadata"]["thermal_conductivity"]
        self.assertEqual(m["sample_size_n"], 3)
        self.assertEqual(m["uncertainty_type"], "not_reported")
        self.assertEqual(m["source_reported_uncertainty_type"], "standard_deviation")
        self.assertEqual(m["uncertainty_numeric_status"], "graphical_not_extracted")
        self.assertIn("does not mean", m["source_qualification"])
        self.assertIsNone(m["uncertainty_value_canonical"])

    def test_zhou_text_and_figure_extractions_are_distinguished(self):
        rows = self.packets["zhou_2025"]["records"]
        for r, sigma in zip(rows, [1298.3, 1830.5, 2282.7, 3202.3]):
            self.assertAlmostEqual(r["values"]["electrical_conductivity_S_m"], sigma * 100)
        self.assertEqual(rows[0]["values"]["specific_strength_N_m_kg"], .632e6)
        for r in rows[1:3]:
            self.assertEqual(r["measurement_metadata"]["thermal_conductivity"]["extraction_method"],
                             "ai_source_audited_primary_figure")

    def test_distinct_checkpoints_remain_distinct(self):
        for p in self.packets.values():
            for a, b in zip(p["records"], p["records"][1:]):
                def row(r):
                    return pd.Series({**r, **r["values"], "doi_verified": r["doi_raw"]})
                self.assertFalse(duplicate_pair(row(a), row(b))[0], (a["curated_state_id"], b["curated_state_id"]))

    def test_unit_and_metadata_mutations_fail(self):
        original = self.packets["ma_2018"]["records"][0]
        wrong = copy.deepcopy(original)
        wrong["values"]["electrical_conductivity_S_cm"] = wrong["values"].pop("electrical_conductivity_S_m")
        with self.assertRaises(ValueError):
            validate_primary_addition(wrong)
        missing = copy.deepcopy(original)
        del missing["measurement_metadata"]["thermal_conductivity"]
        with self.assertRaises(ValueError):
            validate_primary_addition(missing)
        unverified = copy.deepcopy(self.cache)
        unverified[original["doi_raw"]]["validation_status_enriched"] = "not_checked_offline"
        with self.assertRaisesRegex(ValueError, "DOI not verified"):
            convert("ma_2018", self.decisions["admit"]["ma_2018"], unverified)

    def test_release_reader_preserves_every_curated_property(self):
        loaded = [r for r in read_curated_records() if r["record_id"] in {x["record_id"] for x in self.records}]
        self.assertEqual(len(loaded), len(self.records))
        m = build_measurements(loaded).set_index(["record_id", "property"])
        for r in self.records:
            for prop, meta in r["measurement_metadata"].items():
                row = m.loc[(r["record_id"], prop)]
                self.assertEqual(row["source_locator"], meta["source_locator"])
                self.assertEqual(row["source_document_sha256"], meta["source_document_sha256"])
                self.assertEqual(row["source_qualification"], meta["source_qualification"])


if __name__ == "__main__":
    unittest.main()
