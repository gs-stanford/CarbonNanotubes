# v1 dependency security update

Checked 2026-10-02. Scope: the deployed CPT website and its existing public database, not the unfinished local research assistant.

## Patched dependencies

| Package | Previous deployed version | Patched lockfile version |
| --- | --- | --- |
| Next.js | 16.3.1 | 16.3.8 |
| sharp | 0.35.3 | 0.35.5 |
| baseline-browser-mapping | 2.10.37 | 2.11.27 |

Next.js remains explicitly pinned. Its matching compiler/environment packages and sharp's platform binaries are updated together. The browser-mapping update is within Next.js's supported dependency range. No unrelated direct dependency is upgraded and no force/major-version audit fix is used.

Official patch references: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8), [sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), [browser-mapping advisory](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv).

Both `npm audit --json` and `npm audit --omit=dev --json` return zero known vulnerabilities after a clean `npm ci`. This is an advisory check at a particular time, not proof of freedom from all vulnerabilities or a penetration test. Advisory monitoring and future patching remain necessary.

## Database preservation

The security update does not rebuild or modify scientific source data. It retains:

- Release: `public-v0-eb72da7181872ba9`.
- Source SHA256: `eb72da7181872ba98c86c3896fd1cd4953e32c1d5bedc3b47508f6a58f668fe5`.
- 1,447 records, 5,569 measurements and 320 publications.
- 70 admitted human-reviewed source-row records and 12 new sourced reference benchmarks.

The 38 valid-marked workbook entries lacking completed source/duplicate review remain held. Missing specimen linkage and measurement conditions are not filled in by this software patch. The data audit still reports one warning covering 684 legacy density-derived measurements with unreported density convention; there are zero release-blocking audit errors.

## Completed pre-deployment checks

- Clean dependency installation, TypeScript check and Next.js production build.
- All 12 focused Python import/conversion/source-metadata tests.
- Exact public-file manifest validation, PostgreSQL-compatible PGlite migration/import parity, repeated import, legacy-placeholder replacement and curator visibility gates.
- All 272 property/figure requests: 264 supported figures and eight correctly empty combinations.
- Temporary sample ranking, source citations and SVG/PNG/vector-PDF export checks.
- Independent metal resistivity/density calculations and commercial T1200/IM11 benchmark checks.
- Bounded API access, DOI/search disclosure limits, release health metadata and input validation.
- Unauthenticated admin/list/review/cleanup rejection and malformed/invalid-DOI submission rejection. No production scientific record is inserted or approved by these checks.
- Property cutoffs, inclusive boundaries, empty cohorts and export behavior.
- Actual rendered SVG callout bounds: 166 points and 15 clear callouts across the focused layout cases; longest leader 14.4 px.
- Desktop/mobile UI, callout toggles, cutoff clearing, single SVG download, four-figure ZIP contents and no horizontal mobile overflow. No browser page errors were observed.

Local verification used macOS arm64 and Node 25.9.0. The existing Render service remains configured for Node 22; its actual deployed runtime is checked through live route and export regressions rather than assumed from the local build.

## Reproduction and deployment verification

Run from `web` with the locked dependencies:

```sh
npm ci
npm audit --json
npm audit --omit=dev --json
npm run typecheck
npm run build
npm run db:validate-public-files
npm run db:test-public-import
PORT=3012 npm run start
```

Against the local production server, in another terminal:

```sh
CPT_TEST_URL=http://localhost:3012 npm run test:all-figures
CPT_TEST_URL=http://localhost:3012 npm run test:api-v1
CPT_TEST_URL=http://localhost:3012 npm run test:requirements
CPT_TEST_URL=http://localhost:3012 npm run test:figure-selection
CPT_TEST_URL=http://localhost:3012 CPT_QA_DIR=/tmp/cpt-security-ui npm run test:requirements-ui
CPT_TEST_URL=http://localhost:3012 CPT_RELEASE_TEST_OUTPUT=/tmp/cpt-security-benchmarks node scripts/test-v1-data-release.mjs
```

The exhaustive figure suite intentionally approaches the normal per-process hourly limit. Restart only the local test server before further suites when necessary; do not disable production rate limits.

Render's established startup migrates and idempotently imports the same bundled release. `/api/health/data` now reports `build.commit` from Render and `build.next_version` from the actual installed Next.js package, alongside its existing database count-parity check. Verify both the software identity and `/api/v1/release` after deployment. A matching data hash alone cannot prove that a software patch has reached Render.

```sh
CPT_TEST_URL=https://carbonnanotubes.onrender.com CPT_EXPECTED_COMMIT=<deployed-commit-sha> npm run test:api-v1
CPT_TEST_URL=https://carbonnanotubes.onrender.com CPT_RELEASE_TEST_OUTPUT=/tmp/cpt-security-live-benchmarks node scripts/test-v1-data-release.mjs
```

The public health metadata exposes no credentials. Successful production submission/approval is not simulated by inserting test data into the live database; curator visibility behavior is tested independently against PGlite.
