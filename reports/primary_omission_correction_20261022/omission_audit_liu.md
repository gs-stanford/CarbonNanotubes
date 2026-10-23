# Liu 2026: 16-property omission audit

Audit date: 2026-10-22. Scope: read-only inspection of the primary sources, `liu_2026.json`, and the current public CSV projection. No generator, packet, test, loader, or release files changed. This report is an AI-assisted source audit, not human adjudication.

Follow-on status: the focused graphical extraction below is now complete. The initial audit sections preserve the pre-extraction snapshot; their visual approximations and pending-extraction labels are superseded by the **Completed graphical extraction** section and `omitted_figure_values.json`.

**Decision:** the existing five drawing cohorts and five mechanical gauge cohorts are present. Important omissions remain: **20 defensible density-normalized cohort ratios**, graphically reported diameter and Raman series, and numerical representative stress-strain curves. The latter contain recoverable endpoint strains and curve integrals, but not source-reported mean breaking strain or mean mass-specific rupture work. Sink-float density is a valid explicitly stated normalization convention; it is not sufficient evidence of identical-specimen pairing or outer-envelope bulk-density equivalence.

## Sources and release snapshot

Senping Liu et al., *Ultrahigh-ratio drawing during spinning achieves graphene fibres with high strength and thermal conductivity*, **Nature Materials 25, 1732-1740 (2026)**, DOI [10.1038/s41563-026-02733-0](https://www.nature.com/articles/s41563-026-02733-0).

Archive: `/Users/gsharma/Documents/Review Paper Database/outputs/fiber_discovery_20261022/graphene_draw_audit/`.

- **M:** `article.pdf`, 19 PDF pages. Extended Data Fig.7 is on PDF p.19; main methods on PDF pp.10-12. PDF page numbers, not journal page numbers, are used below.
- **S:** `41563_2026_2733_MOESM1_ESM.pdf`, 71 PDF pages. Printed SI page = PDF page minus one. [Publisher SI](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41563-026-02733-0/MediaObjects/41563_2026_2733_MOESM1_ESM.pdf).
- **W10:** `41563_2026_2733_MOESM10_ESM.xlsx`, source data for main Fig.4. [Publisher workbook](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41563-026-02733-0/MediaObjects/41563_2026_2733_MOESM10_ESM.xlsx).
- **W14:** `41563_2026_2733_MOESM14_ESM.xlsx`. Workbook sheets retain `E.D.Fig.6` names, although their mechanical panels appear in published Extended Data Fig.7. [Publisher workbook](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41563-026-02733-0/MediaObjects/41563_2026_2733_MOESM14_ESM.xlsx).
- Also inspected the MOESM8/9/11/12/13 workbook sheets for relevant properties. These principally concern liquid-thread rheology/geometry, orientation, or ridge morphology, not additional final-fibre CPT measurements.

Packet snapshot: **10 records, 35 explicit metrics**. Public snapshot: **10 records, 40 measurements**, including five derived reciprocal-density measurements already present. Counts by property: tensile strength 10; initial modulus 10; density, specific volume, electrical conductivity, thermal conductivity 5 each. All other requested CPT metrics are absent for these records.

| Snapshot/file | SHA256 |
|---|---|
| `data/curation/primary_additions/liu_2026.json` | `42eed5b5aa52dcb5bc8de8a54bd157c347f4e98fff8b686ba0fe43dda80b3007` |
| `data/public/public_records_v0.csv` | `aa072025b68126b17efecde0cfc1566142551080e01ff8888b31875c47c0089b` |
| `data/public/public_measurements_v0.csv` | `997904f92ccb83bf028acda3aba939ec2810dbd90592bea5fdda4b4a4c59ac0d` |
| M | `a93ebf63420fc13a50e087afad5861d25e880b20d45e02f44d2c1d7a816c7ba9` |
| S | `f91f3a0d70eb05fa05962fc7fe94ccc20ec5edde7e98337e1e6f6784539020aa` |
| W10 | `bf776e5077e367fb24aed387c5b62abe25b89556f0965d5432aaa3c170cb1fe9` |
| W14 | `ad5d8b9478660d5982aac6e8520fa43617f16b1318bc6e2cb9c4cce89ab88e88` |

## All 16 CPT metrics

Order within drawing-series lists is draw ratio 1, 4, 6, 8, 10 unless stated otherwise. Values prefixed by `~` are visual extraction targets, **not completed numerical digitizations**.

| CPT metric | Current coverage and omitted evidence | Admission/action |
|---|---|---|
| Density | Five graphitized-fibre means/SD already admitted, approximately 1.330/1.660/1.740/1.890/2.050 g/cm^3, from S Fig.36, PDF p.43. The same figure also reports a separate GOF precursor series, approximately 0.83/1.13/1.25/1.33/1.43 g/cm^3. S Fig.38e, PDF p.45, separately plots four thermal-treatment densities, approximately 1.43/1.60/1.80/2.05 g/cm^3. | Final-fibre drawing series complete. Precursor and thermal-state density series are **reported but not extracted/admitted**. Digitize means/SD and preserve separate state identities; do not merge GOF with GFs-2800 or treat overlapping final states as independent replicates. |
| Specific volume | Five public values already derived as 1/rho; approximately 0.751763/0.602359/0.574648/0.529064/0.487748 cm^3/g. Not explicit in packet but **not missing from release**. | Retain method-dependent reciprocal density. Correct inherited `statistic_type=mean`: 1/(cohort mean density) is not a measured mean of specimen specific volumes. State the transformation explicitly. |
| Diameter | S Fig.38e, PDF p.45 / printed p.44: approximately 17.1/11.2/9.5/8.2 micrometres for UrDGOF/UrDGF-200/UrDGF-1600/UrDGF-2800. Caption: mean +/- one SD, n=3 independent technical replicates. | **Graphically reported but not extracted.** Four thermal-state diameters, not five drawing-series diameters. Digitize mean/SD; record diameter-definition uncertainty and noncircular cross-sections. |
| Linear density | No explicit final-fibre tex, denier, kg/m, or mass-per-measured-length series located in main, SI, or seven workbooks. | **Not located as a reported measurement.** Do not manufacture measured linear density from nominal circular area and sink-float density. A model calculation would require a separate geometry convention and would not be a source measurement. |
| Specific tensile strength | No explicitly reported mass-specific series located. Five T/rho ratios are computable from the admitted drawing cohorts; numerical table below. | **Add five derived metrics**, with sink-float, ratio-of-cohort-means convention. No density borrowing into gauge cohorts. |
| Tensile strength | Drawing series 0.22/2.63/3.85/4.91/5.89 GPa already admitted with SD, W10 `Fig.4f!D2:E6`, also W14 `E.D.Fig.6c!B2:C6`. Five gauge-series means/SD already admitted, including 5 mm. | No omitted mean point in these two series. Representative curves and the W14 comparison-panel alternatives below are not extra cohort means. Preserve existing Table3/headline qualifications. |
| Specific modulus | No explicitly reported mass-specific series located. Five E/rho ratios are computable; table below. | **Add five derived metrics**; source E is Young's modulus, carried in CPT's initial-modulus field. Preserve the unusually large source SD at draw 1, not an invented correction. |
| Initial/Young's modulus | Drawing series 38.1/296/578/852/960 GPa with SD already admitted, W14 `E.D.Fig.6d!B2:C6`; five gauge-series values also present. | Mean series complete. New comparison-sheet discrepancies require additional source qualification, not replacement by alternative values. |
| Breaking strain | W14 `E.D.Fig.6a` supplies exact typical-curve endpoint strains: **1.86402/0.87142/0.62241/0.58450/0.56023%**. M p.19 calls these typical stress-strain curves, not a mean breaking-strain series. | **Numerical curve data not extracted**, not wholly unreported strain. Endpoint-based values can be exposed as representative-curve estimates only with the termination-as-fracture assumption explicit. Do not assert a reported mean, SD, n=3, or confirmed fracture endpoint. |
| Work of rupture | No explicitly reported mass-specific rupture-work/toughness values located. W14 curves permit integration to their last supplied points; computed volumetric and conditional mass-normalized results below. | **Derived curve-energy opportunity**, not a reported toughness series. Whole-curve-to-fracture completeness is not documented; a conditional endpoint-energy estimate must not silently become confirmed work of rupture. MJ/m^3 is not J/g. |
| Electrical conductivity | Five digitized means/SD already admitted, approximately 0.54024/0.86010/1.10013/1.25003/1.33013 MS/m; S Fig.49, PDF p.56. | Drawing series complete. Preserve digitization and existing endpoint source-conflict qualifications. Fig.52 resistance/current data are additional context, not another conductivity series. |
| Specific electrical conductivity | No explicitly reported mass-specific series located. Five sigma/rho ratios are computable; table below. | **Add five derived metrics.** Last-step point estimate decreases after normalization, unlike absolute sigma; do not claim significance without ratio uncertainty. |
| Thermal conductivity | Five means/SD already admitted: 832/1130/1356/1539/1720 W/(m K), W10 `Fig.4f!B2:C6`. | Drawing series complete. Retain the source's pressure/high-vacuum inconsistency qualification; no extra thermal value is supplied by the IR application images. |
| Specific thermal conductivity | No explicitly reported mass-specific series located. Five kappa/rho ratios are computable; table below. | **Add five derived metrics.** This is method-dependent density normalization, not evidence that all geometry effects have been removed. |
| Ampacity | S Fig.52, PDF p.59, shows UrDGF surviving **0.32 A** while the series Cu wire fuses; both are labelled 3.1 ohm. No GF failure threshold or specimen-specific cross-sectional area is supplied. | **No reported A/m^2 ampacity located.** Preserve 0.32 A as a demonstrated survived-current/lower-bound context observation, not measured ampacity. Do not borrow the Fig.38 diameter to invent current density. |
| Raman G:D | S Fig.47b, PDF p.54, reports **D/G**, not G/D, for draw ratios **1,2,4,6,8,10**; approximate D/G 0.041/0.039/0.037/0.026/0.0165/0.0052. S Fig.37c, PDF p.44, also reports the four thermal states. | **Graphically reported but not extracted.** Digitize D/G, then derive CPT G/D by reciprocal. Include the additional draw-2 Raman-only state without borrowed mechanics or density. Do not label plotted D/G as G/D. |

## Ready addition: 20 density-normalized cohort ratios

For each of the five existing `10.1038/s41563-026-02733-0|draw-N` states, use its own admitted T, E, sigma, kappa and rho. The raw properties have independent technical-replicate summaries; identical tested filaments and raw covariance are not established. The source density method is explicitly sink-float in tetrabromoethane, carbon tetrachloride and hexamethylene (S PDF p.7 / printed p.6).

**These ratios are valid deterministic descriptions under the stated density convention.** Liquid accessibility, pores and the relationship between displacement volume and the cross-sectional area used in stress/conduction remain unresolved. That limits interpreting the numbers as direct load-per-linear-mass or intrinsic transport improvement; it does not invalidate computing and disclosing the ratios.

| Draw ratio | T/rho (N/tex) | E/rho (N/tex) | sigma/rho (kS m^2/kg) | kappa/rho (W m^2/(kg K)) |
|---|---:|---:|---:|---:|
| 1 | 0.165388 | 28.642168 | 0.406133 | 0.625467 |
| 4 | 1.584204 | 178.298274 | 0.518089 | 0.680666 |
| 6 | 2.212396 | 332.146718 | 0.632190 | 0.779223 |
| 8 | 2.597706 | 450.762839 | 0.661344 | 0.814230 |
| 10 | 2.872835 | 468.237918 | 0.648767 | 0.838926 |

Numbers above are rounded reproducibility results, not new precision claims. Calculated with Python Decimal from canonical packet values and independently checked with JavaScript arithmetic from source-unit arrays. Canonical conversions: N/tex x 1e6 = N m/kg; kS m^2/kg x 1000 = S m^2/kg. Kappa/rho is already in canonical W m^2/(kg K). All four canonical formulas are the respective canonical raw property divided by `density_kg_m3`.

Recommended per-measurement metadata:

- `reported_or_derived=derived`; do not call the ratio source-reported or fabricate a reported mass-specific unit/value. Store the calculated result and formula, with original input values/units retained separately.
- `normalization_basis=derived_from_density`; `density_basis=sink_float_density_not_verified_outer_area_bulk_density`; explicit convention `ratio_of_reported_draw_cohort_means_using_sink_float_density`.
- `statistic_type=unspecified` with `measurement_definition` identifying a ratio of cohort means, **not** a mean of matched-filament ratios. `uncertainty_type=not_reported`, null derived SD and null derived sample size. Retain each input's reported SD, n=3, technical-replicate definition and digitization sensitivity in derivation inputs. Assuming independence to estimate uncertainty would be another explicitly labelled model, not reported SD.
- Keep `specimen_linkage=single_source_row_unverified` and note same named drawing cohort, not confirmed identical filament. Retain stable `curated_state_id`, AI-only review status and `strict_candidate_missing_conditions`.
- `derivation_inputs_json` should identify both input property values, units, state/record IDs, source locators and hashes. Numerator locators: W10 `Fig.4f!D2:D6` for T, W14 `E.D.Fig.6d!B2:B6` for E, S Fig.49 PDF p.56 for sigma, W10 `Fig.4f!B2:B6` for kappa. Denominator: S Fig.36 PDF p.43, GFs-2800 series at the same draw ratio.
- Add the normalization convention and pairing caveat to per-measurement `source_qualification` and record `conditions_notes`, so flattened public views retain them. Replace the current blanket sentence saying no mass-specific metrics are derived for release; preserve its historical rationale in audit history instead of leaving contradictory live prose.

Point-estimate consequence: sigma/rho at draw 10 is about **1.90% below** draw 8 (0.64877 versus 0.66134 kS m^2/kg), whereas T/rho and kappa/rho rise. This is a descriptive consequence of the chosen normalization, **not** a statistically established optimum or proof of intrinsic change.

## Strain and endpoint energy: exact recoverable data

W14 `E.D.Fig.6a` has row-2 units strain (%) and stress (GPa); all five curves start at (0,0). The populated ranges and endpoints are:

| Draw | Workbook range | Points | Last strain (%) | Last stress (GPa) | Integral to last point (MJ/m^3) | Conditional integral/rho (J/g) |
|---|---|---:|---:|---:|---:|---:|
| 1 | `A3:B20` | 18 | 1.86402 | 0.43545 | 4.131902 | 3.106210 |
| 4 | `C3:D13` | 11 | 0.87142 | 2.68486 | 11.787276 | 7.100172 |
| 6 | `E3:F9` | 7 | 0.62241 | 3.80148 | 11.764350 | 6.760364 |
| 8 | `G3:H8` | 6 | 0.58450 | 4.56602 | 13.131316 | 6.947312 |
| 10 | `I3:J8` | 6 | 0.56023 | 5.82740 | 16.836670 | 8.212049 |

Exact endpoint-strain fractions are 0.0186402, 0.0087142, 0.0062241, 0.0058450 and 0.0056023. The integral is a trapezoidal calculation over the supplied discrete curve, converting strain percent to fraction and GPa to Pa. The last column divides that integral by the corresponding **drawing-cohort** sink-float density and converts J/kg to J/g. It is not based on measured mass of the plotted specimen.

Action: preserve these numerical curves and explicit source ranges in extraction metadata. An endpoint-strain addition must identify `representative_curve_endpoint`, the assumption that the published curve terminates at fracture, unspecified replicate statistic/uncertainty, and unresolved gauge. For a CPT rupture-work entry, additionally disclose discrete-curve integration, endpoint completeness and the cross-specimen density convention; without accepting those assumptions it remains **energy to last supplied curve point**, outside confirmed rupture-work measurements. No source-reported mean toughness was recovered.

Do not attach n=3/SD from the adjacent summary panels to these individual displayed curves. Do not compute strain by dividing the reported mean T by mean E. The draw-1 curve ends at **0.43545 GPa**, whereas the separately reported mean T is **0.22 +/- 0.11 GPa**: they are not the same statistic and cannot be silently interchanged. M p.19 gives no failure drop, raw triplicate curve set, or explicit fracture-endpoint annotation.

## Figure extraction additions

**Diameter and thermal-state density, S Fig.38e, PDF p.45 / printed p.44.** Four named states and approximate target means are listed in the matrix. The figure is raster-embedded, so do not reuse the vector-circle extraction for Figs.36/49. Calibrate axes, extract means and SD separately, and record pixel sensitivity distinct from experimental SD. Convert micrometres to metres by 1e-6. Retain n=3 technical replicates. The shown sections are irregular/noncircular; the reported diameter's equivalent-area versus width convention is not defined. Do not infer circular load-bearing area from it. Add as thermal-treatment records or measurements with documented named-state mapping; do not assign 8.2 micrometres to all five draw states or to any gauge specimen.

**Precursor density, S Fig.36, PDF p.43 / printed p.42.** The GOFs series is a separate control population from GFs-2800. Its five approximately 0.83/1.13/1.25/1.33/1.43 g/cm^3 means and SD remain unextracted; n=3 technical replicates is stated for the figure. These could support precursor density/specific-volume records. Do not pair with graphitized-fibre T/E/sigma/kappa.

**Raman drawing series, S Fig.47b, PDF p.54 / printed p.53.** Six states, including draw 2. Approximate reciprocals of the visual D/G targets are G/D ~24/~26/~27/~38/~61/~190, **not admission-ready precision**. Digitize D/G first and store both raw D/G and reciprocal G/D, along with calibration/sensitivity. No SD or n is stated here. M p.11 defines the Raman ratio used for crystallite size as the **integrated** D/G band intensity ratio; the SI caption uses peak-intensity wording. Preserve this wording difference. A numerical excitation wavelength was not located in the inspected methods; do not infer it from crystallite size. Near-zero D makes the reciprocal especially sensitive to digitization/background treatment. Do not infer Raman n=3 from mechanical captions.

**Raman thermal series, S Fig.37c, PDF p.44 / printed p.43.** UrDGOF, UrDGF-200, UrDGF-1600 and UrDGF-2800 also have graphically reported D/G, visually about 1.04, 0.82, 0.07 and near 0.005. These remain unextracted; do not publish reciprocals from this visual approximation, particularly the near-zero endpoint. They can accompany the corresponding thermal-state diameter/density records after explicit state reconciliation. They must not be mistaken for the six-point drawing series.

## Additional omitted qualifications

**P2: comparison-panel alternatives are not yet recorded in the packet.** W14 `E.D.Fig.6e!E3:F7`, header `High drawing`, supplies (T GPa, E GPa) pairs **(0.43,23.8), (2.6,296), (3.8,578), (4.6,822), (5.5,960)**. Published M p.19 panel e compares this work and previous works. These pairs differ from the primary draw-series summaries, not just the known Table3 endpoint 960/963 issue; in particular 822 versus 852 GPa and 5.5 versus 5.89 GPa cannot be dismissed as ordinary displayed rounding. The comparison sheet does not label each row by draw ratio or provide SD/n. Add a held source-alternative/qualification with exact sheet range and pairs. Retain the explicitly draw-labelled mean/SD series as the admission basis; do not import five new observations, silently map every comparison row to a draw ratio, or overwrite the original series.

**P2 metadata: reciprocal-density statistic.** All five currently public specific-volume values are correctly marked derived, but inherit `statistic_type=mean`. Their actual definition is reciprocal of reported cohort mean density, not mean specimen specific volume. Add explicit reciprocal-mean metadata and density locator. This is a statistic/source qualification, not a missing sixth property or a reason to delete specific volume.

**Already qualified, not new omissions:** SI Table3 uses endpoint 5.9 GPa, 963 GPa and 1.35 MS/m; the main text also uses rounded/variant endpoint values. The source draw-1 E SD exceeds its mean. Thermal methods print approximately 10^4 Pa while calling the environment high vacuum. Existing qualifications should survive and propagate to derived metrics. No alternative endpoint should substitute into only one ratio to improve apparent performance.

## Gauge and material-state boundaries

W14 `E.D.Fig.6b!A2:E6`, M p.19 panel b: gauge 25/20/15/10/5 mm; T 4.02/4.21/4.65/5.24/5.89 GPa; E 812/856/899/935/960 GPa, all mean +/- SD with n=3 technical specimens. These five cohorts are already present. Their 5 mm endpoint has different SDs from the drawing series (T 0.20 versus 0.14 GPa; E 25 versus 55 GPa). Keep separate measurement-set identities. No gauge-specific density, diameter, Raman, electrical or thermal values were identified. **Do not fill these cells or normalize gauge mechanics by copying draw-10 rho.**

Exclude false substitutions: MOESM9 `Fig.3f` liquid/gel-thread diameters and the 250 micrometre spinneret are not final-fibre diameters; liquid-thread extensibility is not final-fibre breaking strain; MOESM13 ridge density is not mass density. SI Fig.56 (PDF p.63) carbon-carbon rods contain multiple filaments and added GO-derived matrix, not the neat individual fibre. Reference graphite calibration, composite TIMs, MXene examples and other papers in comparison tables must not populate the five graphitized-graphene drawing records.

## Integration order and checks

1. **Ready now:** add the 20 explicit method-dependent ratios to the five existing draw states; preserve input provenance, null derived SD/n and all source qualifications. This would change the packet from 35 to **55 explicit metrics**, and the current public count from 40 to **60** if reciprocal density remains automatically projected. It adds no independent observations or records.
2. **Before claiming exhaustive source extraction:** digitize the diameter/thermal-density and Raman series, including Raman-only draw 2 and separate GOF precursor states. Means/SD for Fig.38 must not be replaced by visual approximations above.
3. **Conditional, not hidden absence:** retain exact typical-curve strain endpoints and derived endpoint energies, with explicit measurement definitions and fracture-termination assumption if admitted to breaking-strain/work fields.
4. Add the comparison-panel source alternatives and correct reciprocal-mean statistic metadata. No further acquisition is required for these corrections.

Checks performed: direct PDF text and figure inspection; workbook sheet/unit/range inspection; packet and public-row membership/counts; source and snapshot SHA256; Decimal curve integration; independently coded Python/JavaScript ratio arithmetic. No builder, release pipeline or production mutation was run. Numerical source-curve endpoints and derived ratios are reported exactly or reproducibly rounded; graphical targets remain explicitly unextracted. This bounded audit does not certify absent quantities beyond the inspected main/SI/seven-workbook archive.

## Completed graphical extraction

New reproducible extractor: `/Users/gsharma/Documents/Review Paper Database/scripts/extract_liu_omitted_figures.py`. Output: `/Users/gsharma/Documents/Review Paper Database/outputs/fiber_discovery_20261022/graphene_draw_audit/omitted_figure_values.json`. Only this script, JSON and audit report are owned by this follow-on. Generator, curated packets, tests and public data remain untouched.

Run: `env PYTHONDONTWRITEBYTECODE=1 python3 scripts/extract_liu_omitted_figures.py --crops-reviewed`. The reviewed flag is appropriate only after inspection of the source and calibrated crops. Native raster images are joined without interpolation; quantitative positions are fitted from actual ring pixels. PDF image xrefs, native dimensions, strip-to-PDF mappings, tick ROIs, fitted coefficients/residuals, marker coordinates, cap coordinates and source hashes are retained in JSON. Temporary inspection crops are outside the project tree; their paths/hashes are in each figure's `visual_crop`.

### Final join and admission dispositions

**Retain all four Fig.38e diameter-density pairs as separate named source measurement sets.** An initial provisional recommendation to retain endpoint density only as an alternative was revised: source identity is unresolved, and discarding a reported endpoint would create artificial missingness. Neither the text nor Fig.38 establishes that its endpoint specimens were reused in Fig.36. The policy is the same as for separately reported gauge-series measurements: preserve the values, qualify possible overlap, and do not claim independent populations or sum n across overlapping sets. This does not justify copying thermal diameter into a draw/gauge record.

| JSON path | Canonical property / join | Final disposition |
|---|---|---|
| `raman_drawing.records[].g_d.value_canonical` | `g_d_ratio`; join by the row's exact `curated_state_id` | Append only Raman to existing `DOI|draw-1`, `draw-4`, `draw-6`, `draw-8`, `draw-10`; create `DOI|draw-2` with Raman only. |
| `raman_drawing.records[].raw_d_g` | Original plotted D/G, no CPT G:D substitution | Preserve in derivation inputs, with raw digitized value and its coordinate sensitivity. Do not assign an SD or n. |
| `thermal_summary.records[].measurements.diameter` | `diameter_m` from `value_canonical` | Four new `DOI|thermal-summary-urdgof`, `thermal-summary-urdgf-200`, `thermal-summary-urdgf-1600`, `thermal-summary-urdgf-2800` states. |
| `thermal_summary.records[].measurements.density` | `density_kg_m3` from `value_canonical` | Admit **all four** alongside their thermal-state diameter. `source_series_key=DOI|SI.Fig38e`; unique `measurement_set_id` per named state. No density held. |
| `precursor_density.records[].density` | `density_kg_m3` from `value_canonical` | Five new `DOI|precursor-gof-draw-1/4/6/8/10` states, not final GFs. No borrowed T/E/sigma/kappa/Raman. |

Here `DOI` means the full literal `10.1038/s41563-026-02733-0`, as stored in JSON. Thermal UrDGOF `possible_overlap` points to `DOI|precursor-gof-draw-10`; thermal UrDGF-2800 points to `DOI|draw-10`. Both have `overlap_resolution=unresolved_no_source_proof_of_reused_specimens`, `independent_population_confirmed=false`, and a counting-policy note. The intermediate thermal states remain distinct, with no inferred draw ratio. All property joins use the source measurement set, not an assumed identical filament.

Retain per-measurement raw unit/value, canonical factor/value, source SD/n where given, figure locator and source SHA256. Put `source_series_key`, `measurement_set_id`, overlap links and independence qualification into metadata and record notes so public projection cannot silently discard the distinction. Preserve the existing AI-only review status and `single_source_row_unverified` linkage.

### Calibrated Raman values

S PDF p.54 / printed p.53, Fig.47b, blue circular markers. Values are raster-digitized, not exact source-table numbers. The last column is reciprocal coordinate sensitivity, **not** experimental uncertainty or a confidence interval.

| Draw | Raw D/G | Derived G/D | G/D coordinate-sensitivity interval |
|---|---:|---:|---:|
| 1 | 0.0410514745 | 24.359661 | 24.316187 to 24.403291 |
| 2 | 0.0391634594 | 25.534006 | 25.486397 to 25.581793 |
| 4 | 0.0373446773 | 26.777578 | 26.724786 to 26.830578 |
| 6 | 0.0261452534 | 38.247860 | 38.141377 to 38.354940 |
| 8 | 0.0168483900 | 59.352852 | 59.095449 to 59.612507 |
| 10 | 0.0052333957 | 191.080525 | 188.420827 to 193.816386 |

Calibration in native image pixels: D/G = `-4.5454432757604724e-5 * y + 0.04694993318198383`; five labelled y ticks; maximum residual 2.73e-5 in D/G (0.601 native pixel). X tick fit independently confirms draws 1/2/4/6/8/10. Raw D/G sensitivity is approximately +/-7.30e-5 to +/-7.39e-5, combining one native pixel, segmentation-threshold centre variation and maximum tick-fit residual. Reciprocal bounds use `1/(D/G + sensitivity)` and `1/(D/G - sensitivity)`, not a symmetric invented SD. None crosses zero or exceeds the declared 5% relative reciprocal-sensitivity flag. Experimental SD/n remain unreported. Near-zero D still makes draw 10 the least precise reciprocal.

### Calibrated thermal-state values

S PDF p.45 / printed p.44, Fig.38e. All +/- values below are extracted **source SD**, n=3 independent technical replicates; coordinate sensitivity is separately stored.

| Named state | Diameter (micrometres), mean +/- SD | Density (g/cm^3), mean +/- SD |
|---|---:|---:|
| UrDGOF | 17.103302 +/- 0.328084 | 1.429793 +/- 0.030596 |
| UrDGF-200 | 11.301704 +/- 0.299031 | 1.599592 +/- 0.021293 |
| UrDGF-1600 | 9.603110 +/- 0.205463 | 1.800083 +/- 0.015629 |
| UrDGF-2800 | 8.300147 +/- 0.159856 | 2.050417 +/- 0.013013 |

Diameter fit: `-0.016343658198890467 * y + 46.71424292127789`, using six labelled ticks. Density fit: `-0.0012269938650306758 * y + 4.280981595092027`, using five labelled right-axis ticks. Maximum residuals: 0.00639 micrometres and effectively zero g/cm^3. Mean coordinate sensitivities are about 0.0232-0.0244 micrometres and 0.00125-0.00133 g/cm^3. Separate SD digitization sensitivities are about 0.0391 micrometres and 0.00245 g/cm^3.

The final diameter SD is flagged `resolution_limited_sd=true` because its coordinate sensitivity exceeds 20% of the extracted SD; the mean is well resolved and admission remains appropriate with that precision qualification. The 200 C overlapped markers were separated by colour-ring fitting and distinct achromatic cap locations, then visually checked. No SD is inferred from ring diameter. Previous visual estimates 11.2/9.5/8.2 micrometres are superseded by the calibrated 11.30/9.60/8.30 values.

### Calibrated precursor density

S PDF p.43 / printed p.42, Fig.36, grey GOFs diamonds, not red GFs-2800 circles. Actual vector path indices 24-28 and individual error caps are recorded; eight y ticks and six x ticks calibrate the extraction. Mean +/- SD in g/cm^3, n=3 technical replicates:

| Draw | GOF density |
|---|---:|
| 1 | 0.830161 +/- 0.011066 |
| 4 | 1.130030 +/- 0.025653 |
| 6 | 1.240169 +/- 0.021455 |
| 8 | 1.329955 +/- 0.015477 |
| 10 | 1.429918 +/- 0.012827 |

Coordinate sensitivity is +/-0.002765 g/cm^3, comprising half a PDF point plus the maximum y-fit residual. It is not added to experimental SD. In particular, the earlier visual draw-6 estimate of 1.25 is superseded by approximately 1.24017 g/cm^3.

### Completed checks

All three source/calibration crops inspected. Expected source SHA256 verified; x labels, circle fits under three segmentation thresholds, SD cap symmetry, positive reciprocal intervals and distinct state keys checked. Independent two-tick Raman calibration agrees within the declared sensitivity envelope. JSON status is `source_extracted_crops_reviewed_pending_parent_admission`; `checks.rendered_crops_visually_reviewed=true`. **No graphical-extraction blocker remains.** The figure output supplies 19 CPT values (6 G/D, 8 thermal diameter/density, 5 precursor density), plus six retained raw D/G inputs; it makes no new claim of independent specimen populations.
