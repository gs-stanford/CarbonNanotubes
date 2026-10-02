# Reviewed data and reference benchmarks for v1

## Returned validation workbook

Input: `cnt_atlas_human_validation.xlsx`, returned 2026-10-01. The input workbook is not modified or published by the importer. Its SHA256 and the original extraction-table SHA256 are retained in `data/curation/human_validated_records.json`.

Of 394 new measurement candidates:

- 179 are marked valid, 208 invalid, and 7 need review.
- 136 quantitative measurements are admitted across 70 source-row records.
- 4 approved specimen-length/maximum-operating-temperature entries are retained as context, not misrepresented as gauge length or measurement temperature.
- 1 approved diameter is qualitative ("tens of micrometres") and is not made into a numerical point.
- 38 valid-marked entries still say primary source not opened and duplicate review unreviewed. They remain held; a valid checkbox alone does not establish completed source review.

Five edited reported values override their original extraction values. The importer recomputes from the reported expression and unit rather than trusting the normalized workbook column. In particular, 842.6 MPa becomes 0.8426 GPa, not the stale 0.8642 GPa. A previously negative parse of the `1.3-1.5 +/- 0.2 g/cm3` density expression is corrected to a positive range with midpoint 1400 kg/m3.

Intervals retain their endpoints and a `range_midpoint` qualifier. Range half-widths are encoded as range uncertainties, never standard deviations. Explicit reported +/- uncertainties remain unclassified unless their type is specified. A source table row is not independently verified same-specimen linkage; these rows remain qualified accordingly. Multi-source review rows retain all DOI identities and are not described as a single experimentally paired specimen.

The canonical JSON is the durable release input. Review decisions and the original reported values, notes and locators remain auditable; the website does not require the Excel file at runtime.

## Added reference benchmarks

Five solid-metal references at **293 K (19.85 C)**: Na, Ca, Li, K and Mg. Density and total electrical resistivity come from Chi's evaluated reference publications, DOI `10.1063/1.555598` and `10.1063/1.555599`, hosted by NIST:

