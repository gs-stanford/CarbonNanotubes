"""Release correction regression checks against the preserved source tables."""
import json
import unittest
from pathlib import Path
import pandas as pd
from apply_source_corrections import apply_source_corrections, CORRECTIONS
from specimen_forms import validate_specimen_forms
from build_combined_database import infer_form_factor, james_form_factor

ROOT = Path(__file__).resolve().parents[1]


class SourceCorrectionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = pd.read_csv(ROOT / "data/curation/record_curation_queue.csv", low_memory=False)
        cls.measurements = pd.read_csv(ROOT / "data/processed/measurements_long.csv", low_memory=False)
        cls.r, cls.m, cls.audit = apply_source_corrections(cls.records, cls.measurements)

    def test_untargeted_rows_unchanged(self):
        ids = {r["record_id"] for r in json.loads(CORRECTIONS.read_text())["corrections"]}
        pd.testing.assert_frame_equal(self.records[~self.records.record_id.isin(ids)], self.r[~self.r.record_id.isin(ids)], check_dtype=False)
        pd.testing.assert_frame_equal(self.measurements[~self.measurements.record_id.isin(ids)], self.m[~self.m.record_id.isin(ids)], check_dtype=False)

    def test_forms_and_supported_properties(self):
        r = self.r.set_index("record_id")
        for rid in ("rec_170355132b02", "rec_f562bb7a24e6", "rec_c08319e3ced9"):
            self.assertEqual(r.loc[rid, "form_factor"], "micro_nanoscale_device")
        for rid in ("rec_38c78c9c3219", "rec_4e0f7ff3b136", "rec_0ac7a7d10e72", "rec_7a9c079963dd", "rec_fc1191f385c6", "rec_ec7066ef15ac", "rec_b48842d5bf66"):
            self.assertEqual(r.loc[rid, "form_factor"], "bulk_single_crystal")
        self.assertEqual(r.loc["rec_c5a51ae37304", "form_factor"], "bulk")
        self.assertEqual(r.loc["rec_c7134422540f", "form_factor"], "forest_array")
        self.assertEqual(r.loc["rec_480748669f11", "form_factor"], "forest_array")
        self.assertEqual(r.loc["rec_11b3ed359d75", "sample_name"], "Joule-annealed at 4 W for 1 min")
        self.assertEqual(r.loc["rec_b056a1c60ab4", "source_citation_class"], "commercial_or_web_specsheet_comparator")
        self.assertEqual(r.loc["rec_b1b91c62dbc3", "form_factor"], "fiber_yarn")
        self.assertEqual(r.loc["rec_53fb92f01141", "thermal_conductivity_W_mK"], 770)
        self.assertEqual(r.loc["rec_0932899f727c", "electrical_conductivity_S_m"], 22000)
        for rid, props in {"rec_53fb92f01141": ["electrical_conductivity", "specific_electrical_conductivity"],
                           "rec_0932899f727c": ["thermal_conductivity", "specific_thermal_conductivity"]}.items():
            self.assertFalse((self.m.record_id.eq(rid) & self.m.property.isin(props)).any())

    def test_explicit_values_and_estimates(self):
        r = self.r.set_index("record_id")
        self.assertEqual(r.loc["rec_995fa42d32dc", "thermal_conductivity_W_mK"], 380)
        self.assertAlmostEqual(r.loc["rec_995fa42d32dc", "specific_thermal_conductivity_W_m2_K_kg"], 380/1300)
        child = self.m[self.m.record_id.eq("rec_995fa42d32dc") & self.m.property.eq("specific_thermal_conductivity")].iloc[0]
        self.assertEqual(json.loads(child.derivation_inputs_json)["thermal_conductivity_W_mK"], 380)
        self.assertEqual(r.loc["rec_4320625341dc", "thermal_conductivity_W_mK"], 635)
        for rid in ("rec_f2f3cce2b592", "rec_349415424f86"):
            m = self.m[self.m.record_id.eq(rid) & self.m.property.eq("thermal_conductivity")].iloc[0]
            self.assertEqual(m.reported_or_derived, "source_estimate")
            self.assertTrue(m.source_qualification)

    def test_duplicate_aliases_cannot_reappear(self):
        r = pd.read_csv(ROOT / "data/public/public_records_v0.csv")
        for rid in ("rec_7ad5b7a404bd", "rec_25823ba0ae4b", "rec_da38ec45d92d"):
            self.assertNotIn(rid, set(r.record_id))
        self.assertIn("rec_995fa42d32dc", set(r.record_id))

    def test_stale_source_values_fail_closed(self):
        r = self.records.copy()
        r.loc[r.record_id.eq("rec_995fa42d32dc"), "thermal_conductivity_W_mK"] = 999
        with self.assertRaisesRegex(ValueError, "Source value changed"):
            apply_source_corrections(r, self.measurements)

    def test_form_inference_requires_specimen_evidence(self):
        for family in ("CNT_or_CNT_hybrid", "carbon_fiber_comparator", "metal_comparator"):
            self.assertEqual(infer_form_factor(family, "Sample A", "not reported"), "unknown")
        self.assertEqual(infer_form_factor("CNT_or_CNT_hybrid", "Individual CNT", ""), "individual_nanotube_or_bundle")
        self.assertEqual(infer_form_factor("graphene_or_GO_fiber", "Graphene nanoribbon device", ""), "micro_nanoscale_device")
        self.assertEqual(infer_form_factor("graphene_or_GO_fiber", "Nanoribbon assembly fiber", ""), "fiber_yarn")
        self.assertEqual(james_form_factor("Carbon fiber", "Carbon fibers", "Single Crystal Graphite", "other_carbon_comparator"), "bulk_single_crystal")
        self.assertEqual(james_form_factor("CNT", "Materials paper on fibers", "Sample A", "CNT_or_CNT_hybrid"), "unknown")
        self.assertEqual(james_form_factor("CNT fibers", "Materials paper", "Sample A", "CNT_or_CNT_hybrid"), "fiber_yarn")

    def test_misclassified_reference_rejected(self):
        for rid, wrong_form in (("rec_7a9c079963dd", "fiber_yarn"), ("rec_170355132b02", "sheet_mat_film")):
            records = self.r.copy()
            records.loc[records.record_id.eq(rid), "form_factor"] = wrong_form
            with self.assertRaisesRegex(ValueError, "Specimen form contradicts"):
                validate_specimen_forms(records, self.m)

    def test_measurement_form_must_follow_specimen(self):
        measurements = self.m.copy()
        measurements.loc[measurements.record_id.eq("rec_7a9c079963dd"), "form_factor"] = "fiber_yarn"
        with self.assertRaisesRegex(ValueError, "Measurement specimen form differs"):
            validate_specimen_forms(self.r, measurements)


if __name__ == "__main__":
    unittest.main()
