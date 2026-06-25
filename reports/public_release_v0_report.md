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
| `data/public/public_release_summary.json` | Machine-readable counts and release-rule summary. |

## Release Rules

- Include DOI-verified CNT/graphene/CNT-metal records as `peer_reviewed_research` candidates.
- Treat Crossref/OpenAlex-resolved James/Bulmer rows as DOI-backed source records with `value_extraction_type=secondary_meta_analysis`, not as a material or legend class.
- Include DOI-backed non-target materials as `peer_reviewed_contextual_comparator` and manufacturer/MatWeb/spec-sheet rows as `commercial_contextual_comparator`.
- Collapse duplicate source rows into a single canonical public record using DOI, material/form, and canonical measurement-vector agreement.
- Exclude URL-only research records, unresolved internal seed rows, records with unverified DOI status, and rows without canonical measurements.
- Do not treat contextual benchmark rows as primary CNT measurements.

## Counts

- Internal records assessed: 1556
- Public candidate records: 1366
- Public candidate measurements: 5344
- Public source/publication rows: 271
- Excluded internal records: 190
- Strict-comparison-ready records: 3
- Normalized/exploratory candidate records: 1366/1366

## Public Records By Tier

| Tier | Records |
| --- | ---: |
| `peer_reviewed_research` | 1022 |
| `peer_reviewed_contextual_comparator` | 281 |
| `commercial_contextual_comparator` | 63 |

## Public Records By Material Family

| Material family | Records |
| --- | ---: |
| `CNT_or_CNT_hybrid` | 990 |
| `other_carbon_comparator` | 102 |
| `carbon_fiber_comparator` | 100 |
| `polymer_fiber_comparator` | 94 |
| `metal_comparator` | 44 |
| `CNT_metal_composite` | 22 |
| `graphene_or_GO_fiber` | 10 |
| `ceramic_or_glass_comparator` | 4 |

## Exclusion Reasons

| Reason | Records |
| --- | ---: |
| `duplicate_collapsed_into_canonical_public_record` | 100 |
| `internal_seed_or_unresolved_source` | 79 |
| `no_canonical_measurements` | 5 |
| `secondary_duplicate_of_higher_priority_record` | 5 |
| `no_canonical_measurements;internal_seed_or_unresolved_source` | 1 |

## Interpretation

The v0 public layer is suitable for building the website data API and exploratory plots. It is not yet an official final dataset.

Strict comparison is intentionally conservative: current CNT fiber rows still lack structured method, atmosphere, gauge-length, and strain-rate metadata, so they are flagged as candidates rather than strict-ready records.

Commercial, MatWeb, and manufacturer-source rows are included only to support contextual Ashby-style benchmarks. The website should keep them out of strict filters and label them visibly in legends/tooltips.
