# Carbon Property Tables API and Python Tutorial

Carbon Property Tables (CPT) provides citation-backed comparison figures and
temporary-sample benchmarking without distributing the complete canonical
database. The Python package and REST API use the same versioned service.

- Website: <https://carbonnanotubes.onrender.com>
- API root: <https://carbonnanotubes.onrender.com/api/v1>
- OpenAPI document: <https://carbonnanotubes.onrender.com/api/v1/openapi.json>
- Python package: <https://pypi.org/project/carbon-property-tables/>

The public interface returns rendered figures, citation bundles,
reproducibility metadata, publication-level search results, temporary-point
rankings, and at most ten explicitly requested top rows. It does not provide
canonical-record pagination, bulk coordinates, or a local copy of the CPT
database.

## 1. Install the Python client

Python 3.10 or newer is recommended.

```bash
python -m pip install carbon-property-tables==0.4.0
```

Confirm the installed version and active service:

```python
import carbon_property_tables as cpt

print(cpt.__version__)
print(cpt.get_client().base_url)
```

The default API is the production deployment. To use another deployment:

```python
cpt.configure("http://localhost:3000", timeout=90)
```

Alternatively, set `CPT_API_URL` before importing the package.

## 2. Pin the database release

Always pin a release for a manuscript, report, or archived notebook.

```python
import carbon_property_tables as cpt

release_payload = cpt.release()
release = release_payload["release"]
release_id = release["release_id"]

print(release_id)
print(release["record_count"], release["measurement_count"])
print(release["source_hash"])
```

Pass `release=release_id` to every figure request. If that release is not
available from the selected deployment, CPT fails instead of silently drawing
from newer data. The live service currently serves one canonical release;
historical replay requires the corresponding tagged source archive.

## 3. Discover supported properties and units

```python
for item in cpt.properties():
    print(item["key"], item["label"], item["display_unit"])
```

Readable aliases are accepted by the convenience functions. For example,
`"specific strength"`, `"tenacity"`, and `"specific cond"` resolve to
canonical property keys. Unknown or misspelled properties fail explicitly.

The first property supplied to `scatter()` or `ashby()` is the x-axis and the
second is the y-axis:

```python
figure = cpt.scatter("specific strength", "specific cond")
```

## 4. Create a citation-backed scatter plot

```python
from pathlib import Path
import carbon_property_tables as cpt

release_id = cpt.release()["release"]["release_id"]

figure = cpt.scatter(
    "specific strength",
    "specific conductivity",
    release=release_id,
    log_x=True,
    log_y=True,
    peer_reviewed=True,
    material_family=[
        "CNT_or_CNT_hybrid",
        "CNT_metal_composite",
        "graphene_or_GO_fiber",
        "carbon_fiber_comparator",
    ],
    top=5,
    top_by="y",
    formats=("svg", "png", "pdf"),
)

output = Path("cpt-output")
output.mkdir(exist_ok=True)
saved = figure.save_bundle(output / "conductivity-vs-strength")
print(saved)
```

`save_bundle()` writes the requested image formats plus:

- `*.citations.txt`: deduplicated Nature-style citations for the active figure.
- `*.bib`: BibTeX for the same citation set.
- `*.manifest.json`: release identity, request parameters, comparison-rule
  version, and a figure fingerprint without the complete point table.

In a Jupyter notebook, returning `figure` as the final expression displays the
SVG directly.

## 5. Use all four figure modes

All figure functions accept the same filters, export formats, release pin, and
bounded top-row request.

```python
scatter = cpt.scatter(
    "specific strength",
    "specific cond",
    log_x=True,
    log_y=True,
)

ranked = cpt.ranked(
    "density",
    "tensile strength",
    top=10,
    top_by="y",
)

trend = cpt.trend(
    "density",
    "tensile strength",
)

ashby = cpt.ashby(
    "density",
    "specific strength",
)
```

- `scatter` compares two properties measured on the represented record.
- `ranked` orders the selected y property among records eligible for the query.
- `trend` plots the selected y property against publication year.
- `ashby` compares two properties with logarithmic axes enforced by the server.

