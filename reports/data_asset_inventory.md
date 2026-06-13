# CNT Review Data Asset Inventory

Generated from local files in `/Users/gsharma/Documents/Review Paper Database` on 2026-06-10.

## Executive Summary

The current dataset is strong enough to seed a CNT property visualization site, but it is not yet a normalized scientific database. After inspecting the OriginPro project, the correct source hierarchy is:

1. `XiaO_DATA.xlsx`, exported from the OriginPro project, is now the primary Excel database because it contains citation, geometry, density, linear density, tenacity, tensile strength, modulus, strain, rupture work, electrical conductivity, and thermal conductivity columns.
2. The original OriginPro project (`Data for Fig-6-Ashby plot.opju`) remains the upstream source of truth if the Excel export needs to be regenerated.
3. The older Excel workbooks are incomplete secondary exports/addenda, useful for cross-checking but not sufficient as the primary database source.
4. The MATLAB literature archive (`*Datas.m`) is broader across CNT material forms, but needs reference and provenance reconstruction before public use.
5. Plot-generation assets (`Fig2_*.m`, `.fig`) are useful for reproducing figures, but should not be treated as authoritative raw database tables without provenance recovery.

The biggest immediate gap is not property values. The gap is structured provenance and comparability metadata: DOI, publication title, sample form, synthesis route, measurement direction, test conditions, source table/figure/page, and whether values were table-extracted, figure-digitized, assumed, or calculated.

## Files Present

| File | Type | Main use | Database value |
|---|---:|---|---|
| `XiaO_DATA.xlsx` | Excel workbook | Primary Origin/Ashby property export | Highest current import value |
| `RadarFigureSource.xlsx` | Excel workbook | Incomplete radar/Ashby fiber property export | Medium; secondary cross-check |
| `New G fibre table Juan.xlsx` | Excel workbook | 3 graphene-fiber rows | Medium; likely addendum/duplicate source |
| `ArrayYarnDatas.m` | MATLAB data function | Forest-drawn yarn/sheet/crosslinked arrays | High, but needs citation parsing |
| `SpunDatas_002.m` | MATLAB data function | FCCVD/direct-spun sheets and yarns | High, broadest CNT-fiber archive |
| `WetSpunDatas.m` | MATLAB data function | Wet/acid-spun CNT fibers | High |
| `BuckyDatas.m` | MATLAB data function | Buckypaper properties | High for cross-form landscape mode |
| `FoamDatas.m` | MATLAB data function | CNT foams/aerogels | High for cross-form landscape mode |
| `ForestDatas.m` | MATLAB data function | CNT forests/arrays | High for cross-form landscape mode |
| `Fig2_Stallard.m` | MATLAB plot script | Consolidated density-strength plot | Medium; plotting table, not provenance-rich |
| `Fig2_Stallard_Elec.m` | MATLAB plot script | Consolidated density-electrical-conductivity plot | Medium; plotting table, not provenance-rich |
| `Fig2_YrlyProgression.m` | MATLAB plot script | Reads yearly progression from Excel | Medium |
| `Fig2_AnnualProgression.m` | MATLAB plot script | Hard-coded yearly progression | Low-medium; older static version |
| `Fig2_Strength_Rho.fig` | MATLAB figure | Rendered/serialized figure | Low for data import; scripts are better |
| `Data for Fig-6-Ashby plot.opju` | OriginPro project | Most complete Ashby/property workbook | Highest, but requires Origin export/parser |

## Primary Source: Xiao Excel Export

File: `XiaO_DATA.xlsx`

Current audit: [reports/core_excel_database_audit.md](/Users/gsharma/Documents/Review Paper Database/reports/core_excel_database_audit.md).

This workbook should be imported first. It contains 109 rows with at least one measurement and a repeated value/error-column structure for diameter, density, linear density, tenacity, tensile strength, modulus, strain, rupture work, electrical conductivity, and thermal conductivity.

Important import caveat:

