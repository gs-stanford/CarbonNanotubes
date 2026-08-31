# Carbon Property Tables

Technical overview and operator README. Last reviewed: 2026-08-26.

Carbon Property Tables (CPT) is a citation-backed property comparison system for carbon nanotubes and related high-performance materials. It combines a curated materials database, an interactive website, a versioned figure API, a Python SDK, and a curator-controlled community submission workflow.

The project is functional and deployed, but the current data release is still a pre-launch public candidate release. It should not yet be described as a complete or condition-matched reference database.

## Current production state

- Website: <https://carbonnanotubes.onrender.com>
- API discovery: <https://carbonnanotubes.onrender.com/api/v1>
- OpenAPI document: <https://carbonnanotubes.onrender.com/api/v1/openapi.json>
- API and Python tutorial: [docs/API_TUTORIAL.md](docs/API_TUTORIAL.md)
- GitHub: <https://github.com/gs-stanford/CarbonNanotubes>
- Python package: <https://pypi.org/project/carbon-property-tables/>
- Python SDK version for this release: `0.4.0`
- Production backend: Render Web Service plus Render PostgreSQL
- Candidate release: `public-v0-957a5a43a0cbf6c0`
- Schema: `carbon-property-tables-public-v0.4`
- Source hash: `957a5a43a0cbf6c094b0f67d95bbe4e5b168702576b1befb8740eef13e29a93a`
- Candidate data: 1,363 records, 5,337 measurements, and 271 publications

The repository and some internal schema names still use the historical `CNT Property Atlas` or `cnt-property-atlas` name. The user-facing product is now Carbon Property Tables.

## System architecture

```text
Source workbooks and literature extracts
        |
        v
Deterministic Python ETL and DOI metadata validation
        |
        v
Processed tables -> curation queues -> duplicate/integrity audits
        |
        v
Immutable public CSV release
        |
        +---------------------> bundled local-development fallback
        |
        v
Transactional Render PostgreSQL import
        |
        v
Next.js website and API v1
        |
        +---------------------> browser interface
        |
        +---------------------> carbon-property-tables Python SDK
```

Community submissions use a separate mutable PostgreSQL workflow. They do not enter the immutable public release or public figures until a curator marks them `official` and public.

## Repository layout

- `data/processed/`: normalized working tables, SQLite export, DOI results, issues, and duplicate candidates.
- `data/curation/`: record/publication review queues and the curator workbook payload.
- `data/public/`: canonical public release CSVs, exclusions, duplicate audit, schema, and release summary.
- `data/literature/`: DOI-resolution tables, manual literature addenda, source files, and literature-expansion work.
- `scripts/`: database construction, DOI validation, curation, release building, and integrity audits.
- `web/`: Next.js 16 website, API, PostgreSQL schema/importer, figure renderer, and admin interface.
- `python/`: published `carbon-property-tables` SDK and tests.
- `examples/`: executable SDK notebooks.
- `reports/`: generated build, curation, and integrity reports.
- `render.yaml`: Render web service and PostgreSQL Blueprint.

## Data sources and scope

The deterministic seed build currently draws from:

- `XiaO_DATA.xlsx`, exported from the Xiao Ashby-plot Origin project.
- `RadarFigureSource.xlsx`, a derived plot/radar workbook with CNT and comparator data.
- `New G fibre table Juan.xlsx`, an author-supplied graphene-fiber addendum.
- `20210409_Metaanalysis_database.xlsx`, the author-supplied Bulmer, Kaniyoor and Elliott meta-analysis workbook.
- `data/literature/literature_addendum_records.tsv`, targeted values extracted from locally archived papers and supporting information.

The active release contains CNTs and CNT hybrids, CNT-metal composites, graphene/graphite fibers, carbon fibers, and selected polymer, metal, ceramic/glass, and other-carbon comparators. The comparator categories are not intended to be comprehensive standalone databases.

