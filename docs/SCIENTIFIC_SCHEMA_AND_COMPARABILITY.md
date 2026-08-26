# CPT Scientific Schema and Comparability Model

Status: pre-launch specification  
Rule version: `cpt-property-pair-v1`  
Last reviewed: 2026-08-26

## Scope

Carbon Property Tables stores reported material-property claims and the evidence needed to decide whether a particular plotted comparison is defensible. It does not treat DOI validation as numerical validation, a shared workbook row as proof of a shared specimen, or missing metadata as a negative result.

The release is suitable for exploratory figures and source discovery. A point is publication-ready only to the extent stated by its property-pair evidence grade and disclosed metadata.

## Scientific objects

- **Publication:** bibliographic identity for a source article, compilation, or comparator source.
- **Record:** one material/sample description linked to a publication.
- **Measurement:** one property claim in canonical units, with its reported form, uncertainty, statistic, conditions, normalization, and provenance.
- **Property-pair assessment:** a query-time evaluation of the two measurements used to place one point in a two-axis figure.
- **Figure assessment:** the set of point assessments, method-metadata groupings, release identity, and rule version for one rendered figure.

## Two distinct comparison questions

### Intra-record specimen linkage

Specimen linkage asks whether the x and y measurements in one plotted point belong to the same physical specimen or sample batch. It is stored on the record and measurements.

Allowed release values:

| Value | Meaning |
| --- | --- |
| `same_specimen_verified` | Curator verified that both measurements refer to one identifiable specimen. |
| `same_sample_batch` | Curator verified a shared material batch, but not one physical specimen. |
| `mixed_specimens` | The source explicitly combines different specimens. |
| `aggregated_across_specimens` | The value is a cohort or aggregate rather than one specimen. |
| `incompatible` | The source establishes that the measurements cannot form a same-sample pair. |
| `single_source_row_unverified` | A legacy source row contains both values, but the primary source has not established specimen identity. |
| `not_applicable_single_property` | Only one active property is being evaluated. |
| `unknown` | Linkage was not established. |

Submitter claims use separate states and never become verified automatically. A verified same-specimen state requires a curator and a specimen identifier.

### Inter-record method compatibility

Method compatibility asks whether two records used comparable protocols. It is a relation among records for a particular property, not a field on one record.

Version 1 exposes descriptive method-metadata groups but reports inter-record compatibility as `not_assessed`. Free-text similarity, a common test-standard label, or an LLM suggestion is not treated as evidence of equivalence. A future method-compatibility ontology must define explicit property-specific rules before comparisons may be suppressed or ranked on that basis.

## Point evidence grades

Grades are computed at query time from stored primitives. They are not persisted as canonical facts.

| Grade | Current interpretation |
| --- | --- |
| **A** | DOI-backed or primary-source-verified evidence; curator-verified same specimen; required conditions complete; relevant normalization and statistic basis reported. |
| **B** | Strong source evidence with verified same specimen or same batch, but at least one noncritical evidence component remains incomplete. |
| **C** | Bibliographically credible point with unresolved specimen linkage, incomplete conditions, unknown statistic/bound basis, or incomplete normalization metadata. |
| **D** | Contextual, commercial, unverified, or otherwise insufficiently supported for a scientific ranking claim. |

The grade describes evidence for that point in the active property pair. It does not certify agreement with every other point. The figure export records the grade, rule version, release ID, and disclosure.

## Measurement fields and controlled values

### Reported value and uncertainty

- `reported_value`, `reported_unit`: source-scale representation before canonical conversion.
- `value_canonical`, `unit_canonical`: deterministic canonical representation used by the query engine.
- `reported_or_derived`: `reported`, `reported_with_unit_inference`, or `derived`.
- `uncertainty_value_reported`, `uncertainty_value_canonical`.
- `uncertainty_type`: `standard_deviation`, `standard_error`, `confidence_interval`, `range`, `reported_unspecified`, or `not_reported`.
- `sample_size_n`: positive integer when reported.

`reported_unspecified` is deliberately distinct from SD, SE, and confidence interval. CPT never infers an uncertainty type from an error-bar column alone.

### Statistic and bound