- Several comparator rows have tensile-strength values greater than 100 under an exported `GPa` label.
- These are almost certainly MPa-scale comparator values, e.g. Toray T1100GC = 7000 MPa = 7 GPa.
- Preserve raw values and create canonical normalized values with an explicit unit-inference flag.

## Upstream Source: OriginPro Project

File: `Data for Fig-6-Ashby plot.opju`

Binary/string inspection confirms the project contains a worksheet-like table with:

- `No.`
- `Notes`
- `Citation`
- `Diameter`
- `Density`
- `Linear Density`
- `Tenacity`
- `Tensile Strength`
- `Initial Modulus`
- `Breaking strain`
- `Rupture Work`
- `Electrical Conductivity`
- `Thermal Conductivity`

This upstream file is still useful if `XiaO_DATA.xlsx` must be regenerated or audited against the original Origin project.

Current limitation:

- The local Mac/Python environment cannot reliably parse `.opju` into structured rows.
- `originpro` is an official OriginLab Python automation package, but it is Windows-only and requires a local Origin 2021+ installation.
- `OriginExt`, the low-level dependency, ships Windows wheels only, so this cannot be made to run natively in the current macOS workspace.

Prepared extraction path:

- Use [scripts/export_origin_workbook.py](/Users/gsharma/Documents/Review Paper Database/scripts/export_origin_workbook.py) on a Windows machine with Origin 2021+ installed.
- Install the Windows-only dependencies from [requirements-origin-windows.txt](/Users/gsharma/Documents/Review Paper Database/requirements-origin-windows.txt).
- It exports all Origin worksheets to CSV and Parquet, preserves column label rows/units/comments as JSON, and exports graph previews.
- After that export exists locally, the normalization pipeline can use the exported table as the primary database input.

## Secondary Excel Workbook Inventory

### `RadarFigureSource.xlsx`

#### `Radar`

Actual populated data rows: 77. Excel dimension reports `A1:O972`, but many rows are formatting/formula residue.

Columns:

- `Name`
- `Comments`
- `Density [g cm−3] ±`
- `Specific Volume [cm3g-1]`
- `Tenacity [N tex−1 = GPa/SG = GPa/(g/cm^3)]`
- `Initial Modulus [N tex−1 = GPa/SG = GPa/(g/cm^3)]`
- `Work of Rupture [J g−1]`
- `E Cond [MS m^2/g]`
- `Thermal Conductivity [W m−1 K−1]`
- `Electrical Conductivity [MS m−1]`
- `Tensile [GPa]`
- `G:D Ratio`
- `Publication`
- `Unnamed: 14`

All rows, including comparators and summary rows:

| Field | Numeric coverage | Range |
|---|---:|---|
| Density | 68/77 | 0.1172-8.96 g cm-3 |
| Specific volume | 66/77 | 0-12.56 cm3 g-1 |
| Tenacity | 74/77 | 0.03839-94.85 N tex-1 |
| Initial modulus | 72/77 | 1.359-535 N tex-1 |
| Work of rupture | 48/77 | 0.8432-151.2 J g-1 |
| Specific electrical conductivity | 64/77 | 0-19.57 MS m2 g-1 |
| Thermal conductivity | 48/77 | 0-800 W m-1 K-1 |
| Electrical conductivity | 62/77 | 0-58.82 MS m-1 |
| Tensile strength | 39/77 | 0-8.12 GPa |
| G:D ratio | 5/77 numeric | 0.14-50 |

Clean CNT-like subset before the carbon-fiber comparator rows:

| Field | Numeric coverage | Range |
|---|---:|---|
| Density | 32/40 | 0.36-2.1 g cm-3 |
| Tenacity | 39/40 | 0.1-5.8 N tex-1 |
| Initial modulus | 36/40 | 2.22-535 N tex-1 |
| Work of rupture | 29/40 | 3.18-151.2 J g-1 |
| Thermal conductivity | 14/40 | 21-770 W m-1 K-1 |
| Electrical conductivity | 28/40 | 0.03-24.5 MS m-1 |
| Tensile strength | 33/40 | 0-8.12 GPa |
| G:D ratio | 4/40 | 7-50 |

