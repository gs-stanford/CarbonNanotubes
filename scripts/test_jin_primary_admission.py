#!/usr/bin/env python3
"""Independent SI-table checks for Jin's eight primary-source cohorts."""
import hashlib
import json
import re
import subprocess
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import build_combined_database as builder

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/curation/primary_additions/jin_2026.json"
PDF = ROOT / "outputs/fiber_discovery_20261022/jin_audit/an6c00845_si_001.pdf"
DOI = "10.1021/acsanm.6c00845"
SHA256 = "aab9d28a22872337bff30fb6e2b6f50587f6268837a9c4b08f8d0318236741f0"
# Separately transcribed from the actual S14 render; not imported from audit.json.
EXPECTED = [
    "37.09:4.6 6798:662 1.59:0.15 0.757:0.02 2202:71 105.1:10.5",
    "39.81:5.3 6104:750 1.64:0.32 0.9748:0.01 2250:75 108.0:11.3",
    "33.93:5.1 5898:800 1.54:0.2 1.2748:0.02 2240:88 110.2:11.9",
    "73.48:4.5 12420:400 1.16:0.41 0.35:0.01 1050:55 130.65:6.5",
    "61.61:4.3 8620:342 1.25:0.74 0.796:0.01 1163:57 131.2:6.8",
    "53.07:4 7746:444 1.30:0.65 1.084:0.01 1245:73 139.3:6.9",
    "23.72:4.2 2843:321 1.41:0.80 1.887:0.01 1274:84 162.0:7.1",
    "17.31:4.5 1996:551 1.54:0.80 0.736:0.01 1302:79 199.7:7.3",
]
PROPERTIES = [
    ("specific_strength", "specific_strength_N_m_kg", "cN/tex", Decimal("10000")),
    ("specific_modulus", "specific_modulus_N_m_kg", "cN/tex", Decimal("10000")),
    ("breaking_strain", "breaking_strain_fraction", "%", Decimal("0.01")),
    ("linear_density", "linear_density_kg_m", "tex", Decimal("0.000001")),
    ("specific_electrical_conductivity", "specific_electrical_conductivity_S_m2_kg", "S m^2/kg", Decimal(1)),
    ("thermal_conductivity", "thermal_conductivity_W_mK", "W/(m K)", Decimal(1)),
]


class JinPrimaryAdmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads(INPUT.read_text())
        cls.records = cls.payload["records"]

    def test_schema_identity_and_ai_provenance(self):
        self.assertEqual(self.payload["schema_version"], "cpt-curated-records-v1")
        self.assertEqual(self.payload["record_count"], 8)
        self.assertEqual(len(self.records), 8)
        self.assertEqual(len({r["curated_state_id"] for r in self.records}), 8)
        for i, r in enumerate(self.records):
            material = "swcnt" if i < 3 else "pyam-swcnt"
            concentration = [30, 40, 50, 30, 40, 50, 60, 70][i]
            cohort = f"{material}-dope-{concentration}-mg-ml"
            basis = f"primary-source-v1|{DOI}|{cohort}"
            self.assertEqual(r["record_identity_basis"], basis)
            self.assertEqual(r["record_id"], "rec_" + hashlib.sha1(basis.encode()).hexdigest()[:12])
            self.assertEqual(r["source_file"], "jin_2026.json")
            self.assertEqual(r["source_priority"], 0)
            self.assertEqual(r["source_row"], i+1)
            self.assertEqual(r["material_family"], "CNT_or_CNT_hybrid")
            self.assertEqual(r["form_factor"], "fiber_yarn")
            self.assertEqual(r["dataset_provenance"], "ai_source_audited_primary_extraction")
            self.assertEqual(r["primary_source_verification_status"], "ai_source_checked_not_human_adjudicated")
            self.assertEqual(r["curator"], "CPT AI-assisted source audit")
            self.assertFalse(r["source_facts"]["human_adjudicated"])
            self.assertEqual(r["source_citation_class"], "peer_reviewed_research_record")
            self.assertEqual(r["comparison_scope"], "strict_candidate_missing_conditions")
            self.assertEqual(r["specimen_linkage"], "single_source_row_unverified")
            self.assertIn("not identical specimens", r["comparison_note"])
            self.assertEqual(r["normalization_basis"], "unknown")
            for metadata in r["measurement_metadata"].values():
                self.assertFalse(set(metadata).intersection({
                    "unit_inference_review_needed", "dataset_provenance",
                    "primary_source_verification_status", "peer_reviewed_measurement",
                    "public_release_status", "public_release_tier", "public_status",
                    "strict_comparison_ready", "normalized_comparison_eligible",
                    "default_plot_visibility", "public_plot_badge",
                    "contextual_benchmark", "commercial_specsheet_benchmark",
                    "author_curated_compilation_record", "missing_conditions",
                    "cross_form_comparison", "exploratory_comparison_eligible",
                    "doi_verified", "publication_title_verified",
                    "publication_journal_verified", "publication_year_verified",
                }))
            self.assertTrue(r["measurement_metadata"][
                "specific_electrical_conductivity"]["source_unit_review_needed"])

    def test_actual_pdf_matches_all_96_independent_source_numbers(self):
        self.assertEqual(hashlib.sha256(PDF.read_bytes()).hexdigest(), SHA256)
        text = subprocess.check_output([
            "pdftotext", "-f", "14", "-l", "14", "-layout", str(PDF), "-"
        ], text=True)
        self.assertIn("Table S2", text)
        source = re.findall(r"(\d+(?:\.\d+)?)\s*\u00b1\s*(\d+(?:\.\d+)?)", text)
        expected = [tuple(pair.split(":")) for row in EXPECTED for pair in row.split()]
        self.assertEqual(len(source), 48)
        self.assertEqual(source, expected)

    def test_every_canonical_value_error_unit_and_locator(self):
        for r, expected in zip(self.records, EXPECTED):
            self.assertEqual(set(r["values"]), {p[1] for p in PROPERTIES})
            self.assertEqual(set(r["measurement_metadata"]), {p[0] for p in PROPERTIES})
            for (prop, field, unit, factor), pair in zip(PROPERTIES, expected.split()):
                mean, sd = pair.split(":")
                m = r["measurement_metadata"][prop]
                self.assertEqual(m["reported_expression"], f"{mean} +/- {sd}")
                self.assertEqual(m["reported_unit"], unit)
                self.assertEqual(m["reported_value"], float(mean))
                self.assertAlmostEqual(r["values"][field], float(Decimal(mean)*factor), places=12)
                self.assertEqual(m["uncertainty_value_reported"], float(sd))
                self.assertAlmostEqual(m["uncertainty_value_canonical"], float(Decimal(sd)*factor), places=12)
                self.assertEqual(m["uncertainty_type"], "standard_deviation")
                self.assertEqual(m["statistic_type"], "mean")
                self.assertEqual(m["source_document_sha256"], SHA256)
                self.assertIn("p.S14", m["source_locator"])
                self.assertIn(f"row{r['source_row']}", m["source_locator"])
                self.assertEqual(m["reported_or_derived"], "reported")

    def test_no_exact_40_or_shared_condition_invention(self):
        for r in self.records:
            self.assertIsNone(r["sample_size_n"])
            self.assertIsNone(r["condition_temperature_C"])
            self.assertIsNone(r["gauge_length_mm"])
            self.assertIsNone(r["strain_rate_s_inv"])
            for prop, m in r["measurement_metadata"].items():
                self.assertIsNone(m["sample_size_n"])
                if prop in {"specific_strength", "specific_modulus", "breaking_strain"}:
                    self.assertEqual(m["sample_size_n_min"], 40)
                    self.assertEqual(m["sample_size_n_bound_type"], "minimum")
                    self.assertEqual(m["sample_size_n_reported_expression"], "n >= 40")
                    self.assertEqual(m["gauge_length_mm"], 25)
                    self.assertEqual(m["crosshead_speed_mm_min"], 2)
                else:
                    self.assertIsNone(m["sample_size_n_min"])
                    self.assertIsNone(m["gauge_length_mm"])
            thermal = r["measurement_metadata"]["thermal_conductivity"]
            self.assertEqual(thermal["normalization_basis"], "not_applicable")
            self.assertEqual(thermal["pressure_Torr_approx"], 1e-6)
            self.assertEqual(thermal["temperature_rise_bound_type"], "strict_less_than")
            specific = r["measurement_metadata"]["specific_electrical_conductivity"]
            self.assertIn("unresolved", specific["normalization_convention"])
            self.assertIn("abstract", specific["reported_unit_source"])

    def test_held_metrics_are_not_silently_added(self):
        audit = self.payload["omission_audit"]
        self.assertEqual(audit["measurement_count"], 48)
        self.assertEqual(audit["new_canonical_measurements"], 0)
        self.assertIn("No local main text", audit["main_source_gap"])
        self.assertIn("not transferable", audit["other_specimens"])
        for r in self.records:
            held = {h["property"]: h for h in r["held_metrics"]}
            for prop in ["density", "electrical_conductivity", "tensile_strength", "initial_modulus", "specific_thermal_conductivity", "diameter", "ampacity"]:
                self.assertTrue(held[prop]["reason"])
                self.assertNotIn(held[prop]["canonical_field"], r["values"])
            self.assertIsNone(r["measurement_metadata"]["specific_electrical_conductivity"]["density_value_kg_m3"])

    def test_loader_and_48_measurements_in_temporary_storage(self):
        with tempfile.TemporaryDirectory() as temp:
            curation = Path(temp)/"data/curation"
            (curation/"primary_additions").mkdir(parents=True)
            (curation/"primary_additions/jin_2026.json").write_text(json.dumps(self.payload))
            with patch.object(builder, "ROOT", Path(temp)):
                records = builder.read_curated_records()
                if not records:
                    # Existing loader predates parent-owned directory integration.
                    (curation/"reference_benchmarks.json").write_text(json.dumps(self.payload))
                    records = builder.read_curated_records()
                self.assertEqual(len(records), 8)
                measurements = builder.build_measurements(records)
            self.assertEqual(len(measurements), 48)
            self.assertEqual(set(measurements["property"]), {p[0] for p in PROPERTIES})
            self.assertTrue(measurements["sample_size_n"].isna().all())
            self.assertTrue(measurements["statistic_type"].eq("mean").all())
            electrical = measurements[measurements.property.eq("specific_electrical_conductivity")]
            self.assertTrue(electrical["source_unit_review_needed"].eq(True).all())
            self.assertNotIn("unit_inference_review_needed", measurements.columns)
            for r in records:
                subset = measurements[measurements.record_id.eq(r["record_id"])]
                for prop, field, _, _ in PROPERTIES:
                    m = subset[subset.property.eq(prop)].iloc[0]
                    self.assertEqual(m["value_canonical"], r[field])
                    self.assertEqual(m["uncertainty_type"], "standard_deviation")
                    if prop in {"specific_strength", "specific_modulus", "breaking_strain"}:
                        self.assertEqual(m["sample_size_n_min"], 40)
                    else:
                        self.assertTrue(pd.isna(m["sample_size_n_min"]))


if __name__ == "__main__":
    unittest.main()
