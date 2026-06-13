# CNT Database Curation Workflow Report

Generated from the processed database in `data/processed/`.

## New Outputs

| File | Purpose |
| --- | --- |
| `data/processed/publications_enriched.csv` | Crossref/OpenAlex-enriched publication metadata. |
| `data/processed/doi_validation_results.csv` | Compact DOI validation status table. |
| `data/cache/doi_validation_cache.json` | Local API-response cache for reproducible reruns. |
| `data/curation/record_curation_queue.csv` | Reviewer-facing row-level curation queue. |
| `data/curation/publication_curation_queue.csv` | Reviewer-facing publication queue. |
| `data/curation/issue_summary.csv` | Issue counts by type and material family. |
| `data/curation/property_coverage_summary.csv` | Property coverage by material family. |
| `data/curation/cnt_property_curation_workbook.xlsx` | Excel workbook for manual review. |

## DOI Validation

| Status | Count |
| --- | ---: |
| Verified by Crossref and OpenAlex | 26 |
| URL/citation-only, no DOI validation | 13 |
| DOI-like string not found | 0 |

The former fake-looking Science DOI variants:

- `10.1126/science.1228062`
- `10.1126/science.1228063`
- `10.1126/science.1228064`
- `10.1126/science.1228065`

are now normalized to `10.1126/science.1228061` for the Ag/Cu/Ni/Al metal comparator rows. The original workbook text remains preserved in `source_citation_raw`.

## Curation Queue

| Item | Count |
| --- | ---: |
| Record rows needing review | 249 |
| Publication rows needing review | 39 |
| Rows currently ready for manual review without scripted issues | 3 |
| Rows with bad DOI action | 0 |
| Rows requiring non-literature comparator disclosure review | 63 |

The workbook keeps manual decisions in explicit columns:

- `curation_decision`
- `include_public`
- `reviewer`
- `review_date`
- `confidence_score_reviewed`
- `official_*` sample/condition fields
- `duplicate_group_id`
- `primary_record_id`
- `curation_notes`

## Review Standard

Do not set `include_public = Yes` until the row has:

1. A validated DOI or manually verified source.
2. Reviewed units and canonical conversions.
3. Duplicate status resolved.
4. Sample/form-factor metadata checked.
5. Measurement conditions checked where strict comparison is intended.

The current blocker for true strict comparison remains condition metadata: all 101 CNT strict-comparison candidates still need structured method/atmosphere/gauge-length/strain-rate review.

Comparator values from MatWeb, manufacturer pages, and commercial product sheets should not be hidden, but they should be visually labeled as contextual engineering benchmarks. They are useful for Ashby-style comparison, not for strict peer-reviewed CNT-to-CNT comparison.