- `statistic_type`: `individual`, `mean`, `median`, `best_specimen`, `maximum`, `minimum`, `range_endpoint`, or `unspecified`.
- `value_bound_type`: `point_estimate`, `upper_bound`, `lower_bound`, `range_midpoint`, `range_endpoint`, or `unspecified`.

The product mode is called **Highest reported values**, not reported maxima. Unknown or mean statistics may appear only with their basis disclosed; they are not relabeled as maxima.

### Test and specimen metadata

- `test_standard`
- `measurement_method`
- `measurement_direction`
- `condition_temperature_C`
- `condition_atmosphere`
- `gauge_length_mm`
- `strain_rate_s_inv`
- `specimen_id`
- `sample_batch_id`
- `specimen_linkage`
- `cross_section_method`

Condition requirements are property-specific. For example, tensile properties require method/standard, gauge length, strain rate, and direction; electrical and thermal properties have different required fields.

### Normalization and density

`normalization_basis` uses:

- `direct_mass_specific_linear_density`
- `directly_reported_mass_specific`
- `derived_from_density`
- `derived_from_linear_density`
- `not_applicable`
- `unknown`

Direct `N tex^-1` tensile specific strength is a force divided by measured linear density and does not inherently require a bulk-density convention. It must not be recast as tensile strength divided by density unless the source actually used that derivation.

For density-derived values, CPT retains:

- `density_basis`: e.g. bulk/envelope, skeletal/pycnometry, assumed graphitic, linear-density plus cross-section, other reported, or unknown.
- `density_value_kg_m3`
- `density_source_locator`
- `derivation_formula`
- `derivation_inputs_json`

The release audit recomputes supported derived values from these inputs. An unknown density convention remains explicitly unknown and lowers evidentiary strength; it is never silently interpreted as a standard density.

## Provenance states

Bibliographic identity, extraction path, and numerical verification are separate:

- `dataset_provenance`
- `value_extraction_type`
- `primary_source_verification_status`
- `source_file`, `source_sheet`, `source_row`
- `provenance_table_figure_page`
- `extraction_method`
- `curator`

Crossref/OpenAlex confirmation means that a DOI and its metadata resolve. It does not prove a number. Author-curated compilation records may retain `verified_against_primary_source` when that check was part of the documented compilation workflow; this status must not be inferred merely because the compilation itself is peer reviewed.

`data/public/public_provenance_census_v0.csv` reports record, publication, and measurement counts by source file, extraction path, verification state, and release tier.

## Submission gate

Community submissions are written to PostgreSQL as hidden curator candidates. Automated DOI validation, unit canonicalization, duplicate detection, and optional label cleanup cannot set `official` status or public visibility.

Density-derived specific properties require the numerator property, density, explicit density basis, and a recomputable result in the same submission. Multi-property same-specimen claims require a specimen identifier. Human review of the primary paper/SI remains the final gate.

## Reproducibility and release pinning

Every figure response and SDK manifest records:

- release ID and source hash;
- complete value-free request parameters;
- comparability rule version and disclosure;
- represented citations;
- output formats and point count.

Clients may send an exact `release` value. If it does not match the active release, the current server fails closed instead of silently rendering newer data. Historical server-side replay is not yet promised because PostgreSQL currently stores one canonical snapshot. A paper must cite and archive a tagged release, source tables, code, and a one-command offline reproduction script in a persistent repository such as Zenodo.

## Safe paper claims

Defensible wording for the current stage:

> Figure X was generated from Carbon Property Tables release `<release-id>` using the property-pair evidence model `cpt-property-pair-v1`; values and source-level qualifications are listed in the accompanying table.

Do not claim that the current release is comprehensive, that all values are directly primary-source extracted, or that all represented measurements are method matched.

## Remaining human-validation work

Before a publication release:

1. Run a 20-record dual-extractor pilot against this draft schema and revise ambiguous definitions.
2. Freeze the schema and complete a stratified 50-record gold set.
3. Report agreement by field/property; do not substitute one aggregate agreement number.
4. Verify specimen linkage and density basis for every point in any manuscript figure.
5. Archive the frozen release, exclusions, provenance census, codebook, citations, and reproduction command under a version DOI.
