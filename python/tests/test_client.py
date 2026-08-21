import unittest

from carbon_property_tables import CPTClient, CPTValidationError, __version__


def citation_bundle():
    return {
        "requirement": "Cite sources.",
        "style": "nature",
        "entries": [
            {
                "citation_id": "doi:10.1/example",
                "roles": ["original"],
                "doi": "10.1/example",
                "text": "Example citation.",
                "bibtex": "@article{example}",
                "record_ids": ["rec_1"],
            }
        ],
        "copy_all": "1. Example citation.",
        "bibtex": "@article{example}",
    }


def record_payload(record_id):
    return {
        "record_id": record_id,
        "label": f"Record {record_id}",
        "sample": {"material_family": "CNT_or_CNT_hybrid", "form_factor": "fiber_yarn"},
        "publication": {"doi": "10.1/example", "title": "Example"},
        "measurements": [
            {
                "measurement_id": f"m_{record_id}",
                "property": "tensile_strength",
                "property_label": "Tensile strength",
                "value": 5e9,
                "unit": "Pa",
                "display_value": 5.0,
                "display_unit": "GPa",
                "warning": "none",
                "eligibility": {"strict": True},
            }
        ],
        "conditions": {},
        "provenance": {"primary_source_verification_status": "verified_against_primary_source"},
        "comparison": {},
        "source_class": {},
        "quality_flags": {},
        "citations": citation_bundle(),
    }


class FakeClient(CPTClient):
    def __init__(self):
        super().__init__("https://example.test")
        self.calls = []

    def _request(self, path, *, params=None, method="GET", body=None):
        self.calls.append((path, params, method, body))
        if path == "records":
            after = (params or {}).get("after")
            if after is None:
                return {
                    "release": {"release_id": "r1"},
                    "pagination": {"has_more": True, "next_cursor": "rec_1"},
                    "records": [record_payload("rec_1")],
                }
            return {
                "release": {"release_id": "r1"},
                "pagination": {"has_more": False, "next_cursor": None},
                "records": [record_payload("rec_2")],
            }
        if path.startswith("records/"):
            return {"record": record_payload(path.split("/", 1)[1])}
        if path == "citations":
            return {"citations": citation_bundle()}
        if path == "plot":
            measurement = record_payload("rec_1")["measurements"][0]
            return {
                "release": {"release_id": "r1"},
                "axes": {"x": {"label": "X"}, "y": {"label": "Y"}},
                "pagination": {"has_more": False, "next_cursor": None},
                "points": [
                    {
                        "record_id": "rec_1",
                        "label": "Record",
                        "material_family": "CNT_or_CNT_hybrid",
                        "form_factor": "fiber_yarn",
                        "cnt_type": "DWCNT",
                        "publication": {},
                        "provenance": {},
                        "x": measurement,
                        "y": {**measurement, "property": "density", "value": 1300, "display_value": 1300},
                    }
                ],
                "citations": citation_bundle(),
            }
        return {}


class CPTClientTests(unittest.TestCase):
    def test_base_url_normalization(self):
        self.assertEqual(CPTClient("https://example.test/").base_url, "https://example.test/api/v1")
        self.assertEqual(CPTClient("https://example.test/api/v1").base_url, "https://example.test/api/v1")
        self.assertEqual(CPTClient("https://example.test").user_agent, f"carbon-property-tables-python/{__version__}")

    def test_parameter_encoding(self):
        encoded = CPTClient._encode_params({"peer_reviewed": True, "material_family": ["CNT", "carbon"], "empty": None})
        self.assertIn("peer_reviewed=true", encoded)
        self.assertEqual(encoded.count("material_family="), 2)
        self.assertNotIn("empty", encoded)

    def test_record_parsing_and_measurement_lookup(self):
        client = FakeClient()
        record = client.record("rec_1")
        self.assertEqual(record.publication["doi"], "10.1/example")
        self.assertEqual(record.measurement("tensile_strength").display_value, 5.0)
        self.assertEqual(record.citations.entries[0].record_ids, ("rec_1",))

    def test_iteration_uses_cursor(self):
        client = FakeClient()
        records = list(client.iter_records(property="tensile_strength", limit=1))
        self.assertEqual([record.record_id for record in records], ["rec_1", "rec_2"])
        self.assertEqual(client.calls[1][1]["after"], "rec_1")

    def test_plot_keeps_citations(self):
        client = FakeClient()
        result = client.plot_data("tensile_strength", "density")
        self.assertEqual(result.points[0].x.unit, "Pa")
        self.assertEqual(result.citations.copy_all, "1. Example citation.")

    def test_citation_request_is_post(self):
        client = FakeClient()
        citations = client.citations(["rec_1"])
        self.assertEqual(citations.entries[0].doi, "10.1/example")
        self.assertEqual(client.calls[-1], ("citations", None, "POST", {"record_ids": ["rec_1"]}))

    def test_rejects_invalid_plot(self):
        with self.assertRaises(CPTValidationError):
            FakeClient().plot_data("density", "density")


if __name__ == "__main__":
    unittest.main()
