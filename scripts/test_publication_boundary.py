import unittest
import pandas as pd
from publication_boundary import sanitize_runtime_table, quarantine_restricted_sources


class PublicationBoundaryTests(unittest.TestCase):
    def test_private_column_removed_but_locator_retained(self):
        result = sanitize_runtime_table(pd.DataFrame([{
            "source_document_path": "/Users/private/paper.pdf", "doi": "10.1/test",
            "source_locator": "Table 2", "source_sha256": "abcd"}]))
        self.assertNotIn("source_document_path", result)
        self.assertEqual(result.source_locator.iloc[0], "Table 2")

    def test_unexpected_private_paths_fail_closed(self):
        for value in ["/Users/private/a.pdf", "file:///home/a", "data/literature/a.pdf"]:
            with self.assertRaises(ValueError):
                sanitize_runtime_table(pd.DataFrame([{"notes": value}]))

    def test_restricted_record_quarantines_all_its_measurements(self):
        records = pd.DataFrame([{"record_id": "a", "url": "https://MatWeb.com/x"}, {"record_id": "b", "url": "https://doi.org/10.1/x"}])
        values = pd.DataFrame([{"record_id": "a"}, {"record_id": "a"}, {"record_id": "b"}])
        kept, measurements, held = quarantine_restricted_sources(records, values)
        self.assertEqual(kept.record_id.tolist(), ["b"])
        self.assertEqual(measurements.record_id.tolist(), ["b"])
        self.assertEqual(held.record_id.tolist(), ["a"])


if __name__ == "__main__":
    unittest.main()
