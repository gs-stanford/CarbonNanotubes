# Core Excel Database Audit

Generated from `XiaO_DATA.xlsx`, `RadarFigureSource.xlsx`, and `New G fibre table Juan.xlsx`.

## Bottom Line

`XiaO_DATA.xlsx` should be treated as the current primary Excel database. It is a direct Origin/Ashby-style table with paired value/error columns, citation text, geometry, density, linear density, mechanical properties, electrical conductivity, and thermal conductivity. The older radar workbook is useful for derived radar plotting and uncertainty cross-checks, but it is incomplete as a database source.

## Xiao Workbook Structure

- Sheet: `Sheet1`
- Raw worksheet size: `A1:Y124`
- Data rows with at least one measurement: 109
- Unique DOI-like strings: 19
- Rows with at least one DOI-like string: 38/109
- Rows without DOI-like strings: 71/109

### Xiao Material-Family Counts

| Material family | Rows |
| --- | --- |
| Carbon fiber comparator | 46 |
| CNT/CNT hybrid | 32 |
| Polymer/high-performance fiber comparator | 20 |
| Metal comparator | 6 |
| Ceramic/glass comparator | 5 |

### Xiao Property Coverage: All Rows

| Field | Value coverage | Error coverage | Range |
| --- | --- | --- | --- |
| diameter_um | 53/109 | 3/109 | 2-52.7 |
| density_g_cm3 | 86/109 | 10/109 | 0.089928-19.32 |
| linear_density_tex | 53/109 | 5/109 | 0.01-3.61 |
| tenacity_N_tex | 107/109 | 22/109 | 0.00621-4.3 |
| tensile_strength_GPa | 82/109 | 12/109 | 0.116-8400 |
| initial_modulus_N_tex | 82/109 | 9/109 | 4.5-425 |
| initial_modulus_GPa | 80/109 | 8/109 | 5.6-935 |
| breaking_strain_pct | 79/109 | 5/109 | 0.3-30 |
| rupture_work_J_g | 39/109 | 16/109 | 3.18-100 |
| electrical_conductivity_S_cm | 43/109 | 5/109 | 0-6.2e+05 |
| thermal_conductivity_W_mK | 54/109 | 10/109 | 0.04-1200 |

### Xiao Property Coverage: CNT/CNT-Hybrid Rows

| Field | Value coverage | Error coverage | Range |
| --- | --- | --- | --- |
| diameter_um | 11/32 | 3/32 | 2-52.7 |
| density_g_cm3 | 15/32 | 10/32 | 0.089928-2.01 |
| linear_density_tex | 9/32 | 5/32 | 0.01-1 |
| tenacity_N_tex | 32/32 | 22/32 | 0.1045-3.84 |
| tensile_strength_GPa | 16/32 | 12/32 | 0.116-6.05 |
| initial_modulus_N_tex | 18/32 | 9/32 | 48.485-210 |
| initial_modulus_GPa | 11/32 | 8/32 | 25-422 |
| breaking_strain_pct | 15/32 | 5/32 | 1.4-7.2 |
| rupture_work_J_g | 24/32 | 16/32 | 3.18-100 |
| electrical_conductivity_S_cm | 11/32 | 5/32 | 300-1.09e+05 |
| thermal_conductivity_W_mK | 13/32 | 10/32 | 21-496 |

## Citation/Reference Coverage

| Source | Rows | Unique DOI-like strings | Reference keys |
| --- | --- | --- | --- |
| XiaO_DATA.xlsx | 109 | 19 | 16 |
| RadarFigureSource.xlsx / Radar | 77 | 6 | 18 |
| RadarFigureSource.xlsx / Fibers With Error | 93 | 0 | 17 |
| New G fibre table Juan.xlsx | 3 | 2 | n/a |

### DOI Overlap

- Xiao ∩ Radar DOI-like strings: 2
- Xiao ∩ Fibers With Error DOI-like strings: 0
- Xiao ∩ New G DOI-like strings: 0

### Reference-Key Overlap

- Xiao ∩ Radar reference keys: 13, 14, 19, 20, 36, 37, 39, 50, 58, 59, 60, 61, 62, 63
- Xiao ∩ Fibers With Error reference keys: 13, 14, 19, 20, 36, 37, 39, 40, 50, 58, 59, 60, 61, 62, 63

### DOI Strings Requiring Validation