Provenance status:

- 7 unique DOI-like strings found in the full `Radar` sheet.
- DOI coverage is poor relative to 40 CNT-like rows.
- Several rows use review-style reference labels such as `(58)`, `(39)`, `(13)`, etc., but the mapping to full references is not in this sheet.
- Some non-CNT comparator rows use URLs/datasheets rather than journal DOIs.

Scientific interpretation:

- This is the best first frontend dataset because it already has normalized fiber metrics and comparator materials.
- It is not yet a database-quality source because source provenance is incomplete and some rows are summary/normalization rows rather than measurements.
- The `Publication` field must be split into `doi`, `url`, `free_text_reference`, and `reference_key`.

#### `Fibers With Error`

Actual populated rows: 93.

This sheet is likely the best source for uncertainty-aware fiber plots. It contains the same fiber/comparator style as `Radar`, but has repeated uncertainty columns.

Clean CNT-like subset before the carbon-fiber comparator rows:

| Field | Numeric coverage | Range |
|---|---:|---|
| Density | 29/39 | 0.66-2.1 g cm-3 |
| 1/Density | 29/39 | 0.4762-1.515 cm3 g-1 |
| Tenacity | 36/39 | 0.1-5.8 N tex-1 |
| Initial modulus | 32/39 | 50-535 N tex-1 |
| Elongation | 29/39 | 0.18-7.2 % |
| Work of rupture | 24/39 | 3.18-100 J g-1 |
| Electrical conductivity | 27/39 | 0.03-11.2 MS m-1 |
| Thermal conductivity | 13/39 | 21-496 W m-1 K-1 |
| Tensile strength | 32/39 | 0-8.12 GPa |

Uncertainty fields are present but unnamed/repeated:

- Density uncertainty: `Unnamed: 3`, 10 numeric entries.
- Tenacity uncertainty: `±`, 25 numeric entries.
- Initial modulus uncertainty: `±.1`, 24 numeric entries.
- Elongation uncertainty: `±.2`, 20 numeric entries.
- Work of rupture uncertainty: `±.3`, 16 numeric entries.
- Electrical conductivity uncertainty: `±.4`, 16 numeric entries.
- Thermal conductivity uncertainty: `±.5`, 10 numeric entries.

Provenance status:

- Only 1 DOI-like string was found in the full sheet.
- Several rows appear to rely on labels like `(58)` rather than full DOI/reference records.
- Rows after the main fiber/comparator block include max-score and label/data blocks; they should be excluded from direct measurement import.

#### `FibersStrengthYr`

This sheet contains at least two embedded tables:

1. Rows 1-23, columns A-E: yearly progression table with `Year`, `CNTF_SPSTR`, `GF_SPSTR`, `CNTSH_SPSTR`, `GSH_SPSTR`.
2. Rows 23-26, columns F-J: small graphene-fiber addendum with `Ref`, `Notes`, `Strength, GPa`, `Specific Strength, Gpa/SG`, `Density, g/cc`.

Do not import this sheet as one table. Split it before normalization.

### `New G fibre table Juan.xlsx`

Rows: 3.

Columns:

- `Strength, GPa`
- `Specific Strength, Gpa/SG`
- `Density, g/cc`
- `Year`
- `Ref`
- `Notes`

Coverage:

| Field | Numeric coverage | Range |
|---|---:|---|
| Strength | 3/3 | 0.36-5.49 GPa |
| Specific strength | 3/3 | 0.36-2.889 GPa/SG |
| Density | 3/3 | 1-1.93 g cm-3 |
| Year | 3/3 | 2024-2025 |

Provenance status:

- 2 DOI-like strings found.
- One 2025 row is listed as `to be published in Nat Mater`, so it is not DOI-verifiable yet.