- [Alkali elements: Tables 1, 3, 10 and 17](https://srd.nist.gov/jpcrdreprint/1.555598.pdf).
- [Alkaline-earth elements: Tables 1, 6 and 9](https://srd.nist.gov/jpcrdreprint/1.555599.pdf).

Conductivity is calculated as the reciprocal of resistivity, then divided by reference density for specific conductivity. Every input and formula is retained. The density constants were not critically evaluated in those publications and are not measurements on the electrical specimens. Electrical purity does not automatically specify density purity. These are contextual physical references, not recommendations for safe, commercially practical or load-bearing conductors. No tensile strengths are invented. The estimated calcium thermal-conductivity value and mismatched-temperature thermal data are not admitted as measured 293 K properties.

Seven new manufacturer grade references:

- Toray T1200 and M40X from the [official product selector](https://toray-cfe.com/en/products/torayca-carbon-fibers/product-selector/).
- [HexTow IM11](https://www.hexcel.com/wp-content/uploads/2026/02/IM11_HexTow_DataSheet.pdf) and [IM9](https://www.hexcel.com/wp-content/uploads/2025/12/IM9_HexTow_DataSheet.pdf).
- Toray [M55J 6K](https://www.toraycma.com/wp-content/uploads/M55J-Data-Sheet.pdf) and [M46J 6K](https://www.toraycma.com/wp-content/uploads/M46J-Data-Sheet.pdf), including their separately tabulated grade-level electrical and thermal reference properties.
- [Spectra S-1000, 75-denier](https://prod-edam.honeywell.com/content/dam/honeywell-edam/pmt/oneam/en-us/high-performance-fibers/documents/honeywell-SpectraFiber-PhysicalProperties-chart.pdf), an archival nominal yarn benchmark, not proof of current product availability.

Existing T1100G/T1000G/M60J/T800S, IM7, Zylon, Kevlar, Twaron, Technora and SK99 records were not duplicated. SK78 remains held for an incomplete official grade-specific property table. Differences between current and historical IM7/T1100G sheets are recorded in the research receipt, not silently overwritten.

The display label is **Modulus**. The API key `initial_modulus` is retained for compatibility; it is a legacy storage key, not a guarantee of an initial-tangent measurement. Source-defined tensile/chord/Young's modulus definitions and methods are retained. Manufacturer nominal properties are not same-specimen measurements or guaranteed minima, and different modulus methods are not asserted equivalent. Composite laminate tables adjacent to fiber tables are excluded.

## Classification and citation repairs

- The Elliott workbook's explicit material category now takes priority over notes about gold electrodes, copper reference materials or buckypaper. Raw measurements remain unchanged.
- Human-reviewed different-specimen decisions prevent automatic cross-source duplicate collapse.
- Semicolons separating DOI citations are not incorporated into DOI identities. Public publication DOI uniqueness is checked before PostgreSQL import.
- The article `10.1038/ncomms4754` has no material name in its title; its [abstract](https://pmc.ncbi.nlm.nih.gov/articles/PMC4024741/) explicitly identifies graphene/CNT core-sheath fibers. The title-keyword audit has a source-specific exception, not a blanket bypass for reviewed records.
- Default year filters and trend axes cover the actual release range, so the 1979 physical-reference papers are not silently excluded or plotted outside the axis.
- An untouched full-range date control retains undated manufacturer sheets. An explicitly narrowed date filter excludes unknown dates; trend plots still require a reported year. Retrieval date is never substituted for publication date.
- Metal-symbol recognition does not mistake the temperature unit in "293 K" for potassium. High-value axis ticks retain enough precision to distinguish 15,000 from 20,000.

## Rebuild and validation

Use the project's Python environment and Node dependencies:

```sh
.venv/bin/python scripts/import_human_validation.py /path/to/cnt_atlas_human_validation.xlsx
.venv/bin/python scripts/build_reference_benchmarks.py
.venv/bin/python scripts/test_curated_import.py
.venv/bin/python scripts/build_combined_database.py
.venv/bin/python scripts/validate_publications.py
.venv/bin/python scripts/validate_public_release.py
```

Normal release rebuilds use the checked-in curated JSON and DOI cache; they do not require rerunning Excel import or accessing source PDFs. Re-ingestion uses the checked-in original candidate table. Source facts are in `data/curation/reference_benchmark_sources.json`; edit/admit source-checked facts there, then rebuild. Do not attach another grade's density, a composite's strength, or an assumed temperature.

```sh
cd web
npm ci
npm run db:validate-public-files
npm run db:test-public-import
npm run db:migrate
npm run db:import-public
npm run db:verify-public
NODE_USE_ENV_PROXY=0 CPT_TEST_URL=http://localhost:3012 node scripts/test-v1-data-release.mjs
```

Render's established startup migrates and transactionally imports the bundled release. The import is idempotent and the active release is verified by `/api/v1/release`. This update is deployed from an isolated data-release branch, excluding unfinished research-assistant work.

## Candidate verification results

The candidate contains **1,447 records, 5,569 measurements and 320 publications**. Its PostgreSQL manifest is `public-v0-eb72da7181872ba9`, with source hash `eb72da7181872ba98c86c3896fd1cd4953e32c1d5bedc3b47508f6a58f668fe5`.

- All 12 focused Python import/conversion/source-metadata tests pass.
- Strict public-data audit: zero errors; one warning covering 684 legacy density-derived measurements with unreported density convention. They remain exploratory.
- PostgreSQL-compatible PGlite migration, exact payload parity, repeated import, legacy-placeholder replacement and curator visibility gates pass. This is a local PostgreSQL-compatible test, not yet proof of the deployed Render import.
- The bounded public API regression and performance-cutoff regression pass, including temporary samples, units, citations and disclosure limits.
- All 272 property/figure requests checked: 264 supported figures pass; eight combinations correctly have no paired measurements. SVG callout bounds use the exported font size and text-anchor alignment. SVG/PNG/PDF export signatures and temporary-point ranks pass.
- Focused benchmark checks independently recompute Na, Ca, Li, K and Mg specific conductivity from source resistivity and density, check T1200 and IM11, preserve DOI lookup disclosure limits, and confirm that the new metals do not acquire invented tensile strengths.
- TypeScript and the isolated Next.js production build pass.
- Browser inspection confirms historical references are visible after selecting Density versus Specific electrical conductivity, and sodium's source, temperature and values can be inspected. Commercial source-class filtering remains available for manufacturer grades.

The focused verification script writes its measured results and metal comparison exports under `reports/v1_data_release_verification/`. Test-only storage without PostgreSQL correctly rejects public submissions in production with HTTP 503; this does not relax the curator gate on the deployed database.

## Remaining limitations

Missing conditions, specimen linkage and source uncertainty remain missing, not inferred. The release preserves comparability warnings; review approval is not a claim that every material or measurement method is interchangeable. No complete literature-corpus review, assistant training or production-readiness guarantee is made by this data release.

The production dependency patches and regression checks are recorded in `docs/V1_SECURITY_UPDATE.md`. Next.js, sharp and baseline-browser-mapping are updated in the deployment lockfile; full and production-only npm audits report zero known vulnerabilities at the time of the check. This is not a security guarantee or an independent penetration test. Unfinished research-assistant and manuscript changes remain outside this deployment.
