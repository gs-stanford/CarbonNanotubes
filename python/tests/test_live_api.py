import os
import unittest

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


if __name__ == "__main__":
    unittest.main()