Interpretation:

- This file appears to duplicate or supplement the lower addendum embedded in `FibersStrengthYr`.
- Import once, not twice.

## MATLAB Literature Vector Inventory

All core data functions use the same 7-column vector schema:

1. Density, kg m-3
2. Strength, MPa
3. Stiffness, GPa
4. Ductility, %
5. Energy to failure, MJ m-3
6. Electrical conductivity, S cm-1
7. Thermal conductivity, W m-1 K-1

Total assigned material rows across data-vector files: 288.

| File | Vector | Rows | Material interpretation |
|---|---:|---:|---|
| `ArrayYarnDatas.m` | `ArrayYarnVec` | 59 | Forest-drawn CNT yarns |
| `ArrayYarnDatas.m` | `ArraySheetVec` | 12 | Forest-drawn CNT sheets/mats |
| `ArrayYarnDatas.m` | `ArrayLinkedVec` | 9 | Crosslinked/modified array-derived materials |
| `BuckyDatas.m` | `BuckyVec` | 18 | Buckypapers |
| `FoamDatas.m` | `FoamVec` | 35 | CNT foams/aerogels/sponges |
| `ForestDatas.m` | `ForestVec` | 34 | CNT forests/vertically aligned arrays |
| `SpunDatas_002.m` | `SheetVec` | 34 | FCCVD/direct-spun sheets |
| `SpunDatas_002.m` | `YarnVec` | 67 | FCCVD/direct-spun yarns/fibers |
| `WetSpunDatas.m` | `WetSpunVec` | 20 | Wet/acid-spun CNT fibers |

Aggregate property coverage across MATLAB vectors:

| Property | Entries |
|---|---:|
| Density | 276 |
| Strength | 201 |
| Stiffness | 169 |
| Ductility | 75 |
| Energy to failure | 61 |
| Electrical conductivity | 131 |
| Thermal conductivity | 39 |

Per-vector coverage:

| Vector | Density | Strength | Stiffness | Ductility | Energy | Electrical | Thermal |
|---|---:|---:|---:|---:|---:|---:|---:|
| `ArrayYarnVec` | 54 | 52 | 44 | 27 | 27 | 12 | 1 |
| `ArraySheetVec` | 12 | 10 | 8 | 0 | 0 | 10 | 3 |
| `ArrayLinkedVec` | 9 | 9 | 5 | 0 | 0 | 0 | 0 |
| `BuckyVec` | 18 | 9 | 9 | 2 | 0 | 11 | 6 |
| `FoamVec` | 35 | 7 | 12 | 0 | 0 | 25 | 5 |
| `ForestVec` | 34 | 20 | 24 | 1 | 0 | 7 | 6 |
| `SheetVec` | 34 | 27 | 27 | 8 | 14 | 14 | 3 |
| `YarnVec` | 60 | 60 | 33 | 33 | 20 | 32 | 4 |
| `WetSpunVec` | 20 | 7 | 7 | 4 | 0 | 20 | 11 |

Provenance status:

- The MATLAB files contain about 153 free-text citation/comment blocks across the data functions.
- DOI coverage is effectively zero in the MATLAB comments.
- The comments often include author lists, titles, journals, years, volumes, and pages. This is enough to DOI-enrich later using Crossref/OpenAlex, but not enough for immediate DOI-verified publication-quality provenance.
- Some comments explicitly state assumptions, e.g. assumed density. Those assumptions must become structured provenance notes.

## Consolidated Plot Scripts

### `Fig2_Stallard.m`

This script consolidates density vs strength arrays:

| Category | Points |
|---|---:|
| array yarn | 15 |
| array sheet | 10 |
| array crosslinked | 9 |
| bucky | 9 |
| foam | 7 |
| forest | 20 |
| spun yarns | 21 |
| spun sheets | 26 |
| wet-spun | 7 |
| recent records | 4 |
| metals | 3 |
| carbon fiber comparator | 1 |