The Bulmer/Kaniyoor/Elliott rows are treated as an author-curated published compilation whose primary-source checks were completed during that workflow. They are not marked as pending generic secondary extractions. When required, outputs cite both the original paper and the compilation.

## Canonical data model

The main scientific entities are:

- **Publication:** DOI, verified title, authors, journal, year, issue/pages, source type, and validation status.
- **Record/sample:** material family, form factor, CNT type, sample identity, synthesis, postprocessing, alignment/densification, and display labels.
- **Measurement:** canonical and source-scale values, statistic and bound type, uncertainty, specimen linkage, conditions, normalization/derivation basis, provenance, and plot eligibility.
- **Conditions:** temperature, atmosphere, method, gauge length, strain rate, and other property-specific conditions when available.
- **Provenance:** source file, table/figure/page, extraction method, curator, compilation source, and evidence flags.
- **Review state:** source tier, primary-source verification status, duplicate role, strict-comparison readiness, and public visibility.

PostgreSQL enforces one canonical measurement per record/property, controlled scientific-field domains, positive values, valid uncertainties/sample counts, and separation of immutable release tables from mutable community submissions. Property-pair evidence grades are computed at query time under `cpt-property-pair-v1`; they are not persisted as canonical scores.

## Current release quality

The current public-facing v0 release contains:

- 1,019 peer-reviewed research-tier records.
- 281 peer-reviewed contextual comparator records.
- 63 commercial contextual comparator records.
- 1,238 author-curated compilation records, all marked primary-source checked in the current workflow.
- 193 excluded records.
- 57 detected duplicate groups and 100 collapsed duplicate rows.

Important limitations:

- No legacy record is automatically marked strict-comparison ready. Figure-specific evidence is now computed from the active property pair.
- 510 records carry missing-condition warnings.
- 65 records carry unit-inference review warnings.
- 679 density-derived measurements lack a reported density convention and therefore remain explicitly exploratory.
- Publication years extend back to 1888 because contextual comparator materials predate CNT research. This is not a claim that CNT literature begins in 1888.
- `public` means included in the current public-facing candidate release. It does not mean every record is sufficiently complete for a strict one-to-one scientific comparison.

DOI resolution and metadata matching verify bibliographic identity only. They do not verify a reported number. Publication-grade inclusion should require source/SI inspection, same-specimen pairing for multi-property plots, recomputable unit conversion, duplicate resolution, retained uncertainty, and human adjudication. Ambiguous values should remain excluded rather than inferred.

The release provenance census is [data/public/public_provenance_census_v0.csv](data/public/public_provenance_census_v0.csv). Of the 1,363 public records, 1,238 come from the Bulmer/Kaniyoor/Elliott author-curated compilation and 125 from direct/source-table paths. This distribution is disclosed explicitly and does not support a claim of source-balanced comprehensiveness.

## Website capabilities

The deployed website currently provides:

- Scatter, highest-reported-value, trend, and Ashby-style figure modes.
- Linear/log controls where scientifically allowed; Ashby mode always uses log/log axes.
- Material-family colors and form-factor marker shapes.
- Filters for material family, form factor, source class, year, density, diameter, gauge length, temperature, and other supported measurements.
- DOI, title, author, journal, year, and material/process keyword search over represented publications.
- Search-result highlighting when a matching record is visible in the active plot.
- Selected-point details with publication metadata, conditions, warnings, and DOI links.
- Query-time A-D point-evidence filtering with same-specimen, condition, statistic, normalization, density-basis, and uncertainty disclosures.
- Figure-specific citation assembly with deduplicated Nature-style text and BibTeX.
- SVG, PNG, and PDF export with legends and citation sidecars.
- DOI-verified community submission and a token-protected curator admin interface.

Radar charts were removed from the product because too few records contain a defensible complete set of radar properties. Ashby envelopes are visualization summaries of the represented data, not formal material-class boundaries; each property pair still needs scientific review before publication use.

## Public API

The stable public contract is under `/api/v1`:

