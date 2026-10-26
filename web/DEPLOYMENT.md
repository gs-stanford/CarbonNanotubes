# Carbon Property Tables Deployment

## Render service

Use one Render Web Service for the Next.js app.

- Root directory: `web`
- Build command: `npm ci && npm run build`
- Start command: `npm run db:migrate && npm run start`
- Required env vars:
  - `NODE_VERSION=22`
  - `DATABASE_URL=<Render Postgres internal connection string>`
  - `ADMIN_TOKEN=<long random token for /admin>`
  - `CPT_INTERNAL_API_TOKEN=<Render-generated 256-bit token for trusted data tooling>`

The Blueprint generates `CPT_INTERNAL_API_TOKEN` when it is first applied to a service. Render preserves an existing value, so Blueprint syncs do not rotate the token. Retrieve it from the Render dashboard only when trusted administrative tooling needs authenticated access; never expose it to the browser or public SDK.

Render uses `/api/v1/release` as the HTTP health check and promotes a deployment only after that endpoint returns successfully.

The app uses PostgreSQL for production data. Source files and serving tables are not bundled with the public code. Before a release, an authorized administrator admits privately prepared and validated inputs from a trusted workstation:

```bash
npm run db:migrate
CPT_RELEASE_DIR=/secure/release npm run db:import-public
CPT_TRANSPORT_RESOURCE=/secure/transport.json node scripts/db-import-analysis.mjs
```

`db:import-public` rejects private document paths and restricted MatWeb sources, validates IDs and foreign keys, and replaces the canonical snapshot in one transaction. Exact payload hashes and counts are checked before commit. Keep a private backup before admission. Use `CPT_RELEASE_DIR=/secure/release npm run db:verify-public` to verify the result, or inspect `/api/health/data` for the active release and backend. Import the separately versioned processing resource before deploying code that uses it. Credentials belong only in the server environment or an owner-readable local environment file, never in commands, Git or browser code.

Development without PostgreSQL requires separately authorized private data. A public clone can build the website without those files, but cannot serve scientific results until its backend is configured. Deployment restarts do not overwrite the database from Git. Run `python scripts/check_public_repository.py` before publishing code; do not publish validation receipts or raw extraction packages. Current-tree cleanup does not remove old Git history.

## Public figure API

The versioned artifact API is served under `/api/v1`; its OpenAPI document is `/api/v1/openapi.json`. Production filters execute against indexed canonical PostgreSQL fields, while representative-record selection and plotting remain server-side. Public responses contain rendered figures, citations, temporary-point ranks, and at most ten exact top rows. Canonical record and coordinate routes require `CPT_INTERNAL_API_TOKEN` and are not advertised. See [`API.md`](./API.md) for examples.

The Python package in `../python` consumes only this artifact contract. It defaults to `https://carbonnanotubes.onrender.com`; set `CPT_API_URL` or pass a URL to `CPTClient` for another deployment.

## Submission pipeline

1. User submits DOI, sample metadata, property values, conditions, and provenance.
2. Backend verifies DOI through Crossref.
3. Backend canonicalizes values and units deterministically.
4. Backend checks duplicates against the seed dataset plus accepted Postgres submissions.
5. Backend writes canonical publication, record, measurement, and raw payload rows to Postgres with `status=accepted` and `public_visible=false`.
6. Optional OpenAI cleanup runs only after persistence succeeds.
7. A curator verifies the values against the primary publication and marks the row `official`; only then can it appear in public search and figures.

Production submissions return HTTP 503 when `DATABASE_URL` is absent. The app never treats Render's ephemeral filesystem as durable submission storage.

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
- make a submission public only by marking it `official`; PostgreSQL rejects public visibility for every other status
- edit public point title, material family, form factor, display badge, issue tags, and comparison flags
- manually run OpenAI cleanup after the submission already exists in Postgres

No OpenAI key is required unless cleanup is explicitly enabled. No separate Postgres key is needed in application code; Render injects `DATABASE_URL` from the managed database.
