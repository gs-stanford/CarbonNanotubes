/** Pointer-only public-service bridge. Never imports the private research corpus. */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const base = (process.env.CPT_API_URL ?? "https://carbonnanotubes.onrender.com/api/v1").replace(/\/$/, "");
const url = new URL(base);
if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) {
  throw new Error("CPT_API_URL requires HTTPS except for loopback development.");
}
const server = new McpServer({ name: "cpt-processing-analysis", version: "0.1.0" });
async function call(body: unknown, signal?: AbortSignal) {
  const response = await fetch(`${base}/analysis/transport`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message ?? `CPT returned HTTP ${response.status}`);
  return { content: [{ type: "text" as const, text: JSON.stringify(json) }] };
}
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
server.registerTool("processing_catalog", { description: "Inspect frozen carbon-fiber processing comparisons and aggregate response ranges. Counts are not independent experiments.", annotations,
  inputSchema: z.object({ group: z.string().max(100).optional(), version: z.string().max(80).optional() }).strict() },
  (args, extra) => call({ action: "catalog", ...args }, extra.signal));
server.registerTool("compare_processing", { description: "Execute thermal/electrical fold changes and selectivity for up to three catalog IDs. No invented pairings; contextual evidence requires opt-in.", annotations,
  inputSchema: z.object({ ids: z.array(z.string().max(200)).min(1).max(3), include_contextual: z.boolean().default(false), version: z.string().max(80).optional() }).strict() },
  (args, extra) => call({ action: "compare", ...args }, extra.signal));
server.registerTool("paper_source_locations", { description: "Return DOI links, source figure/table/page locators, record IDs and document fingerprints. No publisher passages or PDFs.", annotations,
  inputSchema: z.object({ doi: z.string().min(3).max(200), version: z.string().max(80).optional() }).strict() },
  (args, extra) => call({ action: "source", ...args }, extra.signal));
server.registerResource("scientific-contract", "cpt://transport/contract", { mimeType: "text/plain" }, async uri => ({ contents: [{ uri: uri.href, mimeType: "text/plain",
  text: "Obtain catalog, select source-linked comparisons, execute comparisons and inspect source locations. Q=(kappa_after/kappa_before)/(sigma_after/sigma_before). Q>1 means thermal preference, not necessarily thermal gain. Report absolute response factors, bounds, grade, dependence and version. No causal mechanism follows from Q alone. The service provides no paper text. Obtain source access and AI-use permission independently. Never pair different treatments, temperatures or doping states." }] }));
server.registerPrompt("compare-heat-and-charge", { description: "Reproduce a source-linked processing comparison without bulk database extraction." }, async () => ({ messages: [{ role: "user", content: { type: "text",
  text: "Use processing_catalog, then compare_processing for relevant retained comparisons. Report both channel responses and their ratio, distinguish measured and contextual evidence, and use paper_source_locations for exact reading pointers. Do not claim a universal route ranking or a mechanism without inspecting source evidence." } }] }));
server.connect(new StdioServerTransport()).catch(error => {
  console.error(error instanceof Error ? error.message : "MCP startup failed");
  process.exitCode = 1;
});
