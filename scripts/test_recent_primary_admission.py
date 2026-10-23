#!/usr/bin/env python3
"""Independent source-workbook and regression checks for the recent packets."""
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import openpyxl
import pandas as pd

from build_combined_database import build_measurements, read_curated_records, validate_primary_addition
from build_public_release import (build_public_measurements, build_public_records,
                                  duplicate_pair, release_decision)

ROOT = Path(__file__).resolve().parents[1]


def packet(name):
    return json.loads((ROOT / f"data/curation/primary_additions/{name}_2026.json").read_text())


class PrimaryAdmission(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Exercise the shared readers in isolation; never rebuild the release.
        with tempfile.TemporaryDirectory(prefix="sun-liu-admission-") as directory:
            fixture_root = Path(directory)
            additions = fixture_root / "data/curation/primary_additions"
            additions.mkdir(parents=True)
            for name in ("sun", "liu"):
                filename = f"{name}_2026.json"
                (additions / filename).symlink_to(ROOT / "data/curation/primary_additions" / filename)
            with patch("build_combined_database.ROOT", fixture_root):
                cls.loaded = read_curated_records()
        cls.measurements = build_measurements(copy.deepcopy(cls.loaded))
        enriched = []
        for original in cls.loaded:
            # Verified-DOI flags are projection-test fixtures, not new DOI checks.
            record = {**original, "publication_validation_status": "verified_crossref_openalex",
                      "doi_verified": original["doi_raw"], "publication_year_verified": 2026,
                      "publication_title_verified": "Projection fixture",
                      "publication_journal_verified": "Projection fixture"}
            record.update(release_decision(pd.Series(record)))
            enriched.append(record)
        cls.public_records = build_public_records(pd.DataFrame(enriched))
        cls.public_measurements = build_public_measurements(cls.measurements, cls.public_records)
        cls.csv_records = pd.read_csv(io.StringIO(cls.public_records.to_csv(index=False)))
        cls.csv_measurements = pd.read_csv(io.StringIO(cls.public_measurements.to_csv(index=False)))

    def test_sun_unique_controls_and_no_invented_transport(self):
        data = packet("sun")
        self.assertEqual(len(data["records"]), 19)
        self.assertEqual(sum(len(r["values"]) for r in data["records"]), 60)
        records = {r["sample_name"]: r for r in data["records"]}
        self.assertEqual(len(records), 19)
        self.assertNotIn("N-CNTFs", records)
        self.assertNotIn("MoCl5-CNTFs", records)
        self.assertNotIn("N/MoCl5-CNTFs-48 h", records)
        for r in records.values():
            self.assertNotIn("thermal_conductivity_W_mK", r["values"])
            if r["sample_name"] not in {"PCNTFs", "MoCl5-CNTFs-48 h", "N/MoCl5-CNTFs"}:
                self.assertNotIn("density_kg_m3", r["values"])
        self.assertEqual(records["MoCl5/N-CNTFs"]["values"], {"electrical_conductivity_S_m": 12632000})

    def test_sun_source_cells(self):
        book = openpyxl.load_workbook(ROOT / "outputs/fiber_discovery_20261022/sun_doping_audit/41467_2026_69498_MOESM3_ESM.xlsx", data_only=True)
        records = {r["sample_name"]: r for r in packet("sun")["records"]}
        for row in list(book["Supplementary Figure 3g"].values)[2:]:
            r = records[row[0]]
            self.assertAlmostEqual(r["values"]["tensile_strength_Pa"], row[1]*1e9)
            self.assertEqual(r["measurement_metadata"]["tensile_strength"]["uncertainty_value_reported"], row[2])
        for row in list(book["Supplementary Figure 4e"].values)[2:]:
            self.assertAlmostEqual(records[row[0]]["values"]["electrical_conductivity_S_m"], row[1]*1e6)
        book.close()

    def test_sun_summary_completeness_and_normalization(self):
        # Independent references: SI Methods p.4, Tables 2/9 and workbook.
        expected = {
            "PCNTFs": (1820, 11.57e-6, .19e-6, 1.43e6, 4693, 165.755e9, 49.75, 342.8e6),
            "MoCl5-CNTFs-48 h": (1990, 11.34e-6, .21e-6, 1.20e6, 8702, 157.8026e9, 48.54, 763.48184e6),
            "N/MoCl5-CNTFs": (1930, 11.30e-6, .20e-6, 1.29e6, 14166, 147.975e9, 45.25, 1241.38e6),
        }
        fields = ["density_kg_m3", "diameter_m", "linear_density_kg_m", "specific_strength_N_m_kg",
                  "specific_electrical_conductivity_S_m2_kg", "initial_modulus_Pa", "g_d_ratio", "ampacity_A_m2"]
        records = {r["sample_name"]: r for r in packet("sun")["records"]}
        for label, expected_values in expected.items():
            r = records[label]
            for field, value in zip(fields, expected_values):
                self.assertAlmostEqual(r["values"][field] / value, 1, places=12)
            self.assertAlmostEqual(r["values"]["specific_modulus_N_m_kg"],
                r["values"]["initial_modulus_Pa"] / r["values"]["density_kg_m3"])
            density = r["measurement_metadata"]["density"]
            self.assertEqual(density["density_basis"], "density_gradient_column_reported")
            self.assertIsNone(density["uncertainty_value_reported"])
            self.assertEqual(len(density["source_alternatives"]), 1)
            self.assertEqual(r["measurement_metadata"]["linear_density"]["sample_size_n"], 3)
            self.assertIsNone(r["measurement_metadata"]["diameter"]["sample_size_n"])
            for prop in ("specific_strength", "specific_electrical_conductivity"):
                self.assertEqual(r["measurement_metadata"][prop]["reported_or_derived"], "reported")
                self.assertEqual(r["measurement_metadata"][prop]["density_value_kg_m3"], expected_values[0])
            derived = r["measurement_metadata"]["specific_modulus"]
            self.assertEqual(derived["reported_or_derived"], "derived")
            self.assertIsNone(derived["uncertainty_value_reported"])
            self.assertIsNone(derived["sample_size_n"])
        final = records["N/MoCl5-CNTFs"]
        self.assertEqual(final["measurement_metadata"]["specific_strength"]["source_alternatives"][0]["reported_value"], 1.26)
        self.assertIn("difference remains unresolved", final["conditions_notes"])
        self.assertEqual(final["measurement_metadata"]["density"]["source_alternatives"][0]["reported_value"], 1.99)

    def test_liu_source_values_and_scope(self):
        records = packet("liu")["records"]
        self.assertEqual(len(records), 20)
        self.assertEqual(sum(len(r["values"]) for r in records), 88)
        book = openpyxl.load_workbook(ROOT / "outputs/fiber_discovery_20261022/graphene_draw_audit/41563_2026_2733_MOESM10_ESM.xlsx", data_only=True)
        ext = openpyxl.load_workbook(ROOT / "outputs/fiber_discovery_20261022/graphene_draw_audit/41563_2026_2733_MOESM14_ESM.xlsx", data_only=True)
        for record, row in zip(records[:5], list(book["Fig.4f"].values)[1:]):
            self.assertEqual(record["values"]["tensile_strength_Pa"], row[3]*1e9)
            self.assertEqual(record["values"]["thermal_conductivity_W_mK"], row[1])
            self.assertEqual(record["measurement_metadata"]["density"]["extraction_method"], "vector_figure_digitization")
            self.assertAlmostEqual(record["values"]["specific_strength_N_m_kg"],
                                   record["values"]["tensile_strength_Pa"] / record["values"]["density_kg_m3"])
        self.assertEqual({r["gauge_length_mm"] for r in records[5:10]}, {5,10,15,20,25})
        for record, row in zip(records[5:10], list(ext["E.D.Fig.6b"].values)[1:]):
            self.assertEqual(set(record["values"]), {"tensile_strength_Pa", "initial_modulus_Pa"})
            self.assertEqual(record["gauge_length_mm"], row[0])
            for prop, mean_column, sd_column in [("tensile_strength", 1, 2), ("initial_modulus", 3, 4)]:
                meta = record["measurement_metadata"][prop]
                self.assertEqual(meta["reported_value"], row[mean_column])
                self.assertEqual(meta["uncertainty_value_reported"], row[sd_column])
                self.assertEqual(meta["sample_size_n"], 3)
                self.assertEqual(meta["statistic_type"], "mean")
                self.assertEqual(meta["uncertainty_type"], "standard_deviation")
                self.assertEqual(meta["measurement_gauge_length_mm"], row[0])
        for record, row in zip(records[:5], list(ext["E.D.Fig.6d"].values)[1:]):
            meta = record["measurement_metadata"]["initial_modulus"]
            self.assertEqual(meta["reported_value"], row[1])
            self.assertEqual(meta["uncertainty_value_reported"], row[2])
        book.close()
        ext.close()

    def test_liu_five_mm_endpoint_is_a_separate_mechanical_set(self):
        records = {r["sample_name"]: r for r in packet("liu")["records"]}
        draw = records["Graphene fiber, draw ratio 10"]
        gauge = records["Graphene fiber, draw ratio 10, gauge 5 mm"]
        self.assertNotEqual(draw["record_id"], gauge["record_id"])
        self.assertNotEqual(draw["curated_state_id"], gauge["curated_state_id"])
        self.assertFalse(duplicate_pair(pd.Series(draw), pd.Series(gauge))[0])
        self.assertEqual(set(gauge["values"]), {"tensile_strength_Pa", "initial_modulus_Pa"})
        for prop, mean, draw_sd, gauge_sd in [("tensile_strength", 5.89, 0.14, 0.20),
                                             ("initial_modulus", 960, 55, 25)]:
            self.assertEqual(draw["measurement_metadata"][prop]["reported_value"], mean)
            self.assertEqual(gauge["measurement_metadata"][prop]["reported_value"], mean)
            self.assertEqual(draw["measurement_metadata"][prop]["uncertainty_value_reported"], draw_sd)
            self.assertEqual(gauge["measurement_metadata"][prop]["uncertainty_value_reported"], gauge_sd)
            for r in (draw, gauge):
                self.assertIn("specimen independence are unresolved",
                              r["measurement_metadata"][prop]["source_qualification"])
                self.assertEqual(r["specimen_linkage"], "single_source_row_unverified")

    def test_sun_dopant_methods_and_cui_source_correction(self):
        records = {r["sample_name"]: r for r in packet("sun")["records"]}
        for label, temperature in [("N/I2-CNTFs", 200), ("N/CuI-CNTFs", 750), ("N/FeCl3-CNTFs", 360)]:
            record = records[label]
            self.assertEqual(record["heat_treatment_C"], temperature)
            self.assertIsNone(record.get("condition_temperature_C"))
            for notes in (record["conditions_notes"],
                          record["measurement_metadata"]["electrical_conductivity"]["source_qualification"]):
                self.assertIn(f"annealed at {temperature} C", notes)
                self.assertIn("acetone-washed and dried at 60 C", notes)
                self.assertIn("not electrical measurement temperatures", notes)
                self.assertIn("does not isolate dopant chemistry alone", notes)
                self.assertNotIn("MoCl5/MoO3", notes)
        cui = records["N/CuI-CNTFs"]
        meta = cui["measurement_metadata"]["electrical_conductivity"]
        self.assertEqual(meta["reported_value"], 25.97)
        self.assertEqual(meta["uncertainty_value_reported"], 0.09)
        self.assertEqual(meta["uncertainty_value_canonical"], 90000)
        book = openpyxl.load_workbook(ROOT / "outputs/fiber_discovery_20261022/sun_doping_audit/41467_2026_69498_MOESM3_ESM.xlsx", data_only=True, read_only=True)
        self.assertEqual(book["Supplementary Figure 13a"]["A4"].value, "N/CuI-CNTFs")
        self.assertEqual(book["Supplementary Figure 13a"]["C4"].value, 0.09)
        book.close()
        for notes in (meta["source_qualification"], cui["conditions_notes"]):
            self.assertIn("25.97 +/- 0.09 MS/m", notes)
            self.assertIn("Supplementary Figure 13a!B4:C4", notes)
            self.assertIn("article.pdf p.5", notes)
            self.assertIn("was incorrect", notes)
            self.assertIn("Retain SD 0.09 MS/m", notes)

    def test_liu_conflicts_are_attached_to_affected_measurements(self):
        records = {r["sample_name"]: r for r in packet("liu")["records"]}
        expected = [
            ("Graphene fiber, draw ratio 1", "initial_modulus", ["38.1 +/- 67 GPa", "SD exceeds the mean"]),
            ("Graphene fiber, draw ratio 10", "initial_modulus", ["960 GPa", "963 GPa", "SI Table 3", "960 +/- 25 GPa", "960 +/- 55 GPa"]),
            ("Graphene fiber, draw ratio 10", "tensile_strength", ["5.89 +/- 0.14 GPa", "5.89 +/- 0.20 GPa"]),
            ("Graphene fiber, draw ratio 10", "electrical_conductivity", ["1.3301 MS/m", "1.35 MS/m", "SI Table 3"]),
        ]
        for label, prop, fragments in expected:
            record = records[label]
            for notes in (record["conditions_notes"], record["measurement_metadata"][prop]["source_qualification"]):
                for fragment in fragments:
                    self.assertIn(fragment, notes)
        for record in list(records.values())[:5]:
            thermal = record["measurement_metadata"]["thermal_conductivity"]["source_qualification"]
            self.assertIn("10^4 Pa", thermal)
            self.assertIn("inconsistency is unresolved", thermal)
            for prop in ("electrical_conductivity", "density"):
                meta = record["measurement_metadata"][prop]
                self.assertEqual(meta["extraction_method"], "vector_figure_digitization")
                self.assertIn("approximate figure coordinates", meta["source_qualification"])
                self.assertIn("not experimental SD", meta["source_qualification"])

    def test_qualifications_survive_loader_and_public_csv_projection(self):
        long = self.measurements.set_index(["record_id", "property"])
        public = self.csv_measurements.set_index(["record_id", "property"])
        records = self.csv_records.set_index("record_id")
        for name in ("sun", "liu"):
            for r in packet(name)["records"]:
                self.assertEqual(records.loc[r["record_id"], "conditions_notes"], r["conditions_notes"])
                for prop, meta in r["measurement_metadata"].items():
                    if "source_qualification" not in meta:
                        continue
                    key = (r["record_id"], prop)
                    self.assertEqual(long.loc[key, "source_qualification"], meta["source_qualification"])
                    self.assertEqual(public.loc[key, "source_qualification"], meta["source_qualification"])
                    self.assertNotIn("packet source_discrepancies", public.loc[key, "source_qualification"])
        self.assertEqual(len(self.csv_records), 39)
        self.assertEqual(len(self.csv_measurements[self.csv_measurements.source_file.eq("sun_2026.json")]), 60)
        liu = self.csv_measurements[self.csv_measurements.source_file.eq("liu_2026.json")]
        self.assertEqual(len(liu), 88)
        self.assertEqual(len(liu[~liu.property.eq("specific_volume")]), 74)
        self.assertFalse(self.csv_records.strict_comparison_ready.any())
        self.assertTrue(self.csv_records.primary_source_verification_status.eq(
            "ai_source_checked_not_human_adjudicated").all())
        self.assertEqual(liu.property.isin(["specific_strength", "specific_modulus",
            "specific_electrical_conductivity", "specific_thermal_conductivity"]).sum(), 20)

    def test_liu_ratios_are_explicitly_derived_not_new_measurements(self):
        expected = [
            (0.165388, 28.642168, .406133, .625467),
            (1.584204, 178.298274, .518089, .680666),
            (2.212396, 332.146718, .632190, .779223),
            (2.597706, 450.762839, .661344, .814230),
            (2.872835, 468.237918, .648767, .838926),
        ]
        props = [("specific_strength", "specific_strength_N_m_kg", 1e6),
                 ("specific_modulus", "specific_modulus_N_m_kg", 1e6),
                 ("specific_electrical_conductivity", "specific_electrical_conductivity_S_m2_kg", 1e3),
                 ("specific_thermal_conductivity", "specific_thermal_conductivity_W_m2_K_kg", 1)]
        for r, values in zip(packet("liu")["records"][:5], expected):
            for (prop, field, scale), value in zip(props, values):
                self.assertAlmostEqual(r["values"][field]/scale, value, delta=1e-6)
                m = r["measurement_metadata"][prop]
                self.assertEqual(m["reported_or_derived"], "derived")
                self.assertEqual(m["normalization_basis"], "derived_from_density")
                self.assertIsNone(m["reported_value"])
                self.assertIsNone(m["sample_size_n"])
                self.assertIsNone(m["uncertainty_value_canonical"])
                self.assertEqual(m["statistic_type"], "unspecified")
                self.assertEqual(m["input_provenance"]["record_id"], r["record_id"])
                self.assertIn("not direct load-per-linear-mass", m["source_qualification"])
            self.assertEqual(r["measurement_metadata"]["specific_volume"]["statistic_type"], "unspecified")
        for r in packet("liu")["records"][5:]:
            self.assertFalse(any(prop in r["measurement_metadata"] for prop, _, _ in props))

    def test_per_property_n_is_not_overwritten(self):
        record = self.loaded[0].copy()
        record["sample_size_n"] = 20
        record["measurement_metadata_json"] = json.dumps({"density": {"sample_size_n": None},
            "tensile_strength": {"sample_size_n": 3}})
        record.update(density_kg_m3=1000, tensile_strength_Pa=1e9)
        rows = build_measurements([record]).set_index("property")
        self.assertTrue(pd.isna(rows.loc["density", "sample_size_n"]))
        self.assertEqual(rows.loc["tensile_strength", "sample_size_n"], 3)

    def test_liu_raman_reciprocal_and_no_draw_two_borrowing(self):
        records = {r["curated_state_id"].split("|")[1]: r for r in packet("liu")["records"]}
        expected_dg = {1: .0410515, 2: .0391635, 4: .0373447, 6: .0261453, 8: .0168484, 10: .00523340}
        for draw, dg in expected_dg.items():
            r = records[f"draw-{draw}"]
            self.assertAlmostEqual(1/r["values"]["g_d_ratio"], dg, delta=1e-7)
            m = r["measurement_metadata"]["g_d_ratio"]
            self.assertEqual(m["reported_or_derived"], "derived")
            self.assertIsNone(m["reported_value"])
            self.assertIsNone(m["sample_size_n"])
            self.assertIsNone(m["uncertainty_value_canonical"])
            lo, hi = m["digitization_sensitivity_interval"]
            self.assertLess(lo, r["values"]["g_d_ratio"])
            self.assertGreater(hi, r["values"]["g_d_ratio"])
        self.assertEqual(set(records["draw-2"]["values"]), {"g_d_ratio"})

    def test_liu_thermal_and_precursor_geometry_stay_separate(self):
        records = {r["curated_state_id"].split("|")[1]: r for r in packet("liu")["records"]}
        for draw, rho in [(1,.830161),(4,1.130030),(6,1.240169),(8,1.329955),(10,1.429918)]:
            r = records[f"precursor-gof-draw-{draw}"]
            self.assertEqual(set(r["values"]), {"density_kg_m3", "specific_volume_m3_kg"})
            self.assertAlmostEqual(r["values"]["density_kg_m3"]/1000, rho, delta=1e-6)
        for state, diameter, rho in [("urdgof",17.103302,1.429793), ("urdgf-200",11.301704,1.599592),
                                     ("urdgf-1600",9.603110,1.800083), ("urdgf-2800",8.300147,2.050417)]:
            r = records[f"thermal-summary-{state}"]
            self.assertEqual(set(r["values"]), {"diameter_m", "density_kg_m3", "specific_volume_m3_kg"})
            self.assertAlmostEqual(r["values"]["diameter_m"]*1e6, diameter, delta=1e-6)
            self.assertAlmostEqual(r["values"]["density_kg_m3"]/1000, rho, delta=1e-6)
            for prop in ("density", "diameter"):
                self.assertEqual(r["measurement_metadata"][prop]["sample_size_n"], 3)
            if state in ("urdgof", "urdgf-2800"):
                self.assertIn("not an additional independent specimen population", r["conditions_notes"])

    def test_equal_values_do_not_merge_explicitly_different_states(self):
        row = dict(material_family="CNT_or_CNT_hybrid", form_factor="fiber_yarn", doi_verified="10.1038/s41467-026-69498-7",
            tensile_strength_Pa=2e9, electrical_conductivity_S_m=1e7, sample_name="control")
        a, b = pd.Series({**row, "curated_state_id":"dose-1"}), pd.Series({**row, "curated_state_id":"dose-2"})
        self.assertFalse(duplicate_pair(a,b)[0])

    def test_import_cannot_silently_drop_primary_fields_or_provenance(self):
        original = next(r for r in packet("sun")["records"] if r["sample_name"] == "N/MoCl5-CNTFs")
        missing_meta = copy.deepcopy(original)
        del missing_meta["measurement_metadata"]["density"]
        with self.assertRaisesRegex(ValueError, "matching property-level metadata"):
            validate_primary_addition(missing_meta)
        unknown = copy.deepcopy(original)
        unknown["values"]["density_kg_m_3"] = 1930
        with self.assertRaisesRegex(ValueError, "silently dropped"):
            validate_primary_addition(unknown)
        missing_value = copy.deepcopy(original)
        del missing_value["values"]["density_kg_m3"]
        with self.assertRaisesRegex(ValueError, "matching property-level metadata"):
            validate_primary_addition(missing_value)


if __name__ == "__main__":
    unittest.main()