These DOI-like strings appear in comparator rows and look suspicious because they are sequential variants of one Science DOI. Treat them as unverified until Crossref validation:

- `10.1126/science.1228062`
- `10.1126/science.1228063`
- `10.1126/science.1228064`
- `10.1126/science.1228065`

## Unit/Scale Flags

- Rows with `tensile_strength_GPa > 100`: 66
- These are concentrated in comparator rows and are almost certainly MPa-scale values despite the exported column label `GPa`.
- Example: Toray T1100GC has density 1.79 g cm-3, tenacity 3.91 N tex-1, and tensile strength 7000. This is consistent with 7000 MPa = 7 GPa, because 7/1.79 = 3.91.
- Import rule: preserve the raw field, then create a canonical `tensile_strength_GPa_canonical`; for comparator rows with raw values >100, divide by 1000 and flag `unit_inferred_from_tenacity_density`.

| Material family | Flagged rows |
| --- | --- |
| Carbon fiber comparator | 38 |
| Polymer/high-performance fiber comparator | 20 |
| Ceramic/glass comparator | 5 |
| Metal comparator | 3 |

## Overlap With Older Excel Workbooks

The older radar workbook appears to be a derived/partial plotting workbook, not the primary source. It overlaps with Xiao by DOI/reference key for many CNT-fiber rows, but it also contains formula-derived radar fields, summary/max rows, and incomplete citation cells.

Examples of likely row-level overlap by name/comment:

| Workbook sheet | Row | Name | Match type |
| --- | --- | --- | --- |
| Radar | 21 | SWNT-Raw | exact name |
| Radar | 22 | DWNT-Raw | exact name |
| Fibers With Error | 6 | This Work-Fully DD | exact name |
| Fibers With Error | 7 | This Work-Raw | exact name |
| Fibers With Error | 22 | SWNT-Raw | exact name |
| Fibers With Error | 23 | DWNT-Raw | exact name |

`New G fibre table Juan.xlsx` is a small 3-row addendum for graphene fibers. It overlaps conceptually with the lower addendum embedded in `FibersStrengthYr`, but not with most Xiao rows.

## Mapping To Website Data Model

### publication

- Use Xiao `Citation` as the primary raw citation field.
- Extract DOI-like strings, URLs, free-text citation fragments, and reference keys separately.
- Do not mark a DOI valid until Crossref/OpenAlex validation.

### sample

- `record_label` and `notes` contain sample/material identity.
- Current classification can start with: CNT/CNT hybrid, carbon fiber comparator, polymer/high-performance fiber comparator, ceramic/glass comparator, metal comparator.
- CNT-specific fields such as CNT type, synthesis method, heat treatment, densification/stretching, and hybrid/additive should be parsed from `record_label`/`notes` but manually reviewed.

### measurement

- Xiao directly maps to diameter, density, linear density, tenacity, tensile strength, initial modulus, breaking strain, rupture work, electrical conductivity, and thermal conductivity.
- Specific volume and specific electrical conductivity can be calculated from density/electrical conductivity while preserving original values.
- G:D ratio is not present in Xiao and must remain sourced from the radar workbook or future literature extraction.

### conditions

- Xiao contains limited condition metadata.
- Heat-treatment temperature can be parsed from labels like `S&DWNT-2700℃`.
- Measurement method, atmosphere, gauge length, and strain rate are mostly absent and should be nullable fields plus quality/completeness badges.

### provenance

- Preserve `source_file`, `source_sheet`, and `source_row` for every imported row.
- Add `source_export = OriginPro/Xiao Ashby export` for Xiao rows.
- Add `extraction_method = exported_table` for Xiao, `manual_addendum` for New G, and `derived_plot_workbook` for Radar unless verified otherwise.

### status

- Public records should still expose only official/verified rows.
- Internal statuses remain necessary for DOI validation, unit review, duplicate resolution, and source-condition review.

## Suggested Import Order

1. Import Xiao rows as the primary table with row-level provenance.
2. Normalize units and create canonical measurement fields.
3. Validate DOI-like strings through Crossref/OpenAlex and split citation text into DOI, URL, journal/title/year where possible.
4. Deduplicate against `RadarFigureSource.xlsx`; keep Radar-derived values only where Xiao lacks a field, especially G:D ratio and existing radar-specific derived columns.
5. Add `New G fibre table Juan.xlsx` as a separate addendum table after checking whether the 2025 unpublished row should be internal-only.
6. Only then build the website data API and comparison-level logic.
