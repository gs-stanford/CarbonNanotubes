# Carbon Property Tables Python SDK

The SDK requests citation-backed comparison figures rendered by the Carbon Property Tables service. It is a figure and benchmarking interface, not a bulk database-download client or a local copy of the canonical dataset.

## Install locally

```bash
python -m pip install -e ./python
```

The default client uses the live service at `https://carbonnanotubes.onrender.com/api/v1`. Set `CPT_API_URL` or pass a URL to `CPTClient` to target a local or alternate deployment.

## Plot and benchmark a temporary result

```python
from carbon_property_tables import CPTClient, TemporaryPoint

cpt = CPTClient()

figure = cpt.scatter(
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

figure.save("conductivity-strength.svg")
print(figure.temporary_point)
```

Temporary coordinates use the display units printed on the active axes. They are rendered and ranked against the visible representative material set, but are never written to Carbon Property Tables.

In Jupyter, returning `figure` from a cell displays its SVG directly. `save()` accepts any format requested through `formats` and automatically writes matching `.citations.txt` and `.bib` files. SVG alone is requested by default to keep routine calls small.

## Extract a bounded top table

Exact values can be requested only for the selected top subset, with a hard maximum of ten rows:

```python
for row in figure.top_table():
    print(row["rank"], row["label"], row["y_value"], row["y_unit"], row["doi"])

figure.save_top_table("top-five.csv")
```

`top_by="x"` or `top_by="y"` must name a higher-is-better performance axis. Density and dimensions are filter or normalization variables, not optimization targets.

## Figure types

```python
scatter = cpt.scatter("tensile_strength", "electrical_conductivity")
ranked = cpt.ranked("density", "tensile_strength", top=10)
ashby = cpt.ashby("density", "specific_strength")
```

- `scatter` compares any two same-record properties.
- `ranked` ranks the y property among records that also contain the selected x property.
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
