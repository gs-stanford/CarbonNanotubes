# Carbon Property Tables Python SDK

The SDK requests citation-backed comparison figures rendered by the Carbon Property Tables service. It is a figure and benchmarking interface, not a bulk database-download client or a local copy of the canonical dataset.

## Install

```bash
python -m pip install carbon-property-tables==0.4.0
```

## Make a figure

```python
import carbon_property_tables as cpt

figure = cpt.scatter(
    "specific strength",
    "specific conductivity",
    release="public-v0-<source-hash-prefix>",
    log_x=True,
    log_y=True,
    comparison_grades=("A", "B", "C"),
)

figure.save_bundle("conductivity-strength")
figure
```

`save_bundle()` writes editable SVG, publication-resolution PNG, Nature-style citation text, BibTeX, and a value-free reproducibility manifest containing the release identity and property-pair evidence-rule version. SVG and PNG are requested together by default. Request PDF explicitly with `formats=("svg", "png", "pdf")` when needed.

For exploratory work, `release` may be omitted and the active release is used. For a manuscript, read the exact ID once with `cpt.release()["release"]["release_id"]` and pass it to every figure call. A stale or unavailable pin raises an error instead of silently rendering a newer snapshot. Historical replay requires the corresponding tagged archive; the live service currently exposes one canonical snapshot.

The first property is the x-axis and the second is the y-axis. Readable names are accepted, including `"specific cond"`, `"tenacity"`, `"tensile strength"`, and `"thermal conductivity"`. Misspelled or unknown properties fail explicitly instead of being guessed.

The other figure modes use the same interface:

```python
ranked = cpt.ranked("density", "tensile strength", top=10)
trend = cpt.trend("density", "tensile strength")
ashby = cpt.ashby("density", "specific strength")
```

## Run the complete acceptance test

```bash
cpt-feature-tour --output-dir cpt-feature-tour-output
```

The command tests the production release, property and publication-search endpoints, scatter/ranked/trend/Ashby figures, material filters, a temporary ranked point, the bounded top table, SVG/PNG/PDF exports, citation and BibTeX sidecars, and validation boundaries. It writes inspectable artifacts plus `feature-tour-report.json` to the selected directory and exits nonzero on any failure.

The equivalent module command is:

```bash
python -m carbon_property_tables.feature_tour --output-dir cpt-feature-tour-output
```

## Install locally

```bash
python -m pip install -e ./python
```

The default client uses the live service at `https://carbonnanotubes.onrender.com/api/v1`. Set `CPT_API_URL` or pass a URL to `CPTClient` to target a local or alternate deployment.

## Benchmark a temporary result

```python
import carbon_property_tables as cpt
from carbon_property_tables import TemporaryPoint

comparison = cpt.scatter(
    "specific_strength",
    "specific_electrical_conductivity",
    log_x=True,
    log_y=True,
    peer_reviewed=True,
    material_family=["CNT_or_CNT_hybrid", "CNT_metal_composite"],
    top=5,
    top_by="y",
    formats=("svg", "png", "pdf"),
    temporary=TemporaryPoint(
        x=1.8,
        y=12.0,
        label="My CNT fiber",
    ),
)

comparison.save("conductivity-strength.svg")
print(comparison.temporary_point)
```

Temporary coordinates use the display units printed on the active axes. They are rendered and ranked against the visible representative material set, but are never written to Carbon Property Tables.

In Jupyter, returning `figure` from a cell displays its SVG directly. `save()` writes one requested format with matching citation sidecars. `save_bundle()` writes all requested formats once, plus `.citations.txt`, `.bib`, and `.manifest.json` sidecars.

## Check DOI coverage without extracting values

```python
import carbon_property_tables as cpt

if cpt.has_doi("10.1126/science.adj1082"):
    print("Represented in Carbon Property Tables")

status = cpt.doi_status("https://doi.org/10.1126/science.adj1082")
print(status.title, status.journal, status.year)
```

The DOI lookup is exact and rate-limited. It returns only presence and bibliographic identity; it does not return record IDs, available properties, measurements, coordinates, or sample counts.

## Search represented publications

```python
import carbon_property_tables as cpt

matches = cpt.search("Xinshi Zhang dynamic strength", limit=10)
for publication in matches:
    print(publication.title, publication.doi, publication.match_fields)

exact = cpt.search("10.1126/science.adj1082")
print(exact[0].journal, exact[0].year)
```

Search covers DOI, title, authors, journal, publication year, and indexed material/process keywords. Results are deterministically ranked and collapsed to one entry per publication. They contain bibliographic metadata only, with no record IDs, sample labels, available-property lists, values, measurements, or coordinates. Crossref and OpenAlex are used during curation and validation, not as live search fallbacks, so every returned result is actually represented in the active CPT release.

## Extract a bounded top table

Exact values can be requested only for the selected top subset, with a hard maximum of ten rows:

```python
for row in comparison.top_table():
    print(row["rank"], row["label"], row["y_value"], row["y_unit"], row["doi"])

comparison.save_top_table("top-five.csv")
```

`top_by="x"` or `top_by="y"` must name a higher-is-better performance axis. Density and dimensions are filter or normalization variables, not optimization targets.

## Figure modes

- `scatter` compares any two same-record properties.
- `ranked` shows the highest reported y values among records that also contain the selected x property; it does not imply every source value is a best-specimen statistic.
- `trend` plots the selected y property against publication year.
- `ashby` enforces logarithmic axes and shows robust material-family regions where enough data exist.

All bounded figure filters supported by the service can be passed as keyword arguments. For example:

```python
figure = cpt.scatter(
    "density",
    "tensile_strength",
    measurement_filter=["diameter::0.000020"],
    gauge_length_min_mm=10,
    year_min=2015,
)
```

`comparison_grades` filters the query-time point evidence assessment. Grade A requires verified same-specimen pairing for two-property figures plus complete metadata; Grade D is context-only or critically unresolved. The response and manifest disclose that these point grades do not establish method equivalence across papers.

Measurement-range filters use canonical SI units. Axis values and temporary-point inputs use the display units printed on the figure.

## Deliberate access boundary

The public SDK does not expose canonical-record pagination, arbitrary record retrieval, full plot-coordinate tables, or a local plotting engine. Exact tabular output is limited to the explicitly requested top subset and capped at ten rows. A rendered vector figure can still be digitized, so this is an access and citation boundary rather than digital-rights management. Publication use requires the automatically supplied original-source and Carbon Property Tables citations.