Use:

- Good for reproducing the current Ashby-style plot.
- Not sufficient as database input because individual row provenance is absent.

### `Fig2_Stallard_Elec.m`

This script consolidates density vs electrical conductivity arrays:

| Category | Points |
|---|---:|
| array yarn | 4 |
| array sheet | 2 |
| bucky | 10 |
| foam | 24 |
| forest | 7 |
| spun yarns | 10 |
| spun sheets | 14 |
| wet-spun | 13 |
| recent records | 2 |
| metals | 3 |
| carbon fiber comparator | 1 |

Use:

- Good for reproducing density-electrical-conductivity plot.
- Must be linked back to source vectors or literature before database publication.

## OriginPro Extraction Status

The OriginPro project is the primary source, but row-level import is blocked until it is exported from Origin. The prepared Windows/Origin export helper is [scripts/export_origin_workbook.py](/Users/gsharma/Documents/Review Paper Database/scripts/export_origin_workbook.py).

## Mapping To Planned Database Schema

### `publication`

Current state:

- Partially present.
- DOI/reference coverage appears strongest in the OriginPro project, but row-level coverage cannot be quantified until export.
- The Excel addenda have a few DOI fields but are incomplete.
- MATLAB files contain free-text references but no normalized DOI/title/journal/year table.

Needed fields:

- `publication_id`
- `doi`
- `title`
- `authors`
- `journal`
- `year`
- `source_reference_key`
- `url`

Immediate action:

- Build a reference-resolution table from Excel `Publication` fields and MATLAB citation comments.
- Use DOI extraction first, Crossref/OpenAlex fuzzy lookup second, manual review third.

### `sample`

Current state:

- Material form exists implicitly by file/vector name and partially by row `Comments`.
- CNT type, synthesis method, densification/alignment, diameter, mat thickness, and postprocessing are not consistently structured.

Needed fields:

- `sample_id`
- `material_family`: CNT, graphene, carbon fiber, metal, polymer, glass, etc.
- `form_factor`: fiber/yarn, sheet/mat/film, buckypaper, forest, foam/aerogel, comparator
- `synthesis_route`: FCCVD/direct-spun, wet/acid-spun, forest-drawn, buckypaper filtration, VA-CNT forest, etc.
- `postprocessing`: densified, stretched, heat-treated, doped, crosslinked, raw, etc.
- `cnt_type`: SWCNT, DWCNT, MWCNT, few-wall, mixed/unknown
- `diameter_or_thickness_value`
- `diameter_or_thickness_unit`

Immediate action:

- Use source file/vector as the first `form_factor` classifier.
- Parse row names/comments for synthesis/postprocessing labels.
- Do not allow cross-form plots to imply strict equivalence.

### `measurement`

Current state:

- Strong coverage for mechanical and electrical properties.
- Thermal conductivity is present but sparse.
- Raman G:D is present only in the radar workbook and very sparse.

Needed fields:

- density
- specific volume
- tensile strength
- tenacity/specific strength
- initial modulus/specific modulus
- stiffness
- elongation/ductility
- work of rupture/toughness/energy to failure
- electrical conductivity
- specific electrical conductivity
- thermal conductivity
- G:D ratio
- uncertainty fields for each property where available
- unit fields and normalized SI fields

Immediate action:

- Normalize all units into canonical values:
  - density: kg m-3 and g cm-3
  - strength: MPa and GPa
  - conductivity: S m-1, S cm-1, MS m-1
  - thermal conductivity: W m-1 K-1
  - tenacity: N tex-1 / GPa per SG
- Preserve original units and values.

### `conditions`

Current state:

- Mostly absent.
- Some process/heat-treatment temperatures are embedded in sample names such as `S·DW:2700℃`.
- Test conditions such as gauge length, strain rate, atmosphere, measurement direction, probe method, and temperature are not structured.

Needed fields:

