#!/usr/bin/env python3
"""Independently transcribed Li Table S5 admission checks; no release writes."""
from __future__ import annotations

import copy
import hashlib
import itertools
import json
import subprocess
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from build_combined_database import build_measurements, read_curated_records
from build_public_release import duplicate_pair, release_decision


ROOT = Path(__file__).resolve().parents[1]
ADMISSION = ROOT / "data/curation/primary_additions/li_2026.json"
DOI = "10.1021/acsnano.5c14235"
STATUS = "ai_source_checked_not_human_adjudicated"
SI_SHA256 = "de115d028147a135a7b9d54a04c9def2f85892a6dfaaf61835d9ee8435d85c9f"
MAIN_SHA256 = "5a13f637332e1ddd0b0a23f8d45a93f3dab984bd79128ea570f210bbc30514fb"

# Transcribed directly from primary Table S5 p.29 and Table S2 p.26. Expectations
# do not import the extraction audit or derive expected data from the admission.
# Each mechanical tuple is (mean, SD, printed 95% CI lower, printed 95% CI upper).
AUDITED = (
    ("fcntfs", "FCNTFs", ("1.35", "0.04", "1.28", "1.41"),
     ("37.49", "4.26", "30.71", "44.27"), "0.95",
     ("40.32", "3.60", "34.60", "46.04")),
    ("csa_cntfs", "CSA-CNTFs", ("5.32", "0.10", "5.16", "5.48"),
     ("113.37", "9.74", "98.94", "126.53"), "3.42",
     ("143.06", "6.36", "134.72", "149.63")),
    ("pipd_cntfs", "PIPD-CNTFs", ("5.80", "0.15", "5.56", "6.03"),
     ("137.70", "15.36", "113.26", "162.14"), "1.83",
     ("165.93", "11.32", "148.02", "183.84")),
    ("cl_pipd_cntfs", "CL-PIPD-CNTFs", ("6.36", "0.12", "6.16", "6.56"),
     ("167.63", "5.60", "158.73", "176.53"), "2.14",
     ("149.47", "10.36", "132.98", "165.96")),
    ("d_cl_pipd_cntfs", "D-CL-PIPD-CNTFs", ("8.45", "0.28", "8.12", "8.78"),
     ("203.99", "8.66", "193.24", "214.74"), "2.60",
     ("238.42", "14.78", "220.18", "252.73")),
    ("pipd_0p05wt_csa_cntfs", "0.05 wt%-PIPD/CSA-CNTFs", ("5.54", "0.22", "5.20", "5.88"),
     ("129.36", "10.58", "112.53", "146.19"), None,
     ("160.12", "14.42", "137.18", "183.06")),
    ("pipd_0p2wt_csa_cntfs", "0.2 wt%-PIPD/CSA-CNTFs", ("5.66", "0.12", "5.49", "5.84"),
     ("130.90", "8.06", "118.08", "143.72"), None,
     ("151.13", "11.63", "132.63", "169.63")),
)
FIELDS = {
    "tensile_strength": ("tensile_strength_Pa", "GPa", "Pa", Decimal("1e9")),
    "initial_modulus": ("initial_modulus_Pa", "GPa", "Pa", Decimal("1e9")),
    "electrical_conductivity": ("electrical_conductivity_S_m", "MS/m", "S/m", Decimal("1e6")),
}


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


class LiPrimaryAdmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads(ADMISSION.read_text(), object_pairs_hook=unique_keys)
        cls.records = cls.payload["records"]
        cls.by_cohort = {r["stable_cohort"]: r for r in cls.records}
        # Exercise the real loader without depending on other in-progress packets.
        with tempfile.TemporaryDirectory(prefix="cpt-li-admission-") as directory:
            fixture_root = Path(directory)
            additions = fixture_root / "data/curation/primary_additions"
            additions.mkdir(parents=True)
            (additions / "li_2026.json").symlink_to(ADMISSION)
            with patch("build_combined_database.ROOT", fixture_root):
                cls.loaded = read_curated_records()
        cls.measurements = build_measurements(copy.deepcopy(cls.loaded))

    def test_schema_identity_and_state_uniqueness(self):
        self.assertEqual(self.payload["schema_version"], "cpt-curated-records-v1")
        self.assertEqual(self.payload["record_count"], 7)
        self.assertEqual(self.payload["measurement_count"], 19)
        self.assertEqual(len(self.records), 7)
        self.assertEqual(len(self.by_cohort), 7)
        self.assertEqual(set(self.by_cohort), {row[0] for row in AUDITED})
        for index, (cohort, name, *_rest) in enumerate(AUDITED, 1):
            r = self.by_cohort[cohort]
            expected_id = "rec_" + hashlib.sha1(
                f"primary-source-v1|{DOI}|{cohort}".encode("utf-8")
            ).hexdigest()[:12]
            self.assertEqual(r["record_id"], expected_id)
            self.assertEqual(r["curated_state_id"], f"{DOI}|{cohort}")
            self.assertEqual(r["record_label"], name)
            self.assertEqual(r["source_row"], index if index <= 5 else {6: 2, 7: 4}[index])
            self.assertEqual(r["source_sheet"], "Table S5" if index <= 5 else "Table S2")
            self.assertEqual(r["source_file"], "li_2026.json")
            self.assertEqual(r["source_priority"], 0)
            self.assertEqual(r["doi_raw"], DOI)
        self.assertEqual(len({r["record_id"] for r in self.records}), 7)
        self.assertEqual(len({r["curated_state_id"] for r in self.loaded}), 7)

    def test_original_audited_arrays_and_si_conversions(self):
        for cohort, _name, strength, modulus, conductivity, _toughness in AUDITED:
            r = self.by_cohort[cohort]
            for prop, cell in zip(FIELDS, (strength, modulus, (conductivity,))):
                if prop == "electrical_conductivity" and conductivity is None:
                    self.assertNotIn(prop, r["measurement_metadata"])
                    self.assertNotIn(FIELDS[prop][0], r["values"])
                    continue
                with self.subTest(cohort=cohort, property=prop):
                    field, unit, _canonical_unit, factor = FIELDS[prop]
                    meta = r["measurement_metadata"][prop]
                    self.assertEqual(Decimal(str(meta["reported_value"])), Decimal(cell[0]))
                    self.assertEqual(meta["reported_unit"], unit)
                    self.assertEqual(meta["reported_or_derived"], "reported")
                    self.assertEqual(Decimal(str(meta["conversion_factor_to_canonical"])), factor)
                    self.assertEqual(Decimal(str(r["values"][field])), Decimal(cell[0]) * factor)
                    self.assertIsNone(meta["derivation_formula"])
                    if prop != "electrical_conductivity":
                        self.assertEqual(meta["reported_expression"], f"{cell[0]} +/- {cell[1]}")
                        self.assertEqual(Decimal(str(meta["uncertainty_value_reported"])), Decimal(cell[1]))
                        self.assertEqual(Decimal(str(meta["uncertainty_value_canonical"])), Decimal(cell[1]) * factor)
                        self.assertEqual(meta["uncertainty_type"], "standard_deviation")
                        self.assertEqual(meta["statistic_type"], "mean")
                        self.assertEqual(meta["confidence_interval_reported_expression"], f"{cell[2]} ~ {cell[3]}")
                        self.assertEqual([Decimal(str(x)) for x in meta["confidence_interval_95_reported"]],
                                         [Decimal(x) for x in cell[2:]])
                        self.assertEqual([Decimal(str(x)) for x in meta["confidence_interval_95_canonical"]],
                                         [Decimal(x) * factor for x in cell[2:]])
                    else:
                        self.assertEqual(meta["reported_expression"], conductivity)
                        self.assertEqual(meta["statistic_type"], "unspecified")
                        self.assertEqual(meta["uncertainty_type"], "not_reported")
                        self.assertIsNone(meta["uncertainty_value_reported"])
                        self.assertIsNone(meta["uncertainty_value_canonical"])
                        self.assertIsNone(meta["confidence_interval_95_reported"])

    def test_n_is_a_property_specific_lower_bound_not_exact_four(self):
        for r in self.records:
            self.assertIsNone(r["sample_size_n"])
            for prop, meta in r["measurement_metadata"].items():
                self.assertIsNone(meta["sample_size_n"])
                expected_minimum = None if prop == "electrical_conductivity" else 4
                self.assertEqual(meta["sample_size_n_minimum"], expected_minimum)
        self.assertTrue(self.measurements["sample_size_n"].isna().all())
        mechanical = self.measurements[~self.measurements.property.eq("electrical_conductivity")]
        electrical = self.measurements[self.measurements.property.eq("electrical_conductivity")]
        self.assertTrue(mechanical.sample_size_n_minimum.eq(4).all())
        self.assertTrue(electrical.sample_size_n_minimum.isna().all())
        # Explicit property-level unknown n must defeat a legacy row-level count.
        probe = copy.deepcopy(self.loaded[0])
        probe["sample_size_n"] = 99
        self.assertTrue(build_measurements([probe]).sample_size_n.isna().all())

    def test_document_hashes_and_measurement_locators(self):
        for kind, digest in (("si", SI_SHA256), ("main", MAIN_SHA256)):
            document = self.payload["documents"][kind]
            self.assertEqual(document["sha256"], digest)
            self.assertEqual(hashlib.sha256((ROOT / document["path"]).read_bytes()).hexdigest(), digest)
        for r in self.records:
            for prop, meta in r["measurement_metadata"].items():
                self.assertEqual(meta["source_document_sha256"], SI_SHA256)
                self.assertEqual(meta["source_document_path"], self.payload["documents"]["si"]["path"])
                page = 29 if r["source_sheet"] == "Table S5" else 26
                self.assertEqual(meta["source_pdf_page"], page)
                self.assertEqual(meta["source_printed_page"], page)
                self.assertIn(r["record_label"] + " row", meta["source_locator"])
                self.assertIn(r["source_sheet"], meta["source_locator"])
                self.assertEqual(meta["methods_pdf_page"], 4 if prop == "electrical_conductivity" else 2)
            self.assertEqual(r["source_facts"]["recipe_source_document_sha256"], MAIN_SHA256)

    def test_no_human_adjudication_or_same_filament_claim(self):
        self.assertEqual(self.payload["review_status"], STATUS)
        for r in self.records:
            self.assertEqual(r["dataset_provenance"], "ai_source_audited_primary_extraction")
            self.assertEqual(r["primary_source_verification_status"], STATUS)
            self.assertEqual(r["review_status"], STATUS)
            self.assertEqual(r["curator"], "CPT AI-assisted source audit")
            self.assertEqual(r["specimen_linkage"], "single_source_row_unverified")
            self.assertIn("Same named cohort", r["specimen_linkage_notes"])
            self.assertIn("not confirmed", r["specimen_linkage_notes"])
            self.assertIsNone(r["specimen_id"])
            self.assertIsNone(r["sample_batch_id"])
            self.assertNotIn("human_duplicate_decision", r)
            for meta in r["measurement_metadata"].values():
                self.assertEqual(meta["review_status"], STATUS)

    def test_import_retains_nineteen_supported_measurements(self):
        self.assertEqual(len(self.loaded), 7)
        self.assertEqual(len(self.measurements), 19)
        self.assertEqual(set(self.measurements.property), set(FIELDS))
        self.assertEqual(self.measurements.measurement_id.nunique(), 19)
        for row in self.loaded:
            self.assertEqual(row["material_family"], "CNT_or_CNT_hybrid")
            self.assertEqual(row["form_factor"], "fiber_yarn")
            self.assertEqual(row["comparison_scope"], "strict_candidate_missing_conditions")
            self.assertEqual(row["source_citation_class"], "peer_reviewed_research_record")
            original = self.by_cohort[row["stable_cohort"]]
            self.assertEqual(json.loads(row["raw_payload_json"]), original)
            expected_properties = set(original["measurement_metadata"])
            self.assertEqual(set(original["values"]), {FIELDS[prop][0] for prop in expected_properties})
            for prop, (field, _unit, canonical_unit, _factor) in FIELDS.items():
                match = self.measurements[(self.measurements.record_id == row["record_id"])
                                          & (self.measurements.property == prop)]
                if prop not in expected_properties:
                    self.assertEqual(len(match), 0)
                    continue
                self.assertEqual(len(match), 1)
                self.assertEqual(match.iloc[0].value_canonical, original["values"][field])
                self.assertEqual(match.iloc[0].unit_canonical, canonical_unit)
            for field in ("density_kg_m3", "linear_density_kg_m", "diameter_m", "rupture_work_J_kg",
                          "specific_strength_N_m_kg", "specific_modulus_N_m_kg",
                          "specific_electrical_conductivity_S_m2_kg", "breaking_strain_fraction"):
                self.assertIsNone(row.get(field))

    def test_method_conditions_do_not_invent_area_or_gauge(self):
        for r in self.records:
            self.assertIsNone(r["gauge_length_mm"])
            self.assertIsNone(r["strain_rate_s_inv"])
            for prop in ("tensile_strength", "initial_modulus"):
                meta = r["measurement_metadata"][prop]
                self.assertEqual(meta["specimen_length_mm_reported"], 10)
                self.assertEqual(meta["crosshead_speed_mm_min"], 1)
                self.assertIsNone(meta["gauge_length_mm"])
                self.assertIsNone(meta["strain_rate_s_inv"])
                self.assertIn("SEM/ImageJ", meta["cross_section_method"])
                self.assertIn("load-cell capacity", meta["conditions_notes"])
                self.assertIsNone(meta["condition_temperature_C"])
                self.assertIsNone(meta["condition_atmosphere"])
            self.assertIn("0.1-0.5%", r["measurement_metadata"]["initial_modulus"]["measurement_definition"])
            if "electrical_conductivity" not in r["measurement_metadata"]:
                continue
            electrical = r["measurement_metadata"]["electrical_conductivity"]
            self.assertIsNone(electrical["cross_section_method"])
            self.assertIn("Voltage-tap separation", electrical["conditions_notes"])
            self.assertIn("Keithley 2450", electrical["measurement_method"])

    def test_distinct_cohorts_survive_same_paper_deduplication(self):
        for a, b in itertools.combinations(self.loaded, 2):
            is_duplicate, _score, reason = duplicate_pair(pd.Series(a), pd.Series(b))
            self.assertFalse(is_duplicate)
            self.assertEqual(reason, "explicitly_distinct_source_configurations")

    def test_public_admission_keeps_source_and_pairing_qualifications(self):
        for r in self.loaded:
            # This is a unit-test fixture, not a claimed DOI validation or a release.
            pending = {**r, "publication_validation_status": "not_checked"}
            self.assertFalse(release_decision(pd.Series(pending))["include_public_v0"])
            verified_fixture = {**r, "publication_validation_status": "verified_crossref_openalex"}
            decision = release_decision(pd.Series(verified_fixture))
            self.assertTrue(decision["include_public_v0"])
            self.assertFalse(decision["strict_comparison_ready"])
            self.assertEqual(decision["primary_source_verification_status"], STATUS)
            self.assertEqual(decision["dataset_provenance_detail"], "ai_source_audited_primary_extraction")
            self.assertIn("not independently human-adjudicated", decision["source_disclosure"])
            self.assertIn("identical filament", decision["source_disclosure"])

    def test_toughness_is_held_in_its_original_volumetric_units(self):
        held = {item["id"]: item for item in self.payload["held_list"]}
        toughness = held["volumetric_toughness"]
        self.assertEqual(toughness["reported_unit"], "MJ/m^3")
        self.assertEqual(toughness["status"], "supported_context_noncanonical_dimension")
        self.assertEqual(len(toughness["rows"]), 7)
        by_name = {r["cohort"]: r for r in toughness["rows"]}
        for _cohort, name, _strength, _modulus, _conductivity, expected in AUDITED:
            actual = by_name[name]
            self.assertEqual(Decimal(str(actual["mean"])), Decimal(expected[0]))
            self.assertEqual(Decimal(str(actual["sd"])), Decimal(expected[1]))
            self.assertEqual([Decimal(str(x)) for x in actual["ci95"]], [Decimal(x) for x in expected[2:]])
        self.assertEqual(held["optimization_controls_S3_S4"]["status"], "excluded_conflicting_cohort_labels")
        self.assertEqual(held["conductivity_fold_claim"]["status"], "excluded_conflicting_narrative_multiplier")
        self.assertIn("impact_specific_energy", held)
        self.assertIn("failure_load_conductance_and_area_free_ratio", held)
        impact = self.by_cohort["cl_pipd_cntfs"]["context_measurements"][1]
        self.assertEqual(impact["property"], "specific_penetration_energy")
        self.assertEqual(impact["reported_value"], 1.26)
        self.assertEqual(impact["uncertainty_value_reported"], 0.04)
        self.assertEqual(impact["uncertainty_type"], "unspecified")
        self.assertNotIn("rupture_work_J_kg", self.by_cohort["cl_pipd_cntfs"]["values"])

    def test_omission_recovery_matches_actual_pdf_and_does_not_copy_transport(self):
        text = subprocess.check_output([
            "pdftotext", "-f", "26", "-l", "26", "-layout",
            str(ROOT / self.payload["documents"]["si"]["path"]), "-",
        ], text=True)
        lines = {line.split()[0]: line for line in text.splitlines()
                 if line.strip().startswith(("0.05 wt%", "0.2 wt%"))}
        for row in AUDITED[-2:]:
            cohort, name, strength, modulus, _sigma, toughness = row
            source_line = lines[name.split()[0]]
            for value in strength + modulus + toughness:
                self.assertIn(value, source_line)
            r = self.by_cohort[cohort]
            self.assertEqual(set(r["values"]), {"tensile_strength_Pa", "initial_modulus_Pa"})
            self.assertNotIn("herman_orientation_factor", r["source_facts"])
        for row in AUDITED:
            r = self.by_cohort[row[0]]
            context = r["context_measurements"][0]
            self.assertEqual(context["unit_canonical"], "J/m^3")
            self.assertEqual(Decimal(str(context["reported_value"])), Decimal(row[-1][0]))
            self.assertEqual(Decimal(str(context["value_canonical"])), Decimal(row[-1][0]) * Decimal("1e6"))
            self.assertNotIn("rupture_work_J_kg", r["values"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
