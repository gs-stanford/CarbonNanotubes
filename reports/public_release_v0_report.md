# Public CNT Property Dataset v0 Report

Generated from the internal processed and curation tables.

## Output Files

| File | Purpose |
| --- | --- |
| `data/public/public_records_v0.csv` | Public candidate row-level records with source/evidence flags. |
| `data/public/public_measurements_v0.csv` | Long-form measurements filtered to public candidate records. |
| `data/public/public_publications_v0.csv` | Source/publication rows referenced by public candidate records. |
| `data/public/public_exclusions_v0.csv` | Internal records excluded from public v0 with explicit reasons. |
| `data/public/public_schema_v0.csv` | Field descriptions for public release flags. |
| `data/public/public_provenance_census_v0.csv` | Record, publication, and measurement counts by source and verification path. |
| `data/public/public_release_summary.json` | Machine-readable counts and release-rule summary. |

## Release Rules

- Include DOI-verified CNT/graphene/CNT-metal records as `peer_reviewed_research` candidates.
- Treat the Elliott/Bulmer author-supplied workbook as an `author_curated_published_compilation`; its linked primary sources were checked during the authors' compilation workflow.
- Include DOI-backed non-target materials as `peer_reviewed_contextual_comparator` and manufacturer/MatWeb/spec-sheet rows as `commercial_contextual_comparator`.
- Collapse duplicate source rows into a single canonical public record using DOI, material/form, and canonical measurement-vector agreement.
- Exclude URL-only research records, unresolved internal seed rows, records with unverified DOI status, and rows without canonical measurements.
- Do not treat contextual benchmark rows as primary CNT measurements.

## Counts

- Internal records assessed: 1638
- Public candidate records: 1447
- Public candidate measurements: 5569
- Public source/publication rows: 320
- Excluded internal records: 191
- Strict-comparison-ready records: 0
- Normalized/exploratory candidate records: 1447/1447

## Public Records By Tier

| Tier | Records |
| --- | ---: |
| `peer_reviewed_research` | 1104 |
| `peer_reviewed_contextual_comparator` | 273 |
| `commercial_contextual_comparator` | 70 |

## Public Records By Material Family

| Material family | Records |
| --- | ---: |
| `CNT_or_CNT_hybrid` | 1036 |
| `other_carbon_comparator` | 121 |
| `carbon_fiber_comparator` | 104 |
| `polymer_fiber_comparator` | 73 |
| `graphene_or_GO_fiber` | 48 |
| `metal_comparator` | 41 |
| `CNT_metal_composite` | 20 |
| `ceramic_or_glass_comparator` | 4 |

## Exclusion Reasons

| Reason | Records |
| --- | ---: |
| `duplicate_collapsed_into_canonical_public_record` | 100 |
| `internal_seed_or_unresolved_source` | 78 |
| `no_canonical_measurements` | 8 |
| `duplicate_of_higher_priority_record` | 3 |
| `no_canonical_measurements;internal_seed_or_unresolved_source` | 2 |

## Interpretation

The v0 public layer is suitable for building the website data API and exploratory plots. It is not yet an official final dataset.

Strict comparison is intentionally conservative: current CNT fiber rows still lack structured method, atmosphere, gauge-length, and strain-rate metadata, so they are flagged as candidates rather than strict-ready records.

Commercial, MatWeb, and manufacturer-source rows are included only to support contextual Ashby-style benchmarks. The website should keep them out of strict filters and label them visibly in legends/tooltips.
