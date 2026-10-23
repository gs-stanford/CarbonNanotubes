# Primary-source data release: 22 October 2026

## Scope

Adds 48 named configurations/measurement sets from five publications to the existing public database. Total: **1,495 records, 5,711 measurements, 325 publications** (previously 1,447 / 5,569 / 320).

| Publication | Configurations | Explicit measurements | Additional derivations |
|---|---:|---:|---:|
| [Li, ACS Nano](https://doi.org/10.1021/acsnano.5c14235) | 5 | 15 | 0 |
| [Sun, Nature Communications](https://doi.org/10.1038/s41467-026-69498-7) | 19 | 30 | 0 |
| [Liu, Nature Materials](https://doi.org/10.1038/s41563-026-02733-0) | 10 | 35 | 5 reciprocal specific volumes |
| [Jin, ACS Applied Nano Materials](https://doi.org/10.1021/acsanm.6c00845) | 8 | 48 | 0 |
| [Wang, Nature Communications](https://doi.org/10.1038/s41467-026-75150-1) | 6 | 9 | 0 |

The additions are **AI source-audited, not independently human-adjudicated**. Their review field is `ai_source_checked_not_human_adjudicated`; none is promoted to strict matched-specimen status. Publication-level peer review is not the same as validation of our extraction. Intermediate configurations are retained, not just paper maxima. Private articles/SI are not redistributed.

## Source safeguards

- Canonical units, original values, source document hashes, table/cell/figure locators, reported uncertainties and known replicate counts are retained in the packets and measurement export. Unknown exact n stays unknown; a lower bound is not converted to an exact count.
- Same named configuration is distinguished from the same measured filament. No cross-state conductivity or density is borrowed to fill missing pairs.
- Explicit configuration IDs prevent deduplication from collapsing different processing/gauge states merely because values are similar. Genuine repeated Sun controls are aliases; the ambiguous named N cohort is withheld.
- Liu's separate 5 mm gauge series is retained as mechanical-only data. Equal means do not establish identical repeat sets. Conflicting uncertainties/headline values remain qualified, including the published 38.1 +/- 67 GPa modulus.
- Sun's I2/CuI/FeCl3 processing temperatures differ. Those treatment conditions are preserved and are not measurement temperatures. Direct workbook/XML rechecking found that CuI SD is 0.09 MS/m in both workbook and article; an initial QA claim of a conflict was retracted, not added as a false uncertainty.
- Jin reports specific electrical conductivity, not raw electrical conductivity. No raw value is fabricated from another specimen's density.
- Wang's ribbon-like fibers are identified as such. Wide-film thermal measurements and group electrical ranges are not assigned to the fiber mechanical rows. Mean strengths are not replaced by the title's maximum.
- Liu's vector-digitized conductivity/density points carry extraction sensitivity separately from experimental SD. Sink-float density is not silently used to derive mass-specific mechanics or transport.
- Publisher-verified article numbers correct the two Nature Communications citations; original Crossref cache responses remain intact.

## Rebuild and verify

The committed JSON packets are the durable release inputs; rebuilding does not require private PDFs. Source-workbook tests require the private evidence archive and intentionally fail if it is absent.

```sh
.venv/bin/python scripts/validate_public_release.py --skip-web-build
.venv/bin/python scripts/test_recent_primary_admission.py
.venv/bin/python scripts/test_li_primary_admission.py
.venv/bin/python scripts/test_jin_primary_admission.py
.venv/bin/python scripts/test_wang_primary_admission.py
cd web
npm ci
npm run db:test-public-import
npm run typecheck
npm run build
CPT_TEST_URL=http://127.0.0.1:3000 node scripts/test-primary-data-release.mjs
CPT_TEST_URL=http://127.0.0.1:3000 node scripts/test-requirements.mjs
CPT_TEST_URL=http://127.0.0.1:3000 node scripts/test-v1-data-release.mjs
```

`verify_primary_release_update.py` additionally checks the local immutable baseline: every old record survives, every old measurement value/unit/identity is unchanged, all packet measurements survive with their qualifications, and root/web CSV hashes agree. Its baseline lives in `outputs/primary_release_20261022/baseline.json` in the research workspace, outside the deployable source bundle.

The public import test uses embedded PostgreSQL (PGlite) to check transactional replacement, idempotence, counts and parity. Local API tests use bundled CSVs. Live PostgreSQL verification must also pass after Render deployment; a local build is not proof of deployment.

## Deployment boundaries

This release is prepared from current GitHub main in an isolated clone. It excludes the unfinished assistant, private source documents and manuscript changes. Render retains its existing migrate/import/start workflow. No credentials are added to git.

Next.js is updated from 16.3.8 to 16.4.2 and the vulnerable source-map-js dependency is patched. The isolated production dependency tree returned zero npm audit advisories on 22 October 2026. This does not certify the separate unfinished assistant dependency tree or eliminate all possible security risks.

## Beginning the discovery analysis

The research workspace contains `outputs/primary_release_20261022/discovery/` and `scripts/analyze_updated_primary_release.py`. The scan retains eligible checkpoints, stratifies material families and screens 120 CNT property pairs. Publication weighting, leave-one-paper-out checks and paper-level bootstrap intervals address some clustering; they do not remove heterogeneous test conditions or publication-selection bias.

One immediate result: among eligible CNT/hybrid fibers with at least 2 GPa tensile strength, the available maximum raw conductivity changes from 11.2 to 27.34 MS/m. At 2.5 GPa it remains 11.2 MS/m: the new best-conducting cohort reports 2.49 GPa. This is an empirical selection result, not a physical threshold. Membership uses reported point estimates, not uncertainty-qualified reliability limits.

No novel physical law, universal saturation or causal processing effect is established by this release. Numerical scan results, exclusions, scripts and an independent arithmetic check remain in the research workspace for further source-level investigation.
