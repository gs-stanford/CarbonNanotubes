import os
import tempfile
import unittest
from pathlib import Path

from carbon_property_tables import CPTClient, TemporaryPoint


@unittest.skipUnless(os.environ.get("CPT_LIVE_TEST_URL"), "CPT_LIVE_TEST_URL is not set")
class LiveApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = CPTClient(os.environ["CPT_LIVE_TEST_URL"])

    def test_release_properties_and_bounded_figure(self):
        release = self.client.release()
        self.assertEqual(release["api_version"], "v1")
        self.assertGreater(release["release"]["record_count"], 0)
        self.assertTrue(self.client.properties())
        status = self.client.doi_status("10.1126/science.adj1082")
        self.assertTrue(status.in_database)
        self.assertIsNotNone(status.title)

        figure = self.client.scatter(
            "specific_strength",
            "specific_electrical_conductivity",
            material_family="CNT_or_CNT_hybrid",
            top=3,
            temporary=TemporaryPoint(1.8, 12.0, "Candidate"),
            log_x=True,
            log_y=True,
        )
        self.assertGreater(figure.point_count, 0)
        self.assertLessEqual(len(figure.top_points), 3)
        self.assertTrue(figure.citations.entries)
        self.assertIn("<svg", figure._repr_svg_())
        self.assertIsNotNone(figure.temporary_point)
        self.assertEqual(figure.available_formats, ("svg", "png"))
        self.assertEqual(figure.temporary_point.total_with_temporary, figure.point_count + 1)
        with tempfile.TemporaryDirectory() as directory:
            saved = figure.save_bundle(Path(directory) / "live-comparison")
            self.assertTrue(saved["svg"].is_file())
            self.assertTrue(saved["png"].is_file())
            self.assertTrue(saved["manifest"].is_file())


if __name__ == "__main__":
    unittest.main()
