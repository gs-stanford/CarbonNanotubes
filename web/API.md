# Carbon Property Tables API v1

The read API exposes the active immutable CNT Property Atlas release at `/api/v1`. Production requests are resolved against PostgreSQL. Local development without `DATABASE_URL` uses the bundled release files with the same response contract.

## Guarantees

- Numerical `value` fields use the explicit canonical SI `unit` returned beside them.
- Display conversions are separate `display_value` and `display_unit` fields.
- Plot points pair properties from the same canonical record; the API does not combine values from different specimens.
- Every record includes its original-source, compilation-source (when applicable), and Atlas citation bundle.
- Cursor pagination is deterministic by immutable `record_id`.
- The API is read-only, CORS-enabled, and bounded to 200 records per query or 2,000 points per plot request.

## Core requests

```text
GET /api/v1/release
GET /api/v1/properties
GET /api/v1/records?property=tensile_strength&min_value=5e9&material_family=CNT_or_CNT_hybrid
GET /api/v1/records?measurement_filter=density:1000:1500&measurement_filter=diameter::2e-5
GET /api/v1/records?doi=10.1126/science.adj1082
GET /api/v1/records/{record_id}
GET /api/v1/plot?x=specific_strength&y=specific_electrical_conductivity
GET /api/v1/citations?record_id={record_id}
POST /api/v1/citations  {"record_ids":["rec_...","rec_..."]}
```

`min_value` and `max_value` always refer to the canonical SI unit shown by `/api/v1/properties`, never the display unit. Use repeated `measurement_filter=property:min:max` parameters to constrain several properties in one request; either bound may be blank. Gauge-length filters use millimetres and temperature filters use degrees Celsius because those units are explicit in their parameter names. Repeated or comma-separated values are accepted for `material_family`, `form_factor`, `provenance`, `verification`, and `record_id`.

The machine-readable contract is available at `/api/v1/openapi.json`.

## Citation rule

Downstream users must cite every original publication represented by the values they use and the CNT Property Atlas. When a value is supplied through an author-curated published compilation, the compilation publication is included as an additional citation. The `citations` response contains deduplicated Nature-style text and BibTeX for exactly this purpose.
