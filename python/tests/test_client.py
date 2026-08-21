import tempfile
import unittest
from pathlib import Path

from carbon_property_tables import CPTClient, CPTError, CPTValidationError, TemporaryPoint, __version__


def measurement(property_key, label, value, unit):
    return {
        "measurement_id": f"m_{property_key}_{value}",
        "property": property_key,
        "property_label": label,
        "value": value,
        "unit": unit,
        "display_value": value,
        "display_unit": unit,
        "warning": "none",
        "eligibility": {"strict": True},
    }


def plot_point(record_id, doi, x, y, *, family="CNT_or_CNT_hybrid", form="fiber_yarn"):
    return {
        "record_id": record_id,
        "label": f"Sample {record_id}",
        "material_family": family,
        "form_factor": form,
        "cnt_type": "DWCNT" if family == "CNT_or_CNT_hybrid" else None,
        "publication": {
            "doi": doi,
            "title": f"Publication {doi}",
            "authors_short": f"Author {record_id} et al.",
            "year": 2024,
        },
        "provenance": {"primary_source_verification_status": "verified_against_primary_source"},
        "x": measurement("specific_strength", "Specific strength", x, "N tex^-1"),
        "y": measurement(
            "specific_electrical_conductivity",
            "Specific electrical conductivity",
            y,
            "kS m^2 kg^-1",
        ),
    }


POINTS = [
    plot_point("rec_low", "10.1/shared", 1.0, 1.0),
    plot_point("rec_high", "10.1/shared", 2.0, 3.0),
    plot_point("rec_other", "10.1/other", 3.0, 2.0),
    plot_point("rec_carbon", "10.1/carbon", 4.0, 0.8, family="carbon_fiber_comparator"),
]


def citation_payload(record_ids):
    entries = [
        {
            "citation_id": f"doi:{record_id}",
            "roles": ["original"],
            "doi": f"10.1/{record_id}",
            "text": f"Citation for {record_id}.",
            "bibtex": f"@article{{{record_id}}}",
            "record_ids": [record_id],
        }
        for record_id in record_ids
    ]
    entries.append(
        {
            "citation_id": "atlas:cpt-v0.2",
            "roles": ["atlas"],
            "doi": None,
            "text": "Sharma, G. & Boies, A. M. Carbon Property Tables (2026).",
            "bibtex": "@misc{cpt2026}",
            "record_ids": [],
        }
    )
    return {
        "requirement": "Cite every original source and Carbon Property Tables.",
        "style": "nature",
        "entries": entries,
        "copy_all": "\n".join(f"{index}. {entry['text']}" for index, entry in enumerate(entries, start=1)),
        "bibtex": "\n\n".join(entry["bibtex"] for entry in entries),
    }


class FakeClient(CPTClient):
    def __init__(self, *, has_more=False):
        super().__init__("https://example.test")
        self.calls = []
        self.has_more = has_more

    def _request(self, path, *, params=None, method="GET", body=None):
        self.calls.append((path, params, method, body))
        if path == "release":
            return {"api_version": "v1", "release": {"release_id": "r1", "record_count": 4}}
        if path == "properties":
            return {"properties": [{"key": "specific_strength"}]}
        if path == "plot":
            return {
                "release": {"release_id": "r1"},
                "axes": {},
                "pagination": {"has_more": self.has_more, "next_cursor": "rec_carbon" if self.has_more else None},
                "points": POINTS,
                "citations": citation_payload([point["record_id"] for point in POINTS]),
            }
        if path == "citations":
            return {"citations": citation_payload(body["record_ids"])}
        return {}


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

    def test_scatter_reduces_duplicates_and_ranks_temporary_point(self):
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
        self.assertEqual(figure.top_points[0].label, "Sample rec_high")
        self.assertNotIn("rec_low", {record_id for entry in figure.citations.entries for record_id in entry.record_ids})
        self.assertEqual(figure.temporary_point.x_rank, 4)
        self.assertEqual(figure.temporary_point.y_rank, 3)
        self.assertEqual(figure.temporary_point.dominated_by, 2)
        self.assertFalse(figure.temporary_point.on_pareto_frontier)
        self.assertIn("<svg", figure._repr_svg_())
        self.assertEqual(client.calls[0][1]["limit"], 2000)
        self.assertEqual(client.calls[1][0:3], ("citations", None, "POST"))

    def test_top_table_and_figure_exports_are_bounded_and_cited(self):
        figure = FakeClient().scatter(
            "specific_strength",
            "specific_electrical_conductivity",
            top=3,
        )
        self.assertEqual(len(figure.top_table()), 3)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = figure.save(root / "comparison.svg")
            table = figure.save_top_table(root / "top.csv")
            self.assertTrue(image.read_text(encoding="utf-8").lstrip().startswith("<?xml"))
            self.assertTrue((root / "comparison.citations.txt").exists())
            self.assertTrue((root / "comparison.bib").exists())
            self.assertEqual(len(table.read_text(encoding="utf-8").splitlines()), 4)
            self.assertTrue((root / "top.citations.txt").exists())

    def test_rejects_more_than_ten_top_rows(self):
        with self.assertRaises(CPTValidationError):
            FakeClient().scatter("specific_strength", "specific_electrical_conductivity", top=11)

    def test_rejects_nonperformance_top_axis(self):
        client = FakeClient()
        with self.assertRaises(CPTValidationError):
            client.scatter(
                "density",
                "specific_electrical_conductivity",
                top=2,
                top_by="x",
            )

    def test_rejects_incomplete_result_instead_of_silently_truncating(self):
        with self.assertRaises(CPTError):
            FakeClient(has_more=True).scatter("specific_strength", "specific_electrical_conductivity")

    def test_bulk_record_methods_are_not_public(self):
        client = FakeClient()
        for name in ("records", "iter_records", "record", "plot_data", "citations"):
            self.assertFalse(hasattr(client, name), name)

    def test_rejects_invalid_axes_and_reserved_filters(self):
        client = FakeClient()
        with self.assertRaises(CPTValidationError):
            client.scatter("density", "density")
        with self.assertRaises(CPTValidationError):
            client.scatter("density", "tensile_strength", limit=5)


if __name__ == "__main__":
    unittest.main()