- `measurement_temperature_k`
- `atmosphere`
- `measurement_direction`: axial, transverse, in-plane, through-plane
- `electrical_method`: two-probe, four-probe, unknown
- `thermal_method`
- `tensile_gauge_length`
- `strain_rate`
- `specimen_count`
- `reported_uncertainty_type`

Immediate action:

- Add nullable condition fields now.
- Do not block import because conditions are absent.
- Use condition completeness as a public quality badge/filter later.

### `provenance`

Current state:

- Present in human-readable form, weak in structured form.
- No consistent source table/figure/page.
- No structured extraction method: table, digitized figure, assumed, calculated.

Needed fields:

- `source_file`
- `source_sheet_or_vector`
- `source_row_or_index`
- `source_publication_id`
- `source_location`: table, figure, page, supporting info
- `extraction_method`: table, digitized, calculated, assumed, copied-from-review
- `curator`
- `confidence_score`
- `provenance_note`

Immediate action:

- Every imported value should carry at least `source_file`, `sheet/vector`, and row/index.
- Add `confidence_score` after DOI/source verification, not before.

### `status`

Public-facing status should remain simple:

- `official`

Internal workflow can still have private states:

- `imported`
- `needs_reference_resolution`
- `needs_unit_review`
- `needs_condition_review`
- `approved`
- `rejected`

Only `approved/official` rows should appear on the public site.

## Recommended Import Strategy

1. Export `Data for Fig-6-Ashby plot.opju` from OriginPro using `scripts/export_origin_workbook.py`.
   - This should become the primary source table.
   - Preserve CSV/Parquet data plus column labels, units, and comments.
   - Do not build the public database from the incomplete Excel workbook unless the Origin export is unavailable.

2. Normalize the exported Origin worksheet into `materials_measurements.csv`.
   - Use `Citation`, `Notes`, `Diameter`, density, linear density, tenacity, tensile strength, modulus, strain, rupture work, electrical conductivity, and thermal conductivity as first-class fields.
   - Keep the Origin book/sheet/row provenance for every imported value.

3. Use `RadarFigureSource.xlsx`, sheets `Radar` and `Fibers With Error`, only as secondary cross-checks.
   - These sheets are incomplete exports/addenda.
   - They are still useful for uncertainty columns and current radar-plot formatting.
   - Requires filtering out comparator and summary rows.

4. Build a normalized supplemental table from the MATLAB vector files.
   - Best for the broad CNT landscape.
   - Use file/vector as initial form-factor labels.
   - Keep source index for every row.

5. Create a `references_raw.csv`.
   - Extract `Citation` cells from the Origin export first.
   - Extract `Publication` cells from Excel second.
   - Extract MATLAB citation comments.
   - Add `reference_key` labels such as `(58)`, `(39)`, `(13)` if mapping is recoverable.

6. Resolve DOI metadata.
   - Direct DOI extraction first.
   - Crossref/OpenAlex fuzzy title lookup second.
   - Manual verification for ambiguous entries.

7. Build the website around comparison modes:
   - Strict: same form factor and compatible measurement basis.
   - Normalized: specific properties and normalized comparisons.
   - Cross-form landscape: fibers/mats/buckypapers/forests/foams together, visually flagged.

## Immediate Website Feasibility

The current data is enough for a strong first version with:

- CNT fiber property explorer.
- Density vs tenacity.
- Density vs tensile strength.
- Density vs electrical conductivity.
- Tenacity vs thermal conductivity if Origin or thermal rows are exported.
- Yearly progression of CNT fibers, graphene fibers, CNT sheets, and graphene sheets.
- Comparator overlays for carbon fibers, metals, glass/polymer fibers, if clearly labeled.

It is not yet enough for:

- Fully DOI-backed public database.
- Strict apples-to-apples condition-filtered comparisons.
- Automated user submission pipeline.
- Fully auditable Nature-level supplemental dataset.

The correct next technical step is to build normalized import scripts and a schema, not the frontend first.
