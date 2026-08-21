# Carbon Property Tables Deployment

## Render service

Use one Render Web Service for the Next.js app.

- Root directory: `web`
- Build command: `npm ci && npm run build`
- Start command: `npm run db:migrate && npm run db:import-public && npm run start`
- Required env vars:
  - `NODE_VERSION=22`
  - `DATABASE_URL=<Render Postgres internal connection string>`
  - `ADMIN_TOKEN=<long random token for /admin>`
  - `CPT_INTERNAL_API_TOKEN=<Render-generated 256-bit token for trusted data tooling>`

The Blueprint generates `CPT_INTERNAL_API_TOKEN` when it is first applied to a service. Render preserves an existing value, so Blueprint syncs do not rotate the token. Retrieve it from the Render dashboard only when trusted administrative tooling needs authenticated access; never expose it to the browser or public SDK.

Render uses `/api/v1/release` as the HTTP health check and promotes a deployment only after that endpoint returns successfully.

The app creates the Postgres schema lazily at runtime when `DATABASE_URL` is present. Render also migrates the schema and transactionally synchronizes the bundled canonical public release before every start:

```bash
npm run db:migrate
npm run db:import-public
```

`db:import-public` validates IDs and foreign keys, replaces the canonical snapshot in one transaction, and verifies exact row-payload hashes and counts before commit. It is idempotent. Use `npm run db:verify-public` to compare PostgreSQL against the bundled CSV release without writing, or inspect `/api/health/data` for the active release and backend.

When `DATABASE_URL` is configured, canonical records, measurements, and publications are read from PostgreSQL. Bundled CSV files are used only in environments without a configured database.

## Public figure API

The versioned artifact API is served under `/api/v1`; its OpenAPI document is `/api/v1/openapi.json`. Production filters execute against indexed canonical PostgreSQL fields, while representative-record selection and plotting remain server-side. Public responses contain rendered figures, citations, temporary-point ranks, and at most ten exact top rows. Canonical record and coordinate routes require `CPT_INTERNAL_API_TOKEN` and are not advertised. See [`API.md`](./API.md) for examples.

The Python package in `../python` consumes only this artifact contract. Set `CPT_API_URL` to the deployed service URL or pass the URL to `CPTClient`.

## Submission pipeline

1. User submits DOI, sample metadata, property values, conditions, and provenance.
2. Backend verifies DOI through Crossref.
3. Backend canonicalizes values and units deterministically.
4. Backend checks duplicates against the seed dataset plus accepted Postgres submissions.
5. Backend writes canonical publication, record, measurement, and raw payload rows to Postgres.
6. Optional OpenAI cleanup runs only after persistence succeeds.

OpenAI cleanup is proposal-only. It stores suggested labels, flags, and curator notes in `atlas_ai_cleanup_runs`; it does not directly modify canonical measurements, DOI metadata, or public citations.

Enable cleanup only after Postgres is working:

```bash
OPENAI_CLEANUP_ENABLED=true
OPENAI_API_KEY=...
OPENAI_CLEANUP_MODEL=gpt-4.1-mini
```

## Admin curation

Open `/admin` after deployment and enter `ADMIN_TOKEN`.

The admin surface can:

- list accepted submissions from Postgres
- change status between `accepted`, `curator_hold`, `official`, `rejected`, and `hidden`
- toggle public visibility
- edit public point title, material family, form factor, display badge, issue tags, and comparison flags
- manually run OpenAI cleanup after the submission already exists in Postgres

No OpenAI key is required unless cleanup is explicitly enabled. No separate Postgres key is needed in application code; Render injects `DATABASE_URL` from the managed database.
