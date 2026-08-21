# Carbon Property Tables API v1

The public API serves citation-backed figure artifacts from the active immutable Carbon Property Tables release. Production requests are resolved against PostgreSQL; local development without `DATABASE_URL` uses the bundled release files through the same contract.

## Public surface

```text
GET  /api/v1
GET  /api/v1/release
GET  /api/v1/properties
POST /api/v1/figures
GET  /api/v1/openapi.json
```

`POST /api/v1/figures` accepts `scatter`, `ranked`, `trend`, and `ashby` requests. Rendering, representative-record selection, comparison references, temporary-point ranking, and citation assembly all run on the server.

```json
{
  "kind": "scatter",
  "x": "specific_strength",
  "y": "specific_electrical_conductivity",
  "x_scale": "log",
  "y_scale": "log",
  "top": 5,
  "top_by": "y",
  "temporary": { "x": 1.8, "y": 12.0, "label": "Candidate" },
  "formats": ["svg", "png", "pdf"],
  "filters": {
    "material_family": ["CNT_or_CNT_hybrid", "CNT_metal_composite"],
    "year_min": 2010,
    "peer_reviewed": true
  }
}
```

The response contains rendered artifacts, aggregate counts, one focused record for the interactive website, temporary-point ranks, a complete citation bundle, and no more than ten explicitly requested top rows. It does not return the canonical record table or a complete coordinate array.

Curator-approved community submissions are included only when their review status is `official` and their public-visibility flag is enabled. DOI validation or automated duplicate checks alone never place a submitted value in a public figure.

## Units and filters

Figure axes and temporary-point coordinates use the display units returned by `/api/v1/properties`. Measurement-range filters use canonical SI units. Repeated values are accepted for material family, form factor, release tier, provenance, and verification filters.

Ashby requests always use logarithmic axes. Top-row extraction is allowed only for higher-is-better performance properties; density and dimensions are filtering or normalization variables, not optimization targets.

## Internal data routes

Canonical record and raw plot routes are retained only for trusted administration and migration tooling. They require `CPT_INTERNAL_API_TOKEN`, are omitted from discovery and OpenAPI, and return `404` to unauthenticated requests. The public Python SDK does not implement those routes.

## Citation rule

Every figure package includes deduplicated Nature-style text and BibTeX for all represented original publications, any required author-curated compilation, and Carbon Property Tables. Saved SDK artifacts automatically write citation sidecars.

The vector output can still be digitized. This contract is an access and citation boundary, not digital-rights management.
