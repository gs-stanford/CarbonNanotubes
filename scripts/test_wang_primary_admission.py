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
        self.assertEqual(len(self.records), 6)
        self.assertEqual(len({r["curated_state_id"] for r in self.records}), 6)
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
                 "initial_modulus": "GPa", "breaking_strain": "%"}
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
        self.assertEqual(count, 9)

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
        self.assertEqual(len(self.loaded), 6)
        self.assertEqual(len(self.measurements), self.packet["measurement_count"])
        self.assertEqual(len(self.measurements), 9)
        for _, m in self.measurements.iterrows():
            prop = m["property"]
            n = m["sample_size_n"]
            if prop == "tensile_strength":
                self.assertEqual(n, 5)
            elif prop == "specific_strength":
                self.assertEqual(n, 3)
            else:
                self.assertTrue(n is None or math.isnan(n))
            self.assertTrue(m["source_document_sha256"])
            self.assertTrue(m["source_locator"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
