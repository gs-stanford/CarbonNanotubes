# Wang 2026 Omission Audit

DOI: [10.1038/s41467-026-75150-1](https://www.nature.com/articles/s41467-026-75150-1). Audit date: 2026-10-22. AI source checked, not human adjudicated. No same-filament certification, global build, commit or push performed. Scoped edits: Wang packet, Wang tests, this report only.

## Source Coverage

Read archived official `publisher.html`, `article.pdf` (especially pp.5-6 and Methods p.12), complete SI `41467_2026_75150_MOESM1_ESM.pdf` (21 pages), source workbook `41467_2026_75150_MOESM9_ESM.xlsx`, and relevant peer-review response `MOESM8` p.14. Local directory: `outputs/fiber_discovery_20261022/wang_fluidics_audit/`. Source workbook's auxiliary Sheet8/4/5/1/6 are empty, not omitted property tables. Original numerical extraction and full curve inventory remain in `extraction.json`, `extraction.csv`, and `AUDIT.md` there.

Official SI: https://static-content.springer-cdn.com/esm/art%3A10.1038%2Fs41467-026-75150-1/MediaObjects/41467_2026_75150_MOESM1_ESM.pdf

Official workbook: https://static-content.springer-cdn.com/esm/art%3A10.1038%2Fs41467-026-75150-1/MediaObjects/41467_2026_75150_MOESM9_ESM.xlsx

Each admitted measurement has source filename, exact locator, and SHA256 of its archived source. Workbook SHA256: `b87dfa7f611e98f32777de20fcda678f38cc1bb6e0787eadf0b73dbe402f7845`; main HTML: `52a0eb9db2bcba4fb77ae5aa06ea6fe0325b50fa6999ba470d3b557b5647995d`; SI: `cc1b19b0860a46dc1170e3968837103fce404ca7b0073fa0001b10d75decc490`.

## Admission Outcome

Packet expanded from **6 records / 9 measurements to 18 records / 33 measurements**. All original six record IDs are preserved. The new conditions are eight explicit S/DS dose summaries, two thin-ribbon rolling states, and two scalar-only conditions (D zero-scour and S 0.03 km). These are not 18 independent studies or necessarily disjoint specimen populations.

The former hold of dose-labelled summaries solely because their overlap with unspecified-dose Fig.4d was unknown was too broad. Preserve the dose-labelled measurements as distinct conditions, flag possible population overlap, and never manufacture joint strength/tenacity pairs. Likewise, seven SI curves do not invalidate an explicitly labelled four-replicate main-figure summary. Source conflicts require qualification, not wholesale suppression of an otherwise identifiable narrow-ribbon state.

### Strength, Modulus and Strain

Workbook sheet `Fig.4a-f`, C40:E47; main Fig.4d/f and p.6:

| Named State | Strength (GPa) | n | Observed Min-Max (GPa) | Other Admitted Metrics |
|---|---:|---:|---:|---|
| R-CNTF unrolled | 0.86 | 5 | 0.66-1.16 | baseline specific strength 2.61 N/tex, n=3 |
| R-CNTF rolled | 1.81 | 5 | 1.73-1.92 | no numerical population modulus/strain supplied |
| S-CNTF unrolled | 2.82 | 5 | 2.55-3.36 | no forced dose allocation |
| S-CNTF rolled | 5.75 | 5 | 5.65-5.90 | no forced dose allocation |
| DS-CNTF unrolled | 4.92 | 5 | 4.64-5.29 | illustrative geometry retained separately |
| DS-CNTF rolled | 11.63 | 5 | 11.27-12.02 | 370 GPa modulus; approximately 4.5% break strain; n/uncertainty not given for these two metrics |
| DS-THINF unrolled narrow strip | **12.43, analyst mean** | 4 | 12.35-12.60 | 260 GPa modulus; approximately 7% break strain; 7.5 N/tex reported summary, separate n=4 |
| DS-THINF rolled narrow strip | 12.32 | 3 | 12.18-12.40 | no borrowed thin-unrolled modulus, strain or tenacity |

Unrolled THINF source C46 says `12.5 (12.35,12.37,12.4,12.6)`. The canonical 12.43 GPa is explicitly **derived** from the four listed replicates; `reported_value` is null, `author_reported_summary` retains 12.5, and the formula and inputs are stored. This is not a claim that the authors reported 12.43, nor an adjudication that the four-value list is more authoritative than their headline. The source conflict is unresolved. No additional 12.5-GPa record is created from the same population. No gauge explanation is supported: the text and source do not associate the discrepancy with a different gauge or maximum statistic.

Rolled THINF D47 has upper bar 0.8 GPa, inconsistent with 12.40 minus 12.32 = 0.08 GPa. Preserve original bar value and discrepancy; use the explicit replicate extrema for bounds. This does not invalidate the named mean 12.32 or its three replicates. All observed min-max ranges remain endpoints, not SD/SEM/CI. Asymmetric scalar uncertainty remains null with `uncertainty_type=not_reported` and explicit range-statistic notes.

The thin modulus and strain are explicitly mapped by main p.6 / Fig.4f to **unrolled DS-THINF**, not to 370-GPa rolled DS-CNTF. SI Table3 p.17 combines 4.387% with 12.5 GPa under an umbrella label; it is not used to override the named configurations or certify a joint specimen.

### Specific-Strength Dose Series

Workbook `Fig.4a-f!A29:J33`; main Fig.4c, pp.5-6. Units N/tex = 10^6 N m/kg. Values below are reported means, not substituted ratios of separately reported load/tex points.

| State | Dose (km) | Reported Mean | n | Observed Min-Max | Cells |
|---|---:|---:|---:|---:|---|
| R baseline | 0 | 2.61 | 3 | 2.49-2.77 | B29:D29 |
| S | 0.3 | 3.89 | 4 | 3.76-4.06 | B30:D30 |
| DS | 0.3 | 5.03 | 3 | 4.87-5.17 | E30:G30 |
| S | 0.6 | 4.69 | 3 | 4.53-4.79 | B31:D31 |
| DS | 0.6 | 6.03 | 3 | 5.63-6.31 | E31:G31 |
| S | 1.2 | 5.23 | 3 | 5.05-5.49 | B32:D32 |
| DS | 1.2 | 7.03 | 3 | 6.88-7.26 | E32:G32 |
| S | 3 | 5.37 | 4 | 4.81-6.34 | B33:D33 |
| DS | 3 | 7.15 | 3 | 6.71-7.72 | E33:G33 |
| DS-THINF | 3 | 7.5 | 4 | 7.41-7.56 | H33:J33 |

THINF's four-value mean is 7.4575 N/tex, compatible with the coarser reported 7.5. Seven SI7 traces have a different mean and undocumented pool overlap; do not merge their n. Specific-strength n=4 and strength n=4 do not establish identical individuals. Main p.5's S value 5.33 at 1.2 km conflicts with explicit source B32=5.23: retained 5.23 with the textual conflict recorded. DS header E28 has malformed units, resolved by Fig.4c axis, adjacent series and Methods definition; this is not grounds to discard that series. Rolling allocation is not explicitly supplied for the dose-series summaries and remains qualified, rather than asserted per row.

### Linear Density and Raw Load

Workbook `Fig.4a-f!A14:H22` gives exact named scalar points. All eleven are retained in packet `supported_context_series.failure_load_and_tex`; n and population statistic are unknown. Converted force unit is 10^-2 N; 10^-6 kg/m is numerically tex.

| State / Dose (km) | Failure Load (N) | Linear Density (tex) | Source Row |
|---|---:|---:|---:|
| R / 0 | 1.2050 | 0.460 | 16, S branch |
| S / 0.03 | 1.4189 | 0.450 | 17, S branch |
| S / 0.3 | 1.7381 | 0.446 | 18, S branch |
| S / 0.3 duplicate label | 1.9337 | 0.446 | 19, S branch |
| S / 0.6 | 2.0722 | 0.438 | 20, S branch |
| S / 1.2 | 2.2123 | 0.426 | 21, S branch |
| S / 3 | 2.2707 | 0.426 | 22, S branch |
| D / 0 | 1.8647 | 0.400 | 16, DS branch |
| DS / 0.6 | 2.4516 | 0.400 | 17, DS branch |
| DS / 1.2 | 2.7854 | 0.400 | 18, DS branch |
| DS / 3 | 2.8130 | 0.400 | 19, DS branch |

**Ten state-labelled linear densities are now canonical measurements**, including S0.03 and directly stretched D0 as distinct scalar-only states. S0.3 has two discrepantly labelled load points but identical tex, so a single 0.446-tex metric cites both rows without silently choosing a load or changing either dose label. No DS0.3 tex is supplied. No thin-route 0.5-tex weighing result is invented from SI curve ratios.

Failure load has no measurement definition in the existing shared builder; it is retained exactly in packet context and linked state facts, not inserted under an unsupported canonical property or discarded. This is a serialization limitation, not a scientific rejection. The source's duplicated S0.3 and the main text's assignment of 3-km endpoint loads to 1.2 km remain explicit conflicts. Do not replace Fig.4c means with scalar F/tex ratios. These are same-named-condition links, not same-specimen certification.

### Dimensions, Density and Structural Metrics

- Main p.12: 2-mm starting cut width and tensile strips; fiber/strip shape is not circular, and final width changes. Record as preparation geometry, never a 2-mm diameter. Starting main CNTF film thickness 921 nm versus separate THINF film 152 nm (main p.5). These are not final treated cross-sections.
- Main p.6 and SI Fig.8 p.10: illustrative DS-CNTF unrolled dimensions thickness 7.34 um, width 85.13 um; rolled thickness 0.44 um, width 541.9 um. Retained as sourced geometry in the corresponding original records. Rectangular products 624.8542 and 238.436 um^2 are examples, not measured mean segmented areas. No uncertainty/n supplied. Width/thickness are not shoehorned into diameter, and roller gap <=0.09 mm is not specimen thickness.
- Main Methods p.12: volume density = measured linear density / SEM cross-sectional area; irregular unrolled areas segmented with ImageJ. This is a legitimate method-qualified density measurement, not an intrinsically invalid technique. **The missing element is numerical state allocation**, not the method. SI Table1 p.15 and Table3 p.17 supply only umbrella density 1.45-1.66 g/cm^3. No named state gets an endpoint or midpoint, and no density is inferred by dividing different specimen-pool means or by multiplying illustrative dimensions. Range retained in held metadata.
- Purified R-CNTF Raman IG/ID=5.6 restored (SI Fig.2d caption/text pp.3-4). It is not the orientation ratio IG_parallel/IG_perpendicular. The pre-purification 3.91 does not belong to purified R, and no spurious as-grown strength record is added. Orientation factors and remaining characterization spectra stay in the original source audit; they are not mechanical or transport measurements.

## Complete Property Disposition

| Property | Disposition | Exact Basis / Remaining Barrier |
|---|---|---|
| Tensile strength | eight named-state canonical values | six original means + two qualified thin states; C40:C47 |
| Specific tensile strength | ten canonical means | explicit Fig.4c dose summaries; no generic-dose inference |
| Linear density | ten canonical scalar values | Fig.4b labelled conditions; n unknown, not means of Fig.4c replicas |
| Modulus | two canonical narrative values | rolled DS370 / unrolled thin260 GPa, main p.6; no n/uncertainty supplied |
| Breaking strain | two canonical narrative values | rolled DS4.5% / unrolled thin7%, main p.6; no n/uncertainty supplied |
| Failure load | eleven exact scalar points in packet context | canonical builder lacks force field; no shared schema edits authorized |
| Dimensions / area | sourced illustrative geometry + starting dimensions | not population mean segmented area; no invented diameter |
| Volume density / specific volume | **unallocated range retained, no fiber-state assignment** | SI Tables1/3 only umbrella1.45-1.66 g/cm^3; valid method, missing state numbers |
| Raman G/D | R purified5.6 canonical | SI Fig.2d; no polarized orientation-ratio confusion |
| Electrical conductivity | **held from state records** | main p.6 reports group2.4-2.8 MS/m; no endpoint/state/rolling/dose table; MOESM8 p.14 repeats group only |
| Specific electrical conductivity | **held from state records** | same group1500-1750 S m^2/kg; SI Table2 p.16 is an umbrella comparison, not allocation to thin/fiber individual states |
| Thermal conductivity | **wide-film benchmark only; excluded from fiber records** | main p.6:3cm x10cm DS-THINF film; Methods p.12:25.4-mm circular sample,25C; range867.96-968.03 W/m/K |
| Specific thermal conductivity | **same wide-film exclusion** | main p.6:541-605 mW m^2/K/kg =0.541-0.605 W m^2/K/kg; not fiber data |
| Heat capacity / thermal diffusivity | supporting wide-film method only | SI Fig.13 pp.13-14 Cp0.73+/-0.03 J/g/K,5-10 film samples, uncertainty type unspecified; no state-labelled fiber diffusivity table |
| Specific modulus | absent as a safely linked numeric fiber datum | no assigned density for either modulus; do not calculate from mixed pools or radar scaling |
| Toughness / work of rupture | no explicit numeric population measurement found | discussion mentions toughness; no arbitrary integration of selected curves promoted as a reported mean |
| Ampacity | absent | no measured current-density limit found |
| Gauge-series strengths/loads | source curves retained in prior audit, not duplicate population records | SI Fig.11 p.12 gives individual gauge curves, not additional cohort mean/SD; they do not resolve thin mean discrepancy |
| Inter-strip shear / rope hanging | ancillary tests, not axial fiber strength | main Fig.7 / SI Fig.12: overlap-joint stress and twisted multi-strip ropes have different load paths; no conversion to yarn tensile metrics |

Electrical Methods p.12 are usable four-point sheet resistance, >=10 positions, conductivity1/(Rs*d). Those details do not identify which named material produced each endpoint. Position count is not specimen n. No midpoint, abstract ~3MS/m, or radar-plot reading is silently assigned. Thermal Methods are also legitimate: along alignment, laser flash25C,3-5 diffusivity repeats; SI p.14 reports5-8% instrument accuracy and Cp uncertainty but neither is a fiber tensile uncertainty. Heat-transfer details do not cure the form mismatch.

## Independent Checks and Comparability

`python3 scripts/test_wang_primary_admission.py`: **8 tests pass**. Tests independently read original workbook cells, recompute source hashes, check all original IDs, dose means/min-max/n, the thin mean/bar conflicts, exact load scaling and tex, and invoke the real loader/build_measurements only inside an isolated temporary Wang-only directory: **18 records / 33 measurements**. No production/global build executed.

Within-paper only: DS rolling mean strength11.63/4.92=2.363821; illustrative inverse-area ratio624.8542/238.436=2.620637, not an exact matched load inference. Typical DS Fig.4e specific peaks7.14930/7.14971=0.9999427. Source scalar raw-to-DS3km load2.813/1.205=2.334440; tex0.460->0.400. These support distinguishing scouring load gain from rolling area-normalization gain, not a significance test or paired-replicate causal contrast. No separate rolled/unrolled failure-load or tex replicate distributions are supplied.

Remaining acquisition/adjudication needs are specific: author clarification of C46 author mean versus four replicas, D47 upper-bar decimal, duplicated S0.3 label, exact dose of Fig.4d cohorts and overlap with Fig.4c, per-state transport/density table, and sample-pool mapping of SI7. Existing fulltext already supplies the general methods; merely obtaining another main-PDF copy will not resolve these numerical allocation gaps.
