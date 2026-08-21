import base64
import tempfile
import unittest
from pathlib import Path

from carbon_property_tables import CPTClient, CPTValidationError, TemporaryPoint, __version__


def citation_payload():
    entries = [
        {
            "citation_id": "doi:10.1/high",
            "roles": ["original"],
            "doi": "10.1/high",
            "text": "Author, A. Example high-performance publication. Journal 1, 1-5 (2024).",
            "bibtex": "@article{high2024}",
            "record_ids": ["rec_high"],
        },
        {
            "citation_id": "atlas:cpt-v0.3",
            "roles": ["atlas"],
            "doi": None,
            "text": "Sharma, G. & Boies, A. M. Carbon Property Tables (2026).",
            "bibtex": "@misc{cpt2026}",
            "record_ids": [],
        },
    ]
    return {
        "requirement": "Cite every original source and Carbon Property Tables.",
        "style": "nature",
        "entries": entries,
        "copy_all": "\n".join(f"{index}. {entry['text']}" for index, entry in enumerate(entries, start=1)),
        "bibtex": "\n\n".join(entry["bibtex"] for entry in entries),
    }


TOP_POINTS = [
    {
        "rank": 1,
        "label": "High-performance CNT fiber",
        "material_family": "CNT",
        "form_factor": "Fiber / yarn",
        "x_value": 2.0,
        "x_unit": "N tex^-1",
        "y_value": 3.0,
        "y_unit": "kS m^2 kg^-1",
        "doi": "10.1/high",
        "publication_title": "Example high-performance publication",
        "publication_year": 2024,
        "citation": "Author, A. Example high-performance publication. Journal 1, 1-5 (2024).",
    },
    {
        "rank": 2,
        "label": "Second CNT fiber",
        "material_family": "CNT",
        "form_factor": "Fiber / yarn",
        "x_value": 1.5,
        "x_unit": "N tex^-1",
        "y_value": 2.0,
        "y_unit": "kS m^2 kg^-1",
        "doi": "10.1/second",
        "publication_title": "Second publication",
        "publication_year": 2023,
        "citation": "Author, B. Second publication. Journal 2, 5-8 (2023).",
    },
]


class FakeClient(CPTClient):
    def __init__(self):
        super().__init__("https://example.test")
        self.calls = []

    def _request(self, path, *, params=None, method="GET", body=None):
        self.calls.append((path, params, method, body))
        if path == "release":
            return {"api_version": "v1", "release": {"release_id": "r1", "record_count": 4}}
        if path == "properties":
            return {"properties": [{"key": "specific_strength"}]}
        if path != "figures":
            return {}

        formats = body["formats"]
        images = {}
        if "svg" in formats:
            images["svg"] = "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"
        if "png" in formats:
            images["png_base64"] = base64.b64encode(b"\x89PNG\r\n\x1a\nfixture").decode("ascii")
        if "pdf" in formats:
            images["pdf_base64"] = base64.b64encode(b"%PDF-1.7\nfixture").decode("ascii")
        temporary = None
        if body.get("temporary"):
            temporary = {
                **body["temporary"],
                "total_with_temporary": 4,
                "x_rank": 3,
                "y_rank": 2,
                "x_percentile": 50.0,
                "y_percentile": 75.0,
                "dominated_by": 1,
                "on_pareto_frontier": False,
            }
        return {
            "api_version": "v1",
            "generated_at": "2026-08-21T00:00:00.000Z",
            "release": {"release_id": "r1"},
            "kind": body["kind"],
            "axes": {
                "x": {"key": body["x"], "label": "X", "displayUnit": "N tex^-1"},
                "y": {"key": body["y"], "label": "Y", "displayUnit": "kS m^2 kg^-1"},
            },
            "point_count": 3,
            "images": images,
            "top_points": TOP_POINTS[: body["top"]],
            "citations": citation_payload(),
            "temporary_point": temporary,
        }


