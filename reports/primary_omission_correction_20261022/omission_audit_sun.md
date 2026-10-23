# Sun 2026 omission correction

DOI: 10.1038/s41467-026-69498-7. This corrects the October 22 import, not the authors' paper. All 19 original record IDs and all 30 existing numerical values remain unchanged. AI-source-checked, not independently human adjudicated.

## Corrected scope

The earlier release wrongly treated normalization discrepancies as grounds to omit entire usable measurements. SI Methods p.4 explicitly identifies gradient-column densities and distinguishes the linear-density/SEM-area estimates. Table 9 p.36 has swapped c/d footnotes; its row headings agree with Methods. The gradient values can therefore be retained with the conflict documented.

Three unambiguous endpoint cohorts (PCNTFs, MoCl5 48 h, N/MoCl5 48 h) now gain reported density, side-view SEM diameter, linear density, specific strength, specific electrical conductivity, modulus, Raman IG/ID, and ampacity. Three explicitly calculated modulus/density ratios and three reciprocal-density values are also included. The packet has 60 explicit measurements: 54 reported values and six calculated ratios/reciprocals.

| Cohort | Gradient density (g/cm3) | Alternative area density (g/cm3) | Specific strength (N/tex) | Specific conductivity (S m2/kg) |
|---|---:|---:|---:|---:|
| PCNTF | 1.82 | 1.82 +/- 0.32 | 1.43 +/- 0.05 | 4693 +/- 15 |
| MoCl5 48 h | 1.99 | 2.06 +/- 0.43 | 1.20 +/- 0.03 | 8702 +/- 62 |
| N/MoCl5 48 h | 1.93 | 1.99 +/- 0.20 | 1.29 +/- 0.08 | 14166 +/- 48 |

Methods and Table 9 are the density, diameter, linear-density and normalized-property locators. Modulus uses source workbook Supplementary Figure 14b rows 3,5,6; Raman uses Supplementary Figure 7d rows 3,5,6; ampacity uses Figure 3d rows 3,5,6. All values retain the original PDF/workbook hashes. No source documents are changed or redistributed.

The alternative FIB-equivalent diameters, area densities, and linear-density-specific conductivities remain attached as `source_alternatives`, not duplicate plotted samples. Main-text final specific strength 1.26 +/- 0.07 versus SI 1.29 +/- 0.08 stays unresolved. Table 9 footnote e describes area density although its arithmetic uses gradient density; this is explicitly qualified. No averaging of different conventions or deletion of the conflict is performed.

## Complete property disposition

| CPT property | Disposition |
|---|---|
| Density | Restored for the three unambiguously identified cohorts. Gradient method; unknown density uncertainty stays unknown. |
| Specific volume | Reciprocal of that recorded density, explicitly calculated. |
| Diameter | Table 9 side-view SEM values; FIB-area alternative retained separately. Thirty SEM positions are not thirty independent fibers. |
| Linear density | Table 9 values, checked against workbook mass/length measurements; three separate specimens, 10 m weighing lengths. |
| Tensile strength | All 11 previously admitted cohort/checkpoint means preserved. |
| Specific strength | Table 9 values restored for the three cohorts, conditional source SDs retained. |
| Initial modulus | Source workbook mean/SD restored for the three cohorts. |
| Specific modulus | Explicit modulus/gradient-density ratio of cohort means. No direct mass-normalized measurement or propagated uncertainty asserted. |
| Breaking strain | No tabulated state-resolved scalar/replicate set recovered; not inferred from Young's modulus or fabricated from unpaired endpoints. |
| Work of rupture | No reported mass-specific integral or verified replicate distribution recovered. |
| Electrical conductivity | All 19 original means and SDs preserved. |
| Specific electrical conductivity | Table 9 reported gradient-density-normalized values restored; linear-density alternatives retained with numerical conflicts. |
| Thermal conductivity | Not measured for fibers in this paper. Surface heating, heating rate and film Hall measurements are not fiber thermal conductivity. |
| Specific thermal conductivity | No underlying fiber thermal measurement. |
| Ampacity | Source workbook means/SD restored; SI p.5 ambient air, 50 mm free span. Exact independent n unknown. |
| Raman G:D | Reported IG/ID at 532 nm restored, not reciprocal ID/IG or film carrier density. |

## Remaining state-allocation limits

Density/diameter/normalized values in the named N-CNTF summary cannot be assigned to the explicit 5-min or 10-min source-series row solely because the raw values happen to match 10 min: the main prose says 5 min and the identity is unresolved. Existing timed rows stay intact, without invented property joins. This is a specific state-allocation hold, not a statement that the authors did not measure N-CNTF density. The named N densities are 1.76 gradient and 1.78 +/- 0.45 area-based (SI p.4/Table9); they remain in source evidence rather than an arbitrarily timed record.

Similarly, endpoint density is not copied to the other plasma/doping-duration checkpoints, other dopants or reversed order. Known raw strength/conductivity remains usable for those states. Properties were checked against the whole summary and methods, not just conductivity figures.

## Verification

Independent constants in `test_recent_primary_admission.py` check all three summary cohorts, units, retained alternatives, unknown counts, reported-versus-calculated status, and public CSV metadata propagation. New fail-closed import tests reject unknown field spellings, values without metadata and metadata without values. Live release tests explicitly request density/conductivity, specific-strength/conductivity and both specific properties, plus diameter, linear density, Raman and ampacity.
