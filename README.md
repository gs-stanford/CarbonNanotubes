# Carbon Property Tables

CPT compares published carbon-material properties, preserves source citations,
and produces scientific figures through its website and Python/HTTP interfaces.

- [Property explorer](https://carbonnanotubes.onrender.com)
- [API guide](https://carbonnanotubes.onrender.com/api-guide)
- [Python tutorial](docs/API_TUTORIAL.md)
- [Processing tools and MCP](docs/PROCESSING_TOOLS.md)
- [Deployment instructions](web/DEPLOYMENT.md)

## Public Software, Private Backend

This repository contains website/API code, the Python client, MCP adapter,
schemas and administrative import tools. It does not distribute the source
papers, full-text extractions, workbooks, validation receipts or complete
measurement tables. Production reads its versioned release and processing
inputs from PostgreSQL. The API supplies figures, bibliographic search,
bounded top selections and selected calculations, not a bulk-data export.

The active release is available at `/api/v1/release`; processing-resource
versions are returned by `/api/v1/analysis/transport`. Pin both for reproducible
analysis. A DOI identifies a publication, not necessarily a comparable specimen.
Inspect the conditions and comparison qualifications attached to each result.

## Development

Use Node 22 or later. In `web`, run `npm ci` and `npm run build`. A public checkout
builds without scientific data. To serve results, configure `DATABASE_URL` and
admit an authorized private release following the deployment instructions.
Then run `npm run dev` and open the reported local URL.

The Python SDK is in `python/`; `python -m pip install ./python` installs the
current source version. Version 0.4.1 adds the MIT licence; this repository
version does not imply that a matching package has been uploaded to PyPI.
The MCP download contains only adapter code, dependencies, instructions and
licences. Users connect their own assistant and obtain their own paper access.

## Release Checks

Before publishing code, run `python scripts/check_public_repository.py`.
For an authorized private data release, run the source/integrity checks and
`npm run db:test-public-import` with the private tables available. Import is
transactional and checks hashes and row counts. Source PDFs and validation
artifacts must never be placed in `web/public` or committed to Git.

## Rights

CPT-authored software uses [MIT](LICENSE). See [Data and Source Rights](DATA_RIGHTS.md)
for the limited CC BY 4.0 grant on CPT-owned released annotations/results and
the exclusions for third-party content. Citation does not replace permission.
Current-tree cleanup does not erase previous Git history or third-party copies.
