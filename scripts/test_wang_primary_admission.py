#!/usr/bin/env python3
"""Independent Wang source/hash and isolated admission checks; no release writes."""
import copy
import hashlib
import json
import math
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import openpyxl

from build_combined_database import build_measurements, read_curated_records

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT / "data/curation/primary_additions/wang_2026.json"
SOURCES = ROOT / "outputs/fiber_discovery_20261022/wang_fluidics_audit"
DOI = "10.1038/s41467-026-75150-1"
WORKBOOK = "41467_2026_75150_MOESM9_ESM.xlsx"
EXPECTED = (0.86, 1.81, 2.82, 5.75, 4.92, 11.63)


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


class WangAdmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet = json.loads(PACKET.read_text(), object_pairs_hook=unique_keys)
        cls.records = cls.packet["records"]
        cls.workbook = openpyxl.load_workbook(SOURCES / WORKBOOK, data_only=True)
        cls.sheet = cls.workbook["Fig.4a-f"]
        with tempfile.TemporaryDirectory(prefix="cpt-wang-admission-") as directory:
            root = Path(directory)
            additions = root / "data/curation/primary_additions"
            additions.mkdir(parents=True)
            (additions / PACKET.name).symlink_to(PACKET)
            with patch("build_combined_database.ROOT", root):
                cls.loaded = read_curated_records()
        cls.measurements = build_measurements(copy.deepcopy(cls.loaded))

    @classmethod
    def tearDownClass(cls):
        cls.workbook.close()

    def test_identity_and_scope(self):
        self.assertEqual(self.packet["schema_version"], "cpt-curated-records-v1")
        self.assertEqual(len(self.records), self.packet["record_count"])
        self.assertEqual(len(self.records), 18)
        self.assertEqual(len({r["curated_state_id"] for r in self.records}), 18)
        self.assertEqual([r["record_id"] for r in self.records[:6]], [
            "rec_203e91fb5617", "rec_186b4f9b8af7", "rec_01f29f0f7486",
            "rec_320a44b8a351", "rec_2e043f0791c6", "rec_7b024718488c",
        ])
        for r in self.records:
            digest = hashlib.sha1(
                f"primary-source-v1|{DOI}|{r['stable_cohort']}".encode()
            ).hexdigest()[:12]
            self.assertEqual(r["record_id"], "rec_" + digest)
            self.assertEqual(r["source_file"], "wang_2026.json")
            self.assertEqual(r["source_priority"], 0)
            self.assertEqual(r["specimen_linkage"], "single_source_row_unverified")
            self.assertEqual(r["material_family"], "CNT_or_CNT_hybrid")
            self.assertNotIn("electrical_conductivity_S_m", r["values"])
            self.assertNotIn("thermal_conductivity_W_mK", r["values"])
            self.assertNotIn("density_kg_m3", r["values"])

    def test_every_source_hash_locator_and_units(self):
        units = {"tensile_strength": "GPa", "specific_strength": "N/tex",
                 "initial_modulus": "GPa", "breaking_strain": "%",
                 "linear_density": "tex", "g_d_ratio": "ratio"}
        count = 0
        for r in self.records:
            for prop, meta in r["measurement_metadata"].items():
                count += 1
                name = meta["source_document"]
                self.assertIn(name, meta["source_locator"])
                actual = hashlib.sha256((SOURCES / name).read_bytes()).hexdigest()
                self.assertEqual(meta["source_document_sha256"], actual)
                self.assertEqual(self.packet["source_sha256"][name], actual)
                self.assertEqual(meta["reported_unit"], units[prop])
        self.assertEqual(count, 33)

    def test_strength_means_and_asymmetric_minmax_from_workbook(self):
        for row, r, mean in zip(range(40, 46), self.records, EXPECTED):
            meta = r["measurement_metadata"]["tensile_strength"]
            text = str(self.sheet.cell(row, 3).value)
            numbers = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", text)]
            self.assertEqual(numbers[0], mean)
            replicates = numbers[1:]
            self.assertEqual(len(replicates), 5)
            self.assertEqual(meta["sample_size_n"], 5)
            self.assertEqual(meta["reported_value"], mean)
            self.assertEqual(r["values"]["tensile_strength_Pa"], mean * 1e9)
            self.assertAlmostEqual(meta["canonical_min"], min(replicates) * 1e9)
            self.assertAlmostEqual(meta["canonical_max"], max(replicates) * 1e9)
            self.assertEqual(meta["range_statistic_type"], "observed_replicate_min_max")
            self.assertIsNone(meta["uncertainty_value_reported"])
            self.assertEqual(meta["uncertainty_type"], "not_reported")
            self.assertIn(f"C{row}", meta["source_locator"])

    def test_specific_baseline_is_not_same_specimen(self):
        meta = self.records[0]["measurement_metadata"]["specific_strength"]
        self.assertTrue(str(self.sheet["B29"].value).startswith("2.61"))
        self.assertEqual(self.records[0]["values"]["specific_strength_N_m_kg"], 2.61e6)
        self.assertEqual(meta["sample_size_n"], 3)
        self.assertEqual((meta["canonical_min"], meta["canonical_max"]), (2.49e6, 2.77e6))
        self.assertIn("not identical specimens", meta["uncertainty_notes"])

    def test_real_loader_n_and_no_derived_extra_measurements(self):
        self.assertEqual(len(self.loaded), 18)
        self.assertEqual(len(self.measurements), self.packet["measurement_count"])
        self.assertEqual(len(self.measurements), 33)
        expected_n = {(r["record_id"], prop): meta["sample_size_n"]
                      for r in self.records
                      for prop, meta in r["measurement_metadata"].items()}
        for _, m in self.measurements.iterrows():
            prop = m["property"]
            n = m["sample_size_n"]
            wanted = expected_n[(m["record_id"], prop)]
            if wanted is None:
                self.assertTrue(n is None or math.isnan(n))
            else:
                self.assertEqual(n, wanted)
            self.assertTrue(m["source_document_sha256"])
            self.assertTrue(m["source_locator"])

    def test_restored_dose_specific_means_directly_from_cells(self):
        for r, row, column in zip(self.records[6:14],
                                  (30, 30, 31, 31, 32, 32, 33, 33),
                                  (2, 5, 2, 5, 2, 5, 2, 5)):
            numbers = [float(x) for x in re.findall(
                r"\d+(?:\.\d+)?", str(self.sheet.cell(row, column).value))]
            meta = r["measurement_metadata"]["specific_strength"]
            self.assertEqual(meta["reported_value"], numbers[0])
            self.assertEqual(meta["sample_size_n"], len(numbers) - 1)
            self.assertAlmostEqual(meta["canonical_min"], min(numbers[1:]) * 1e6)
            self.assertAlmostEqual(meta["canonical_max"], max(numbers[1:]) * 1e6)
            self.assertNotIn("tensile_strength_Pa", r["values"])
            self.assertIn("population overlap", r["conditions_notes"])
        self.assertEqual(self.records[10]["values"]["specific_strength_N_m_kg"], 5.23e6)

    def test_thin_source_conflicts_are_explicit_not_silent_maxima(self):
        unrolled, rolled = self.records[14:16]
        m = unrolled["measurement_metadata"]["tensile_strength"]
        raw = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", self.sheet["C46"].value)]
        self.assertAlmostEqual(unrolled["values"]["tensile_strength_Pa"],
                               sum(raw[1:]) / len(raw[1:]) * 1e9)
        self.assertIsNone(m["reported_value"])
        self.assertEqual(m["reported_or_derived"], "derived")
        self.assertEqual(m["author_reported_summary"], 12.5)
        self.assertEqual(m["sample_size_n"], 4)
        specific = unrolled["measurement_metadata"]["specific_strength"]
        self.assertEqual(specific["source_recomputed_mean"], 7.4575)
        self.assertEqual(specific["sample_size_n"], 4)
        self.assertEqual(unrolled["values"]["initial_modulus_Pa"], 260e9)
        self.assertEqual(unrolled["values"]["breaking_strain_fraction"], .07)
        for prop in ("initial_modulus", "breaking_strain"):
            self.assertIsNone(unrolled["measurement_metadata"][prop]["sample_size_n"])
        m = rolled["measurement_metadata"]["tensile_strength"]
        self.assertEqual(m["reported_error_upper"], self.sheet["D47"].value)
        self.assertEqual(m["canonical_max"], 12.4e9)
        self.assertIn("0.08", m["source_discrepancy"])
        self.assertEqual(m["sample_size_n"], 3)

    def test_linear_density_geometry_and_context_load_provenance(self):
        expected = ((0, .46, "F16"), (6, .446, "F18"), (8, .438, "F20"),
                    (9, .4, "H17"), (10, .426, "F21"), (11, .4, "H18"),
                    (12, .426, "F22"), (13, .4, "H19"),
                    (16, .4, "H16"), (17, .45, "F17"))
        for index, tex, cell in expected:
            self.assertEqual(tex, self.sheet[cell].value)
            self.assertEqual(self.records[index]["values"]["linear_density_kg_m"], tex * 1e-6)
            self.assertIsNone(self.records[index]["measurement_metadata"]["linear_density"]["sample_size_n"])
        before = self.records[4]["source_facts"]["illustrative_geometry"]
        after = self.records[5]["source_facts"]["illustrative_geometry"]
        self.assertEqual((before["width_um"], before["thickness_um"]), (85.13, 7.34))
        self.assertEqual((after["width_um"], after["thickness_um"]), (541.9, .44))
        points = self.packet["supported_context_series"]["failure_load_and_tex"]["points"]
        self.assertEqual(len(points), 11)
        for point in points:
            column = "D" if point["configuration"] in ("D-CNTF", "DS-CNTF") else "B"
            self.assertAlmostEqual(point["failure_load_N"],
                                   self.sheet[f"{column}{point['source_row']}"].value * .01)


if __name__ == "__main__":
    unittest.main(verbosity=2)
