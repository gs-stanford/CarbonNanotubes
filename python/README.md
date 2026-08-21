# Carbon Property Tables Python SDK

The SDK requests citation-backed comparison figures rendered by the Carbon Property Tables service. It is a figure and benchmarking interface, not a bulk database-download client or a local copy of the canonical dataset.

## Install from TestPyPI

```bash
python -m pip install \
  --index-url https://test.pypi.org/simple/ \
  --extra-index-url https://pypi.org/simple/ \
  carbon-property-tables==0.3.2
```

## Make a figure

```python
import carbon_property_tables as cpt

figure = cpt.scatter(
    "specific strength",
    "specific conductivity",
    log_x=True,
    log_y=True,
)

figure.save("conductivity-strength.svg")
figure
```

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

The command tests the production release and property endpoints, scatter/ranked/trend/Ashby figures, material filters, a temporary ranked point, the bounded top table, SVG/PNG/PDF exports, citation and BibTeX sidecars, and validation boundaries. It writes inspectable artifacts plus `feature-tour-report.json` to the selected directory and exits nonzero on any failure.

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

In Jupyter, returning `figure` from a cell displays its SVG directly. `save()` accepts any format requested through `formats` and automatically writes matching `.citations.txt` and `.bib` files. SVG alone is requested by default to keep routine calls small.

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
- `ranked` ranks the y property among records that also contain the selected x property.
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

Measurement-range filters use canonical SI units. Axis values and temporary-point inputs use the display units printed on the figure.

## Deliberate access boundary

The public SDK does not expose canonical-record pagination, arbitrary record retrieval, full plot-coordinate tables, or a local plotting engine. Exact tabular output is limited to the explicitly requested top subset and capped at ten rows. A rendered vector figure can still be digitized, so this is an access and citation boundary rather than digital-rights management. Publication use requires the automatically supplied original-source and Carbon Property Tables citations.
