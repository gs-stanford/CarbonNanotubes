# Literature Paper Audit - CNT Property Atlas

Generated after local PDF review and database import on 2026-06-12.

## Imported into the database

### Intercalated carbon nanotube fibers with high specific electrical conductivity

- DOI: `10.1126/science.aeb0673`
- Source files reviewed: `science.aeb0673.pdf`; `Juan Vilatela Supplematry.pdf`
- Imported records:
  - Pristine annealed DWCNT fiber.
  - AlCl4-intercalated DWCNT fiber mean.
  - AlCl4-intercalated DWCNT fiber highest.
- Key canonical fields added:
  - Density, diameter, linear density, electrical conductivity, specific electrical conductivity.
  - For the highest intercalated record: tensile strength, specific strength, initial modulus, specific modulus, G:D ratio.
  - Measurement conditions from the supplementary methods where available.
- Comparison status:
  - The three Science 2026 rows are now strict-comparison-ready because material form, method, atmosphere/temperature, gauge length, and relevant strain-rate metadata are structured.

### Fabrication of High Specific Electrical Conductivity and High Ampacity Carbon Nanotube/Copper Composite Wires

- DOI: `10.1002/aelm.202001213`
- Source file reviewed: `Adv Elect Materials - 2021 - Bazbouz - Fabrication of High Specific Electrical Conductivity and High Ampacity Carbon.pdf`
- Imported records:
  - MWCNT/Cu composite wire, short-gauge ampacity measurement.
  - MWCNT/Cu composite wire, long-gauge ampacity measurement.
- Key canonical fields added:
  - Density, diameter, tensile strength, initial modulus, breaking strain, electrical conductivity, specific electrical conductivity, ampacity.
- Comparison status:
  - Classified as `CNT_metal_composite`, not pure CNT fiber.
  - Eligible for normalized/exploratory plots, but not strict pure-CNT fiber comparison.

### Structural and electronic properties of iodine-intercalated carbon nanotube fibers and their conductivity mechanism

- DOI: `10.1016/j.carbon.2026.121575`
- Source file reviewed: `Iodine-deped-CNT.pdf`
- Imported records:
  - As-prepared DWCNT fiber.
  - Iodine liquid-phase intercalated DWCNT fiber.
  - Iodine vapor-phase intercalated DWCNT fiber.
- Key canonical fields added:
  - Electrical conductivity only.
- Comparison status:
  - Public v0 includes these as DOI-verified research records, but strict comparison is blocked because density/specific-conductivity fields and full conditions are not available from the main PDF.

## Reviewed but not newly imported

### Xiao paper

- Source file reviewed: `Xiao Paper.pdf`
- Finding:
  - The paper's supplementary Table S1 is the same structured Ashby-table source already represented by `XiaO_DATA.xlsx`.
  - No duplicate import was made.

### Bulmer/James review/meta-analysis

- DOI: `10.1002/adma.202008432`
- Source file reviewed: `James_doped_CNTs.pdf`
- Finding:
  - The main PDF contains valuable aggregate trends and regression tables across CNT fiber properties, but not a clean row-level dataset suitable for direct import.
  - Importing this as individual records would require either the supplementary/source dataset or manual plot digitization with lower confidence.

## Data needed next

- Supplementary/source data for `10.1002/adma.202008432` if the goal is row-level import from the review/meta-analysis.
- Supplementary data for `10.1016/j.carbon.2026.121575` if density, specific electrical conductivity, diameter distributions, or repeated sample statistics are available.
- Supplementary Table S2/raw device data for `10.1002/aelm.202001213` if the full distribution of CNT/Cu composite conductivity/ampacity measurements should be represented rather than the main-text summary values.

## Outputs updated

- `data/literature/literature_addendum_records.tsv`
- `data/processed/combined_records.csv`
- `data/processed/measurements_long.csv`
- `data/curation/record_curation_queue.csv`
- `data/curation/cnt_property_curation_workbook.xlsx`
- `data/public/public_records_v0.csv`
- `data/public/public_measurements_v0.csv`
- `web/data/public/*`
