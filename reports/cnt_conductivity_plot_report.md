# CNT Conductivity Plot Report

Generated from the corrected processed database in `data/processed/`.

## Figure Outputs

| File | Purpose |
| --- | --- |
| `figures/cnt_conductivity_landscape.png` | High-resolution raster preview. |
| `figures/cnt_conductivity_landscape.svg` | Vector figure for editing/publication layout. |
| `figures/cnt_conductivity_landscape.pdf` | Vector/PDF export. |
| `figures/cnt_conductivity_plot_data.csv` | Exact plotted records and calculated fields. |
| `figures/cnt_conductivity_summary.json` | Numeric summary from the plot script. |

## Figure Style

The figure was regenerated in a Nature-style production format:

- Double-column width: 183 mm.
- Sans-serif lettering with Arial/Helvetica preference.
- 8 pt bold panel labels.
- Other text kept in the 5-7 pt range.
- Thin vector line work.
- SVG text kept editable rather than converted to outlines.
- The previous top-right guide label was removed.

## Key Readout

| Quantity | Value |
| --- | ---: |
| CNT/CNT-hybrid records with density and conductivity | 54 |
| Graphene/GO-CNT records with density and conductivity | 13 |
| Metal benchmark records with density and conductivity | 10 |
| Vilatela Science 2026 density | 1.412 g/cm^3 |
| Vilatela Science 2026 electrical conductivity | 24.5 MS/m |
| Vilatela Science 2026 specific conductivity | 17.35 kS m^2/kg |
| Copper benchmark specific conductivity | 6.565 kS m^2/kg |
| Vilatela/Cu specific-conductivity ratio | 2.64x |

## Interpretation

The Vilatela group 2026 Science entry (`10.1126/science.aeb0673`) is the clear outlier in the current seed database. It does not beat copper in absolute electrical conductivity, but it beats copper strongly on mass-normalized electrical conductivity because it combines high conductivity with much lower density.

This figure is a curation check, not a final meta-analysis. The source database is still not fully deduplicated and many rows lack structured measurement conditions.
