import os
import unittest

from carbon_property_tables import CPTClient


@unittest.skipUnless(os.environ.get("CPT_LIVE_TEST_URL"), "CPT_LIVE_TEST_URL is not set")
class LiveApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = CPTClient(os.environ["CPT_LIVE_TEST_URL"])

    def test_release_query_plot_and_citations(self):
        release = self.client.release()
        self.assertEqual(release["api_version"], "v1")
        self.assertEqual(release["release"]["record_count"], 1366)

        page = self.client.records(doi="10.1126/science.adj1082", limit=5)
        self.assertEqual(len(page.records), 4)
        self.assertTrue(all(record.publication["doi"] == "10.1126/science.adj1082" for record in page.records))

        plot = self.client.plot_data(
            "specific_strength",
            "specific_electrical_conductivity",
            material_family="CNT_or_CNT_hybrid",
            limit=10,
        )
        self.assertTrue(plot.points)
        self.assertTrue(plot.citations.entries)

        citations = self.client.citations([page.records[0].record_id, page.records[1].record_id])
        original = [entry for entry in citations.entries if entry.doi == "10.1126/science.adj1082"]
        self.assertEqual(len(original), 1)
        self.assertEqual(len(original[0].record_ids), 2)


if __name__ == "__main__":
    unittest.main()