```text
GET  /api/v1
GET  /api/v1/release
GET  /api/v1/properties
POST /api/v1/figures
GET  /api/v1/doi-status?doi={doi}
GET  /api/v1/search?q={query}&limit={1..25}
GET  /api/v1/openapi.json
```

The API renders figures, applies filters and representative-record rules, ranks temporary points, and assembles citations on the server. A figure response may include at most ten explicitly requested top rows. It does not expose canonical record pagination or full coordinate tables.

For reproducible work, pass the exact active `release_id` from `/api/v1/release` in each figure request. A mismatch fails closed rather than silently using a newer snapshot. The live database currently serves one canonical snapshot; historical replay requires the matching tagged archive.

DOI status and publication search return bibliographic identity only. They do not return measurements, coordinates, sample counts, record IDs, or property availability.

Raw record and plot routes still exist for trusted migration/administration tooling, but require `CPT_INTERNAL_API_TOKEN` and return `404` without it.

## Python SDK

Install the production package:

```bash
python -m pip install carbon-property-tables==0.4.0
```

Basic use:

```python
import carbon_property_tables as cpt

figure = cpt.scatter(
    "specific strength",
    "specific conductivity",
    log_x=True,
    log_y=True,
    top=5,
    top_by="y",
    release="public-v0-957a5a43a0cbf6c0",
)

figure.save_bundle("conductivity-vs-strength")
print(figure.top_table())
```

The SDK also exposes `ranked`, `trend`, `ashby`, `search`, `has_doi`, `doi_status`, `release`, and `properties`.

The complete executable walkthrough, including REST syntax, filters, units,
temporary samples, exports, citations, release pinning, and failure handling,
is available in [docs/API_TUTORIAL.md](docs/API_TUTORIAL.md).

A temporary unpublished result can be benchmarked without storing it:

```python
from carbon_property_tables import TemporaryPoint

figure = cpt.scatter(
    "specific_strength",
    "specific_electrical_conductivity",
    temporary=TemporaryPoint(x=1.8, y=12.0, label="My sample"),
    top=5,
    top_by="y",
)
print(figure.temporary_point)
```

The package deliberately does not provide bulk record download, arbitrary value extraction, or a local canonical database. Exact tabular output is capped at ten selected top rows. Run the complete production acceptance tour with:

```bash
cpt-feature-tour --output-dir cpt-feature-tour-output
```

## Community submission workflow

1. A user submits a DOI, sample description, measurements, conditions, and source location.
2. The backend verifies the DOI and publication metadata through Crossref.
3. Values and units are canonicalized deterministically.
4. Duplicate checks run against the active release and accepted submissions.
5. The raw payload and canonical proposal are written to PostgreSQL as `accepted` and `public_visible=false`.
6. Optional OpenAI cleanup may propose label, flag, and curator-note edits only after persistence succeeds.
7. A curator checks the primary paper/SI and changes the state to `official` when justified.
8. PostgreSQL permits public visibility only for an `official` submission.

OpenAI cleanup is disabled by default and is not a scientific validator. It cannot directly modify measurements, DOI metadata, or public citations.

Current review states are `accepted`, `curator_hold`, `official`, `rejected`, and `hidden`. Only `official` is public.

## Local development

Website with bundled CSV fallback:

```bash
cd web
npm ci
npm run dev
```

The local site is then available at <http://localhost:3000>. A PostgreSQL connection is optional for reading the bundled release, but required for durable submissions.

Python SDK in editable mode:

```bash
python -m pip install -e './python[dev]'
python -m pytest python/tests
```

The SDK defaults to the production API. Set `CPT_API_URL` to use another deployment.

## Release validation

The full deterministic pre-launch gate is:

```bash
.venv/bin/python scripts/validate_public_release.py
```

It rebuilds the combined database, validates publication metadata from the DOI cache, rebuilds curation and public artifacts, syncs the web copy, runs integrity audits, typechecks the app, and creates a production Next.js build.

Additional web checks:

```bash
cd web
npm run db:validate-public-files
npm run typecheck
npm run build
```

