# Li / Jin Omission Audit

2026-10-22. Scope: only the Li and Jin primary packets and admission tests. No global build, database/export write, commit, or push. Source-reported method-dependent values are usable with qualifications; absent geometry does not invalidate a directly reported area- or mass-normalized measurement. It does prevent an unsupported conversion between those bases.

## Sources Inspected

- Li main: `outputs/fiber_discovery_20261022/li_trajectory/article.pdf`, 10 pages, DOI [10.1021/acsnano.5c14235](https://doi.org/10.1021/acsnano.5c14235); SHA256 `5a13f637332e1ddd0b0a23f8d45a93f3dab984bd79128ea570f210bbc30514fb`.
- Li [official SI](https://ndownloader.figshare.com/files/60576748): local `outputs/fiber_discovery_20261022/li_trajectory/nn5c14235_si_001.pdf`, 34 pages; SHA256 `de115d028147a135a7b9d54a04c9def2f85892a6dfaaf61835d9ee8435d85c9f`. Read methods, captions and tables; visually checked Tables S2-S5 pp.26-29, Raman Fig.S2 p.6, and constituent geometry Fig.S1 p.5. Main PDF page 5 is journal p.597; page 7 is journal p.599.
- Jin [official SI](https://ndownloader.figshare.com/files/65000164): local `outputs/fiber_discovery_20261022/jin_audit/an6c00845_si_001.pdf`, 21 pages; SHA256 `aab9d28a22872337bff30fb6e2b6f50587f6268837a9c4b08f8d0318236741f0`. Rechecked the actual PDF table and existing renders; methods pp.S6-S7, Table S2 p.S14, specimen distinctions pp.S11-S12/S15-S17, composition pp.S9/S20.
- Gap: no Jin main-text PDF located by DOI/title-related filename in the workspace or Downloads. The historical acquisition audit records publisher restrictions; these were not retested. Thus SI completeness is verified, not whole-paper completeness. No new literature search was performed.

## Changes

Li had two unambiguously supported concentration controls omitted from its five-state trajectory packet. Added these as **mechanical-only** records, not alternative-normalization copies:

| Table S2 p.26 cohort | New record ID | Strength GPa, mean +/- SD; printed 95% CI | Modulus GPa, mean +/- SD; printed 95% CI |
| --- | --- | --- | --- |
| 0.05 wt%-PIPD/CSA-CNTFs | rec_30f67a0fa750 | 5.54 +/- 0.22; 5.20-5.88 | 129.36 +/- 10.58; 112.53-146.19 |
| 0.2 wt%-PIPD/CSA-CNTFs | rec_534d0cc1e324 | 5.66 +/- 0.12; 5.49-5.84 | 130.90 +/- 8.06; 118.08-143.72 |

Canonical conversion is GPa x 1e9 to Pa for means, SDs and CI endpoints. Mechanical n remains a minimum of four, not exact four. Each new state has its own stable curated-state ID. Electrical values from the selected 0.1 wt% PIPD cohort are **not** transferred to these controls. Repeated CSA and 0.1 wt% rows in Table S2 are already represented by Table S5 and are not duplicated.

- Li packet: **5 -> 7 records; 15 -> 19 canonical measurements**. Original five IDs, all original 15 values and their measurement metadata preserved.
- Li: now retains seven cohort-linked volumetric toughness measurements in `context_measurements`, with source mean, SD, printed CI, conversion to J/m^3, method and minimum n. These remain valid measurements even though the current canonical schema has no volumetric-toughness field.
- Li: retains exact WAXS orientation factors 0.650/0.900/0.918/0.927/0.922 for the five trajectory states (main p.5, Fig.2k), Table S1 elemental percentages for the three PIPD concentration states (SI p.25), and constituent CNT geometry in provenance. None is repurposed as bulk density or retained PIPD mass fraction.
- Li: retains CL-PIPD impact energy **1.26 +/- 0.04 MJ/kg**, impact velocity **497.37 +/- 25.34 m/s**, as distinct dynamic context (Table S7 p.31; main p.6). The table does not independently define the +/- statistic; marked unspecified, not assumed SD. Not assigned to D-CL or tensile work of rupture.
- Li: preserved all numeric S3/S4 alternatives in provenance, including means, SDs and printed CI endpoints; not silently substituted for Table S5 optimized states.
- Jin: **8 records / 48 canonical measurements unchanged**; all 48 means and 48 SDs in Table S2 are already admitted. Added explicit omission/source-gap and normalization dispositions. No reported fiber-table metric was excluded merely because the normalization method is incompletely documented.

## Canonical Field Dispositions

"Absent" below means absent as a usable numeric value in the inspected sources, not a claim about inaccessible Jin main text.

| CPT field | Li disposition and source | Jin disposition and source |
| --- | --- | --- |
| Tensile strength | Retain five Table S5 values, p.29; add two Table S2 controls, p.26 | Raw stress held: Table S2 p.S14 reports specific strength; no fiber density or numeric area for conversion |
| Initial modulus | Retain five Table S5 values; add two Table S2 controls | Raw modulus held: cN/tex is specific modulus, not Pa |
| Electrical conductivity | Retain five directly reported Table S5 values, despite unknown exact electrical area/span/n; new controls have none | Raw conductivity held: only specific electrical fiber values verified; do not multiply by unrelated paper density |
| Thermal conductivity | No primary fiber value recovered; cited comparator articles are not this paper's measurements | Retain all eight Table S2 absolute values, W/m/K; method qualifications do not justify deleting them |
| Specific strength | No reported value or cohort density for conversion | Retain all eight Table S2 values, cN/tex x 1e4 to N m/kg |
| Specific modulus | No reported value or cohort density for conversion | Retain all eight Table S2 values, cN/tex x 1e4 to N m/kg |
| Specific electrical conductivity | No reported value or cohort density for conversion | Retain all eight Table S2 values; SI heading lacks unit, prior official abstract resolves S m^2/kg. Exact mass-normalization convention unresolved, not grounds for inventing raw sigma |
| Specific thermal conductivity | No primary thermal value or density | Held: no fiber density to normalize absolute thermal conductivity |
| Breaking strain | Methods p.2 names elongation, but no numeric column in S2-S5; representative curves are not a mean/SD table. No automatic strength/modulus estimate or unqualified digitization | Retain all eight Table S2 elongations and SDs; percent / 100 |
| Linear density | No numeric cohort tex or mass/length recovered | Retain all eight Table S2 tex values and SDs, x 1e-6 to kg/m; measurement-specific replicate count unknown |
| Density | No numeric cohort fiber density; SEM/SAXS densification evidence is not a density measurement | No numeric eight-state fiber density; Fig.S4 p.S12 density 1.107 g/cm^3 belongs to paper |
| Specific volume | No density; no reciprocal fabricated | No fiber density; no reciprocal fabricated |
| Diameter | Numeric intact fiber diameter/area absent. Fig.S1 p.5 reports constituent CNT diameter 9.9 +/- 4.1 nm and wall number 5.5 +/- 2.5; retained as context, not bulk fiber diameter. Microbullet/foil dimensions are not fiber dimensions | Surface/fracture images pp.S15-S16 do not provide a directly reported statewise intact fiber diameter/area. Optical/SEM area method pp.S6-S7 retained; no unverified geometry estimate |
| Work of rupture (J/kg) | Hold mass-specific conversion. Direct volumetric toughness is supported context, not discarded or mislabeled; no density for J/kg conversion | No numeric tensile rupture work reported in inspected fiber table; no invented curve integral |
| Ampacity | No numeric primary ampacity recovered | Not in inspected SI fiber table/methods |
| Raman G/D ratio | Fig.S2(b) p.6 spectrum has no printed numeric ratio; no arbitrary peak-height digitization. Raman wavelength 532 nm and strain-induced shifts are not G/D | No verified statewise numeric G/D ratio in inspected SI; no powder-to-fiber assignment |

### Valid Context, Not Missing Canonical Data

Li volumetric toughness, MJ/m^3, mean +/- SD (Tables S5/S2): FCNTFs 40.32 +/- 3.60; CSA 143.06 +/- 6.36; PIPD 165.93 +/- 11.32; CL-PIPD 149.47 +/- 10.36; D-CL-PIPD 238.42 +/- 14.78; 0.05 wt% control 160.12 +/- 14.42; 0.2 wt% control 151.13 +/- 11.63. Printed CIs are preserved literally, including asymmetry. They are not recomputed to infer n. Current loader retains context in raw provenance, not canonical public measurement rows; exposing these as a new public metric requires parent-owned schema work.

Li S3/S4 remains a **source inconsistency**, not a rejection for uncertain area alone: main p.4 calls these the CL-PIPD optimization series, but printed tables label H3BO3-CNTFs and peak at 5.56 +/- 0.05 GPa / 160.75 +/- 13.13 GPa, whereas optimized Table S5 CL-PIPD is 6.36 +/- 0.12 GPa / 167.63 +/- 5.60 GPa. S3 row 2 and S4 12 h repeat the same mechanical statistics. All six non-CSA printed rows are now numerically retained in `reported_alternatives`, without resolving their PIPD/base identity, duplicating the repeated optimum, or attaching Table S5 transport. The main's conductivity narrative multipliers also remain nonmeasurement text; direct S5 scalars are used.

Jin paper values (Fig.S4 p.S12: 909.2 S/cm, 1.107 g/cm^3, 26.92 W/m/K) are a **different specimen form**, not alternative normalizations of fibers. XPS Table S1 p.S9 and TGA feeding ratios Fig.S10 p.S20 do not provide state-resolved final fiber composition. Neither supports density-based fiber conversions. Lack of matched composition/geometry limits causal comparison, not the admission of the six directly reported fiber properties.

## Methods, Counts And Uncertainty

- Li SI p.2: Shimadzu EZ-LX, 5 N load-cell capacity, 1 mm/min, 10-mm-long fibers, per-fiber cross-sectional SEM/ImageJ area, near-clamp failures excluded; modulus initial slope over 0.1-0.5% strain; at least four valid mechanical tests. Numeric area, independent gauge, exact n, test temperature and atmosphere remain unknown. SI p.4 four-point Keithley 2450 electrical method does not specify electrical n, voltage span or numeric area. These gaps are preserved without deleting directly reported values.
- Jin SI pp.S6-S7: FAVIMAT+, 25 mm mechanical gauge, 2 mm/min crosshead speed (not a strain rate in s^-1), 1-2 cN/tex pretension. All table +/- values are labeled SD; caption n >= 40 retained as a mechanical lower bound, not exact 40 or a separately verified transport replicate count. Optical/SEM area and CT structural methods are reported, but no eight-state numeric fiber density/area table.
- Jin thermal: DC self-heating/four-point thermoresistance, about 1e-6 Torr, rise <10 K; base temperature and transport span unknown. Vacuum suppresses convection, not radiation by itself. Thermal values remain admitted with that qualification; no automatic raw sigma-kappa pairing from specific electrical values.
- Shared named cohorts/source rows are not certified identical specimens. No density conversion from a different form, across-cohort transport join, or duplicated alternative-normalization point was introduced.

## Verification

Executed `python3 scripts/test_li_primary_admission.py` (11 tests) and `python3 scripts/test_jin_primary_admission.py` (6 tests). Both pass. Tests independently transcribe source numbers, compare the actual PDFs (Li added Table S2 rows; all 96 Jin mean/SD numbers), verify document hashes and unit conversions, exercise isolated packet loading/measurement generation and protect IDs, bounds, dimensional distinctions and transport exclusions. Combined packets: **15 cohorts / 67 canonical measurements**. Only Li contributes a canonical increment: **+2 cohorts / +4 measurements**.

Publication/source review remains AI-assisted, not human-adjudicated. Public release counts/hashes and discovery plots have **not** been regenerated by this task. The parent integration must rebuild and reverify them before any push.