class CPTClientTests(unittest.TestCase):
    def test_base_url_and_metadata_endpoints(self):
        client = FakeClient()
        self.assertEqual(client.base_url, "https://example.test/api/v1")
        self.assertEqual(client.user_agent, f"carbon-property-tables-python/{__version__}")
        self.assertEqual(client.release()["release"]["release_id"], "r1")
        self.assertEqual(client.properties()[0]["key"], "specific_strength")

    def test_parameter_encoding(self):
        encoded = CPTClient._encode_params(
            {"peer_reviewed": True, "material_family": ["CNT", "carbon"], "empty": None}
        )
        self.assertIn("peer_reviewed=true", encoded)
        self.assertEqual(encoded.count("material_family="), 2)
        self.assertNotIn("empty", encoded)

    def test_scatter_uses_one_server_side_artifact_request(self):
        client = FakeClient()
        figure = client.scatter(
            "specific_strength",
            "specific_electrical_conductivity",
            top=2,
            top_by="y",
            temporary=TemporaryPoint(1.5, 1.5, "Candidate"),
            peer_reviewed=True,
        )

        self.assertEqual(figure.point_count, 3)
        self.assertEqual([row.rank for row in figure.top_points], [1, 2])
        self.assertEqual(figure.temporary_point.x_rank, 3)
        self.assertEqual(figure.temporary_point.y_rank, 2)
        self.assertIn("<svg", figure._repr_svg_())
        self.assertEqual(len(client.calls), 1)
        path, params, method, body = client.calls[0]
        self.assertEqual((path, params, method), ("figures", None, "POST"))
        self.assertEqual(body["filters"], {"peer_reviewed": True})
        self.assertEqual(body["top"], 2)
        self.assertNotIn("limit", body)

    def test_exports_are_requested_explicitly_and_carry_citations(self):
        figure = FakeClient().scatter(
            "specific_strength",
            "specific_electrical_conductivity",
            top=2,
            formats=("svg", "png", "pdf"),
        )
        self.assertEqual(figure.available_formats, ("svg", "png", "pdf"))
        self.assertEqual(len(figure.top_table()), 2)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            svg = figure.save(root / "comparison.svg")
            png = figure.save(root / "comparison.png")
            pdf = figure.save(root / "comparison.pdf")
            table = figure.save_top_table(root / "top.csv")
            self.assertTrue(svg.read_text(encoding="utf-8").startswith("<?xml"))
            self.assertTrue(png.read_bytes().startswith(b"\x89PNG"))
            self.assertTrue(pdf.read_bytes().startswith(b"%PDF"))
            self.assertEqual(len(table.read_text(encoding="utf-8").splitlines()), 3)
            self.assertTrue((root / "comparison.citations.txt").exists())
            self.assertTrue((root / "comparison.bib").exists())
            self.assertTrue((root / "top.citations.txt").exists())

    def test_unrequested_format_is_not_synthesized_locally(self):
        figure = FakeClient().scatter("specific_strength", "specific_electrical_conductivity")
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                figure.save(Path(directory) / "comparison.pdf")

    def test_ashby_forces_logarithmic_axes(self):
        client = FakeClient()
        client.ashby("density", "specific_strength")
        body = client.calls[0][3]
        self.assertEqual(body["x_scale"], "log")
        self.assertEqual(body["y_scale"], "log")

    def test_rejects_more_than_ten_top_rows(self):
        with self.assertRaises(CPTValidationError):
            FakeClient().scatter("specific_strength", "specific_electrical_conductivity", top=11)

    def test_bulk_record_methods_are_not_public(self):
        client = FakeClient()
        for name in ("records", "iter_records", "record", "plot_data", "citations"):
            self.assertFalse(hasattr(client, name), name)

    def test_rejects_invalid_axes_formats_and_reserved_filters(self):
        client = FakeClient()
        with self.assertRaises(CPTValidationError):
            client.scatter("density", "density")
        with self.assertRaises(CPTValidationError):
            client.scatter("density", "tensile_strength", limit=5)
        with self.assertRaises(CPTValidationError):
            client.scatter("density", "tensile_strength", formats=("csv",))


if __name__ == "__main__":
    unittest.main()