The x property supplied to `ranked` and `trend` constrains record eligibility;
the displayed horizontal coordinate follows the selected figure mode.

## 6. Filter the represented comparison set

Common filters can be passed as keyword arguments:

```python
filtered = cpt.scatter(
    "density",
    "tensile strength",
    material_family=["CNT_or_CNT_hybrid", "carbon_fiber_comparator"],
    form_factor="fiber_yarn",
    peer_reviewed=True,
    year_min=2015,
    year_max=2026,
    gauge_length_min_mm=10,
    temperature_min_c=20,
    temperature_max_c=30,
)
```

Canonical material-family keys currently used by the service are:

```text
CNT_or_CNT_hybrid
CNT_metal_composite
graphene_or_GO_fiber
carbon_fiber_comparator
other_carbon_comparator
polymer_fiber_comparator
metal_comparator
ceramic_or_glass_comparator
```

Canonical form-factor keys currently include:

```text
fiber_yarn
sheet_mat_film
buckypaper
foam_aerogel
forest_array
individual_nanotube_or_bundle
bulk
unknown
```

Filter another property with `measurement_filter`. Its syntax is
`property:min:max`, and bounds use the canonical SI unit returned by
`cpt.properties()`:

```python
filtered = cpt.scatter(
    "specific strength",
    "specific cond",
    measurement_filter=[
        "density:500:2000",       # kg m^-3
        "diameter::0.000020",     # no minimum; maximum 20 micrometres
    ],
)
```

An empty bound means unbounded. A property may occur only once in
`measurement_filter`.

`comparison_grades=("A", "B", "C")` can restrict the query-time evidence
assessment. These grades describe the support for the active property pair;
they do not establish that test methods are equivalent across papers.

## 7. Benchmark a temporary sample

A temporary point is rendered and ranked but is never stored in CPT and is not
added to the citation set.

```python
import carbon_property_tables as cpt
from carbon_property_tables import TemporaryPoint

candidate = TemporaryPoint(
    x=1.8,       # N tex^-1, the displayed x-axis unit
    y=12.0,      # kS m^2 kg^-1, the displayed y-axis unit
    label="My candidate CNT fiber",
)

comparison = cpt.scatter(
    "specific strength",
    "specific cond",
    log_x=True,
    log_y=True,
    peer_reviewed=True,
    material_family=["CNT_or_CNT_hybrid", "CNT_metal_composite"],
    temporary=candidate,
    formats=("svg", "png", "pdf"),
)

rank = comparison.temporary_point
print(f"x rank: {rank.x_rank}/{rank.total_with_temporary}")
print(f"y rank: {rank.y_rank}/{rank.total_with_temporary}")
print(f"x percentile: {rank.x_percentile:.1f}")
print(f"y percentile: {rank.y_percentile:.1f}")
print(f"dominated by: {rank.dominated_by}")
print(f"Pareto frontier: {rank.on_pareto_frontier}")

comparison.save_bundle("candidate-comparison")
```

Temporary coordinates must use the display units printed on the active axes,
not the canonical SI units used by measurement filters.

## 8. Request a bounded top table

Set `top` from 1 to 10 and select a higher-is-better axis with `top_by`:

```python
comparison = cpt.scatter(
    "specific strength",
    "specific cond",
    top=5,
    top_by="y",
)

for row in comparison.top_table():
    print(
        row["rank"],
        row["label"],
        row["y_value"],
        row["y_unit"],
        row["doi"],
    )

comparison.save_top_table("top-five.csv")
```

The table contains only the explicitly requested top subset and carries its
own citation sidecar. Density and dimensions cannot be selected as
higher-is-better optimization targets.

## 9. Check DOI coverage without retrieving measurements

```python
import carbon_property_tables as cpt

doi = "10.1126/science.adj1082"
print(cpt.has_doi(doi))

status = cpt.doi_status(doi)
print(status.in_database)
print(status.title, status.authors_short, status.journal, status.year)
```

The DOI endpoint returns only presence and bibliographic identity. It does not
return record IDs, sample labels, represented properties, measurements, or
coordinates.

## 10. Search represented publications

