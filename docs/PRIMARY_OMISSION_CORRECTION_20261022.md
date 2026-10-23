# Primary-source omission correction, 22 October 2026

## Scope and cause

Re-audited all five primary-source packets added in commit `71e5eeb`, originally 48 records. This is not a claim that every historical CPT publication was reread. The specific failure was incomplete property extraction and overly broad withholding of usable normalization-dependent values. Source disagreements should remain attached to identifiable measurements, not make those measurements disappear.

The public release changes from **1,495 records / 5,711 property entries / 325 publications** to **1,519 / 5,817 / 325**. All previously published record IDs, measurement IDs, canonical values, units and reported/derived flags are preserved. The 106 additional property entries include calculated ratios and reciprocals; they are not 106 independent experimental observations.

| Paper | Records before / after | Property entries before / after | Correction |
|---|---:|---:|---|
| Sun, 10.1038/s41467-026-69498-7 | 19 / 19 | 30 / 60 | Density, diameter, tex, reported specific strength/conductivity, modulus, Raman, ampacity; calculated specific modulus and volume |
| Liu, 10.1038/s41563-026-02733-0 | 10 / 20 | 40 / 88 | Four density-normalized properties for five draw cohorts; six reciprocal Raman ratios; precursor densities and thermal-treatment diameter/density pairs |
| Li, 10.1021/acsnano.5c14235 | 5 / 7 | 15 / 19 | Two PIPD-concentration mechanical controls; additional noncanonical source context retained |
| Jin, 10.1021/acsanm.6c00845 | 8 / 8 | 48 / 48 | All eight fiber rows and six properties already present; source-gap and normalization audit added |
| Wang, 10.1038/s41467-026-75150-1 | 6 / 18 | 9 / 33 | Dose-series tenacities, tex, two thin-ribbon states, Raman and source-qualified geometry context |

## MoCl5 correction

The N/MoCl5 endpoint retains conductivity **27.34 MS/m** and gains **1,930 kg/m3** gradient-column density, **1.29 N/tex** SI-specific strength, **14.166 kS m2/kg** SI-specific conductivity, **11.30 micrometre** lateral diameter and **0.20 tex** linear density. It is now eligible for density/conductivity and normalized-property scatter plots.

SI Table 9 and Methods support the gradient density. Its alternative area-based density is 1.99 +/- 0.20 g/cm3. The main-text specific strength 1.26 +/- 0.07 conflicts with the SI/workbook 1.29 +/- 0.08; this difference remains disclosed. No alternatives are averaged or added as duplicate samples.

## Scientific boundaries

- Source hashes, exact table/cell/page locations, normalization methods, uncertainty conventions and original alternatives remain in the curated packets. The selected-record panel now exposes active-property qualifications in expandable **Measurement notes**.
- All new source review is explicitly AI-assisted, not human adjudication or proof of same-filament pairing. No strict-comparability certification is added.
- Liu specific properties are ratios of cohort means using sink-float density, not measured paired-filament specific properties. Input uncertainties are retained; a derived SD is not invented.
- Liu figure-only values retain calibrated coordinates and digitization sensitivity, separate from experimental SD. G:D is explicitly the reciprocal of plotted D:G. The final thermal-state diameter SD has resolution-limited precision.
- Liu thermal endpoints may overlap draw-series populations. Their source-labelled diameter/density pairs remain together; no mechanical/transport properties are borrowed, and population independence is not asserted.
- Sun's N-only summary cannot yet be assigned to the conflicting 5-minute/10-minute processing labels. Endpoint density is not copied to different dopants or timed checkpoints.
- Li has no recovered numeric cohort density. Jin's 1.107 g/cm3 density belongs to paper, not the fiber table; its main article was not available locally, so its audit covers the SI rather than certifying the entire article.
- Wang's umbrella density/electrical ranges lack state allocation; thermal results concern wide films, not the fiber tensile specimens. They remain sourced context rather than invented fiber pairs. The thin-strip 12.43 GPa entry is an explicitly calculated mean of four listed replicates; the authors' 12.5 GPa summary remains an unresolved alternative.
- Volumetric toughness, failure loads, constituent CNT dimensions and orientation factors are retained as context where CPT has no matching canonical property. They are not relabelled as mass-specific rupture work or fiber diameter.

## Checks and reproduction

The import now rejects unsupported primary field names and any value/metadata mismatch, instead of silently dropping a supplied property.

```sh
.venv/bin/python -m unittest discover -s scripts -p 'test_*primary_admission.py'
.venv/bin/python scripts/validate_public_release.py --skip-web-build
.venv/bin/python scripts/verify_primary_omission_correction.py
```

The omission verifier uses the archived baseline when available, otherwise reads `71e5eeb:data/public/*` from git. Source-reading tests need the archived article/SI/workbooks at their documented `outputs/fiber_discovery_20261022/*` paths. Private PDFs are not redistributed. The figure extraction script records official source URLs and SHA256 values; its `--crops-reviewed` flag must only be used after visually inspecting the generated calibration crops.

From `web`, run `npm run typecheck`, `npm run build`, and `npm run db:test-public-import`. Against a running server, use `CPT_TEST_URL=... node scripts/test-primary-data-release.mjs` and `CPT_TEST_URL=... npm run test:all-figures`.

Verification before deployment: **39 source/admission tests passed**, public integrity audit **0 errors**, PostgreSQL-compatible PGlite import **exact parity**, production build/typecheck passed. The complete figure test checked **272 requests: 268 supported figures and four correctly empty combinations** across 16 properties. SVG, PNG, PDF, citations, temporary samples and performance cutoffs passed. Measurement notes were inspected at desktop and 390-pixel mobile width with no horizontal overflow.

One pre-existing audit warning remains: 684 historical density-derived entries have an unreported density basis. This correction does not retroactively resolve those source conventions.

Per-paper audits, calibrated extraction metadata, before/after verification and local test receipts are in `reports/primary_omission_correction_20261022/`. Deployment is verified separately against the public release endpoint; a local test receipt alone is not evidence of deployment.