With a server running on port 3001, run the figure and API acceptance suites:

```bash
CPT_TEST_URL=http://localhost:3001 npm run test:figure-selection
CPT_TEST_URL=http://localhost:3001 npm run test:all-figures
CPT_TEST_URL=http://localhost:3001 npm run test:api-v1
```

## Deployment

Render is configured by `render.yaml`:

- Build: `npm ci && npm run build`
- Start: `npm run db:migrate && npm run db:import-public && npm run start`
- Health check: `/api/v1/release`
- Auto-deploy: enabled from GitHub

Required production environment variables:

- `NODE_VERSION=22`
- `DATABASE_URL`, injected by Render PostgreSQL
- `ADMIN_TOKEN`, set manually and kept server-side
- `CPT_INTERNAL_API_TOKEN`, generated by Render and kept server-side

Optional OpenAI cleanup variables:

- `OPENAI_CLEANUP_ENABLED=true`
- `OPENAI_API_KEY`
- `OPENAI_CLEANUP_MODEL`, currently configured as `gpt-4.1-mini`

Each start transactionally imports and verifies the bundled release. The active release is switched only after counts, foreign keys, row hashes, and release hashes pass.

The Python package is built, tested, smoke-installed, and published through `.github/workflows/python-sdk.yml` using PyPI trusted publishing. No long-lived PyPI API token is stored in the repository.

## Deliberate access boundary

The public API and Python SDK are designed around figures, citations, DOI coverage, publication discovery, temporary-point benchmarking, and a bounded top table. They are not intended to be bulk database clients.

However, the complete current public release CSVs are tracked in this GitHub repository, and SVG output can be digitized. Therefore the present restriction is a product and citation boundary, not data secrecy or digital-rights management. If raw-table access is meant to be genuinely restricted, the canonical release files must move to private build storage before a public launch.

## Citation and paper claim

The repository includes `CITATION.cff`, but a permanent archive DOI has not yet been minted. A defensible manuscript sentence is:

> Figure X was generated from Carbon Property Tables release `public-v0-957a5a43a0cbf6c0` using the property-pair evidence model `cpt-property-pair-v1`; values and source-level qualifications are listed in the accompanying table.

Do not describe this release as comprehensive or universally method matched. Before a paper is submitted, tag the exact release, deposit it with the exclusions, provenance census, codebook, per-point table, and reproduction command in Zenodo, then cite that immutable version DOI rather than the Render URL.

The scientific codebook and rule specification is [docs/SCIENTIFIC_SCHEMA_AND_COMPARABILITY.md](docs/SCIENTIFIC_SCHEMA_AND_COMPARABILITY.md).

## Known gaps before a large public launch

- Complete human validation of the current and newly discovered literature candidates.
- More structured test-condition metadata so strict comparisons are meaningful.
- Registered-user accounts, ownership, email verification, spam prevention, and role-based admin access.
- A stable production domain and completion of the internal CNT-to-CPT naming migration.
- A formal versioned archive/DOI for Carbon Property Tables itself.
- Historical server-side release replay; pinned requests currently fail closed when the requested snapshot is not active.
- Persistent distributed rate limiting, monitoring, alerting, and tested database backup/restore procedures.
- Clear licensing and data-reuse terms for source-derived measurements and commercial comparators.
- A decision on whether the raw public CSV release remains in the public repository.
- Expansion of polymers, graphene, GICs, and carbon fibers only after equivalent source-level validation.

The local literature-expansion and intern-validation artifacts are not part of the active production release. They should be migrated only after human decisions are recorded and the complete release gate passes.

## Recommended next work

1. Finish human adjudication of the expansion workbook and migrate only accepted rows.
2. Raise strict-comparison coverage by curating conditions for the highest-value CNT records first.
3. Decide the data-access and licensing policy before further API or repository publication.
4. Add registered contributor accounts and stronger production abuse controls.
5. Mint a versioned CPT archive DOI and lock the citation text to that release.