```python
matches = cpt.search("Xinshi Zhang dynamic strength", limit=10)

for publication in matches:
    print(
        publication.title,
        publication.doi,
        publication.journal,
        publication.year,
        publication.match_fields,
    )
```

Search covers DOI, title, authors, journal, year, and indexed material/process
keywords. Results are deterministically ranked and deduplicated to publication
identity. Every result is represented in the active release; Crossref and
OpenAlex are used during curation, not as live search fallbacks.

## 11. Call the REST API directly

Set a base URL:

```bash
export CPT_API_URL="https://carbonnanotubes.onrender.com/api/v1"
```

Inspect the active release and property catalog:

```bash
curl -sS "$CPT_API_URL/release" | jq
curl -sS "$CPT_API_URL/properties" | jq
```

Check a DOI and search publications:

```bash
curl -sS --get "$CPT_API_URL/doi-status" \
  --data-urlencode "doi=10.1126/science.adj1082" | jq

curl -sS --get "$CPT_API_URL/search" \
  --data-urlencode "q=Xinshi Zhang dynamic strength" \
  --data-urlencode "limit=5" | jq
```

Request a figure package:

```bash
curl -sS "$CPT_API_URL/figures" \
  -H 'Content-Type: application/json' \
  -d '{
    "kind": "scatter",
    "x": "specific_strength",
    "y": "specific_electrical_conductivity",
    "x_scale": "log",
    "y_scale": "log",
    "formats": ["svg", "png", "pdf"],
    "top": 5,
    "top_by": "y",
    "temporary": {
      "x": 1.8,
      "y": 12.0,
      "label": "My candidate CNT fiber"
    },
    "filters": {
      "peer_reviewed": true,
      "material_family": [
        "CNT_or_CNT_hybrid",
        "CNT_metal_composite"
      ]
    }
  }' > figure-response.json
```

Extract the image files and citations:

```bash
jq -r '.images.svg' figure-response.json > comparison.svg
jq -r '.images.png_base64' figure-response.json | python -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.buffer.read()))' > comparison.png
jq -r '.images.pdf_base64' figure-response.json | python -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.buffer.read()))' > comparison.pdf
jq -r '.citations.copy_all' figure-response.json > comparison.citations.txt
jq -r '.citations.bibtex' figure-response.json > comparison.bib
jq '.temporary_point' figure-response.json
```

Use the Python package when possible; it validates requests, decodes binary
artifacts, writes sidecars, and exposes typed responses.

## 12. Handle errors explicitly

```python
from carbon_property_tables import CPTError, CPTHTTPError, CPTValidationError

try:
    figure = cpt.scatter("density", "density")
except CPTValidationError as error:
    print(f"Invalid local request: {error}")
except CPTHTTPError as error:
    print(f"API returned HTTP {error.status}: {error}")
except CPTError as error:
    print(f"Transport or response error: {error}")
```

Requests fail for unknown properties, identical scatter/Ashby axes, invalid log
coordinates, unsupported formats, more than ten top rows, unsupported filters,
or an unavailable release pin. The API also rejects figure requests with more
than 2,000 eligible records and asks the caller to apply filters.

## 13. Run the end-to-end acceptance tour

The package includes an executable feature tour that checks the live release,
property aliases, DOI status, publication search, all four figure modes,
temporary-point ranking, top-table limits, SVG/PNG/PDF exports, citations, and
validation failures.

```bash
python -m carbon_property_tables.feature_tour \
  --output-dir cpt-feature-tour-output
```

The command exits nonzero if a check fails and writes a JSON report plus
inspectable artifacts when it succeeds.

## 14. Citation and reproducibility checklist

For publication use:

1. Pin and report the CPT release ID.
2. Preserve the generated manifest with the analysis archive.
3. Cite every source in the generated citation bundle.
4. Cite Carbon Property Tables as the database and rendering service.
5. State the active axes, scale modes, material filters, and evidence grades.
6. Treat temporary points as user inputs rather than curated CPT records.
7. Inspect source conditions before claiming method-equivalent performance.

Rendered comparisons support literature navigation and benchmarking. They do
not remove the need to inspect the original articles and supporting information
for the scientific claim being made.
