# CPT processing analysis

The transport tools reproduce selected, source-qualified comparisons of heat
and charge transport. They do not train a model, retrieve publisher text, or
establish a causal mechanism automatically. An assistant uses its existing
model to choose tools; CPT executes the numerical calculation.

## HTTP interface

POST JSON to `https://carbonnanotubes.onrender.com/api/v1/analysis/transport`.
No API key is required. The catalog is a frozen analysis snapshot, separately
versioned from the larger CPT database. Record the returned `analysis_version`.

```python
import json
from urllib.request import Request, urlopen

URL = "https://carbonnanotubes.onrender.com/api/v1/analysis/transport"
def analysis(body):
    request = Request(URL, data=json.dumps(body).encode(),
                      headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)

catalog = analysis({"action": "catalog"})
comparison = analysis({"action": "compare",
    "ids": ["piontkowski2025_preheat", "piraux1985_cucl2"],
    "version": catalog["analysis_version"]})
print(comparison["result"])
print(comparison["calculation_receipt_sha256"])
source = analysis({"action": "source", "doi": "10.1021/acs.jpcc.5c05657"})
print(source["source"]["locators"])
```

Actions:

| Action | Inputs | Output |
| --- | --- | --- |
| `catalog` | Optional exact `group` and `version` | Groups, retained/contextual counts, source-linked contrast IDs and descriptive selectivity extents |
| `compare` | One to three distinct `ids`; optional `version`, `include_contextual` | Executed channel responses, selectivity, bounds, qualifications and receipt |
| `source` | Exact `doi`, optionally DOI URL; optional `version` | Reading locations, DOI link, relevant record IDs and available document hashes |

Unknown inputs and stale version pins fail explicitly. Contextual contrasts
require `include_contextual: true`; the flag does not upgrade their evidence.
The request body is limited to 8 KiB. Calls share the existing top-result
limit of 60 per hour per client/service process. This in-process limiter is
not a distributed anti-scraping guarantee. Catalog and comparisons contain
no bulk table of CPT measurement coordinates.

## Connect your own assistant

Requirements: Node.js 22 or newer and an MCP-capable client. From the repository:

```sh
cd integrations/cpt-mcp
npm ci
npm start
```

The last command starts a stdio MCP server, not a web page. Normally your client
starts it. Configure its MCP entry with absolute local paths:

```json
{
  "mcpServers": {
    "cpt-processing": {
      "command": "/absolute/path/to/node",
      "args": ["--import", "/absolute/path/to/cpt-mcp/node_modules/tsx/dist/loader.mjs",
               "/absolute/path/to/cpt-mcp/index.ts"],
      "env": {"CPT_API_URL": "https://carbonnanotubes.onrender.com/api/v1"}
    }
  }
}
```

The tools are `processing_catalog`, `compare_processing`, and
`paper_source_locations`. The resource `cpt://transport/contract` states the
scientific constraints. The `compare-heat-and-charge` prompt supplies a short
reproducible workflow. No OpenAI or other model key is required by this adapter;
your assistant's own provider and costs remain separate.

Example question: "Compare furnace pretreatment of Piontkowski's CNT fiber
with CuCl2 intercalation of the pitch-fiber reference. Which channel improves,
what are the qualifications, and where should I inspect the source?"

Calls have a 30-second timeout and propagate client cancellation. Remote
endpoints require HTTPS; loopback HTTP is supported for testing. The adapter
never falls back to a model or a different data endpoint when a call fails.
Figure generation remains available through the [Python/HTTP tutorial](https://github.com/gs-stanford/CarbonNanotubes/blob/main/docs/API_TUTORIAL.md).

## Scientific interpretation

For states 0 and 1, electrical response is sigma1/sigma0, thermal response is
kappa1/kappa0, and Q is thermal response divided by electrical response. All
responses are dimensionless. A Q above one indicates thermal preference,
which may result from electrical loss rather than thermal improvement.

Retained bounds use positive interval arithmetic; they are not confidence
intervals. Graph-read allowance, source errors and covariance are not silently
converted into an uncertainty model. Shared controls and multiple comparisons
from one paper are dependent. A paper count is not a laboratory count.
Literature-reference baselines are disclosed and are not same-filament controls.

The frozen catalog has 54 contrasts: 37 scalar retained comparisons, one
bounded retained comparison, and 16 contextual comparisons. Reading pointers
are available in 24 publication packages, covering part of that catalog; absent pointers are reported as
such. This is not a full-text search service or an exhaustive review.

## Reproduction and validation

`web/scripts/test-transport-analysis.ts` tests all 54 computations for finite
outputs and independently specified reference arithmetic, interval handling,
version pins, contextual opt-in and disclosure boundaries.
`web/scripts/test-transport-tools-live.mjs` tests actual HTTP and MCP execution.
`web/scripts/test-transport-expansion-live.mjs` checks the new dataset through
the figure API. These are software and numerical tests, not live-LLM
scientific-answer evaluations. No training or measured model improvement is
claimed.

After `npm ci` in both `web/` and `integrations/cpt-mcp/`, run from `web/`:

```sh
node --import ../integrations/cpt-mcp/node_modules/tsx/dist/loader.mjs scripts/test-transport-analysis.ts
CPT_TEST_URL=http://127.0.0.1:3000 node scripts/test-transport-tools-live.mjs
CPT_TEST_URL=http://127.0.0.1:3000 node scripts/test-transport-expansion-live.mjs
```

For the HTTP checks, start the website separately on that port. The final two
scripts support output-directory environment variables to retain test receipts.

The implementation draws on the resource/tool/verification workflow of
[Paper2Agent](https://github.com/jmiao24/Paper2Agent), inspected at revision
`8c2d059165ef8cdcb70dbea76655b9c2b55b38e6`. It is a CPT adapter, not a claim to
have run Paper2Agent's complete automated paper-to-server generation pipeline.
The manifest records the adapter fingerprint and runtime dependency pins.

The 2026-10-25 release was tested with Node.js 25.9.0, MCP SDK 1.32.1,
Zod 4.6.7 and tsx 4.23.13. A freshly extracted downloadable package passed
the real stdio/HTTP parity tests. The website production dependency tree and
the extracted MCP package each reported zero npm advisories at that check;
this is a dated dependency check, not a security certification.

The public packet regression can run without private PDFs:

```sh
python -m unittest discover -s scripts -p 'test_transport_expansion_primary_admission.py'
```

The extraction/admission generator itself requires the locally archived source
audits and documents. Those are deliberately not included in the public client.

## Source access and reuse

The public tool returns CPT-authored calculations and bibliographic/source
locations, not article paragraphs, images or PDFs. It does not grant permission
to send subscription content to a third-party model, train on it or redistribute
it. Institutional reading access and downstream AI rights are separate.
Publisher terms and the applicable institutional agreement must be checked for
the intended use with Stanford Libraries or counsel before public text services
or training. This pointer-only design reduces redistribution, not all legal risk.

Relevant policies: [Elsevier TDM license](https://www.elsevier.com/about/policies-and-standards/text-and-data-mining/license),
[Springer Nature AI guidance](https://group.springernature.com/gp/group/ai/ai-guidance-for-our-communities-and-partners).
Paper2Agent's code license does not license papers passed through its workflow.
