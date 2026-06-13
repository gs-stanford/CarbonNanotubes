# Combined CNT Property Database Build Report

Generated from:

- `XiaO_DATA.xlsx`
- `RadarFigureSource.xlsx`
- `New G fibre table Juan.xlsx`

## Output Files

All processed outputs are in `data/processed/`.

| File | Purpose |
| --- | --- |
| `combined_records.csv` | Row-level source/sample records with raw and canonical fields. |
| `measurements_long.csv` | Long-form canonical measurements for plotting/querying. |
| `publications.csv` | Publication/citation table with DOI/URL extraction. |
| `source_issues.csv` | Machine-readable curation flags. |
| `annual_progression.csv` | Separate year-series data from `FibersStrengthYr`. |
| `excluded_source_rows.csv` | Radar plot scaffolding excluded from scientific records. |
| `data_dictionary.csv` | Field notes and canonical units. |
| `cnt_property_database.sqlite` | SQLite version of the processed tables. |
| `build_summary.json` | Counts from the latest build. |

## Build Counts

| Category | Count |
| --- | ---: |
| Scientific records | 249 |
| Canonical measurements | 1762 |
| Publication rows | 39 |
| Source issue flags | 244 |
| Annual progression points | 67 |
| Excluded source rows | 32 |

## Records By Source

| Source | Records |
| --- | ---: |
| `RadarFigureSource.xlsx` | 137 |
| `XiaO_DATA.xlsx` | 109 |
| `New G fibre table Juan.xlsx` | 3 |

## Records By Material Family

| Material family | Records |
| --- | ---: |
| CNT or CNT hybrid | 101 |
| Carbon fiber comparator | 95 |
| Graphene or GO fiber | 18 |
| Polymer fiber comparator | 20 |
| Metal comparator | 10 |
| Ceramic/glass comparator | 5 |

## Canonical Measurement Counts

| Property | Canonical unit | Count |
| --- | --- | ---: |
| Density | kg/m^3 | 207 |
| Specific volume | m^3/kg | 207 |
| Specific strength | N m/kg | 174 |
| Tensile strength | Pa | 156 |
| Specific electrical conductivity | S m^2/kg | 153 |
| Electrical conductivity | S/m | 152 |
| Specific modulus | N m/kg | 142 |
| Thermal conductivity | W/m/K | 135 |
| Breaking strain | 1 | 133 |
| Work of rupture | J/kg | 112 |
| Initial modulus | Pa | 80 |
| Diameter | m | 53 |
| Linear density | kg/m | 53 |
| G:D ratio | ratio | 5 |

## Unit Normalization Rules

- Xiao electrical conductivity is stored raw as S/cm and converted to S/m by multiplying by 100.
- Radar electrical conductivity in MS/m is converted to S/m by multiplying by 1e6.
- Radar `E Cond` values are treated as electrical conductivity in MS/m divided by density in g/cm^3, then converted to canonical sigma/rho in S m^2/kg by multiplying by 1000.
- Density in g/cm^3 is converted to kg/m^3 by multiplying by 1000.
- Specific volume is recalculated from density and stored as m^3/kg.
- Tenacity/specific strength in N/tex is converted to N m/kg by multiplying by 1e6.
- Linear density in tex is converted to kg/m by multiplying by 1e-6.
- Work of rupture in J/g is converted to J/kg by multiplying by 1000.
- Breaking strain in percent is converted to fraction.
- Xiao tensile-strength values above 100 under the GPa-labeled column are treated as MPa-scale values, divided by 1000, and flagged in `source_issues.csv`.

## Publication Update

The former "to be published in Nat Mater" graphene-fiber row is now mapped to:

- DOI: `10.1038/s41563-025-02384-7`
- Title: `High-performance graphene-based carbon fibres prepared at room temperature via domain folding`
- Journal: `Nature Materials`
- Formal citation year: 2026
- Published date: 2025-10-20
- Issue/pages: `25, 191-198`
- URL: `https://www.nature.com/articles/s41563-025-02384-7`

The raw workbook year remains preserved as `publication_year_raw`.

## DOI Overrides

The importer applies these source-text overrides during rebuild:

| Source text/URL | DOI |
| --- | --- |
| `https://www.sciencedirect.com/science/article/pii/S0008622316310752` | `10.1016/j.carbon.2016.12.006` |
| `https://www.sciencedirect.com/science/article/pii/S0008622321004140` | `10.1016/j.carbon.2021.04.033` |
| `https://www.sciencedirect.com/science/article/pii/S0008622322003189` | `10.1016/j.carbon.2022.04.040` |
| `Cho, Y. S. et al. Superstrong Carbon Nanotube Yarns...` | `10.1002/advs.202204250` |

## Corrected Comparator DOI Strings

Xiao rows for Ag, Cu, Ni, and Al contained fake-looking sequential DOI strings:

- `10.1126/science.1228062`
- `10.1126/science.1228063`
- `10.1126/science.1228064`
- `10.1126/science.1228065`

These are now normalized to Behabtu et al., Science 339, 182-186 (2013), `10.1126/science.1228061`, because Fig. 2 in that paper contains the metal Ashby-plot comparator region used for Ag/Cu/Ni/Al-style benchmarks. The original workbook text remains preserved in `source_citation_raw`; `citation_raw` and `doi_raw` carry the normalized DOI used for publication grouping.

These rows still retain `http://www.matweb.com/` as source text and are classified as comparator benchmarks, not primary peer-reviewed CNT measurements.

## Source Evidence Classes

The importer now emits `source_citation_class`, `evidence_tier`, and `comparison_note` for website badges/tooltips and plot filtering.

| Source citation class | Records | Intended public treatment |
| --- | ---: | --- |
| `peer_reviewed_research_record` | 41 | Research-material record with DOI; still needs sample/unit/condition curation before public use. |
| `mixed_peer_reviewed_and_commercial_comparator` | 10 | Contextual benchmark with both peer-reviewed comparator/figure provenance and commercial/material-database source text. |
| `commercial_or_web_specsheet_comparator` | 63 | Non-peer-reviewed engineering benchmark; show visibly as contextual comparison only. |
| `url_only_research_record` | 1 | Research-material URL without DOI in the record; needs primary-publication lookup before public use. |
| `unresolved_or_internal_source` | 134 | Internal seed/source-compilation row; do not expose as official until source curation is complete. |

## Issue Flags

| Issue type | Count | Meaning |
| --- | ---: | --- |
| `missing_conditions` | 101 | CNT-fiber strict-comparison candidates lack structured method/atmosphere/gauge-length/strain-rate metadata. |
| `missing_reference` | 77 | CNT/graphene records lack a DOI-like citation string. |
| `unit_inference` | 66 | Tensile-strength scale was inferred from raw value magnitude. |

## Important Interpretation

This is an internal seed database, not a public official dataset yet. The public website should only expose rows after DOI validation, unit review, duplicate resolution, and condition/sample curation. The source rows are preserved with provenance so those review steps are auditable.

Comparator rows from MatWeb/manufacturer/commercial product pages are not uncitable, but they are not equivalent to peer-reviewed CNT measurements. The public website should label them as contextual engineering benchmarks, require visible legend/badge treatment, and keep them out of strict scientific comparison filters by default.

Radar max rows, score rows, repeated header rows, and unlabeled plot cells were not imported as scientific records. They are preserved in `excluded_source_rows.csv` for auditability.
