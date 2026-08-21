# Carbon Property Tables Python SDK

The SDK queries the versioned Carbon Property Tables API without scraping the website. Every returned record contains canonical SI measurements, provenance status, and its required citation bundle.

## Install locally

```bash
python -m pip install -e ./python
```

Add the optional Matplotlib helper with:

```bash
python -m pip install -e './python[plot]'
```

## Query

```python
from carbon_property_tables import CPTClient

cpt = CPTClient("https://YOUR-SERVICE.onrender.com")

for record in cpt.iter_records(
    property="tensile_strength",
    min_value=5e9,  # Pa: the API always filters in canonical SI
    material_family="CNT_or_CNT_hybrid",
):
    strength = record.measurement("tensile_strength")
    print(record.label, strength.value, strength.unit)
    print(record.citations.copy_all)
```

The client also accepts `CPT_API_URL`; without either setting it uses `http://localhost:3000/api/v1`.

## Paired plot data

```python
result = cpt.plot_data(
    "specific_strength",
    "specific_electrical_conductivity",
    peer_reviewed=True,
)

for point in result.points:
    print(point.x.value, point.x.unit, point.y.value, point.y.unit)

print(result.citations.copy_all)
```

Multiple property ranges can be combined without changing units:

```python
records = cpt.records(
    measurement_filter=[
        "density:1000:1500",      # kg/m^3
        "diameter::0.000020",     # m; no lower bound
    ],
    gauge_length_min_mm=10,
)
```

The `/plot` contract only returns values paired on the same canonical record. It does not synthesize values from different specimens.

## Optional figure

```python
fig, ax, result = cpt.scatter(
    "specific_strength",
    "specific_electrical_conductivity",
    log_x=True,
    log_y=True,
)
fig.savefig("cpt.svg")
print(result.citations.bibtex)
```

Plotting is intentionally separate from retrieval. The returned `PlotResult` remains the source of record IDs, units, provenance, and citations used in the figure.
