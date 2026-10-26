import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const packageDir = path.resolve(process.env.CPT_MCP_PACKAGE ?? "../integrations/cpt-mcp");
const require = createRequire(path.join(packageDir, "package.json"));
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const base = (process.env.CPT_TEST_URL ?? "http://127.0.0.1:3004").replace(/\/$/, "");
const output = path.resolve(process.env.CPT_TOOLS_TEST_OUTPUT ?? "../outputs/transport_expansion_admission_20261025/tools");
const checks = [];
async function call(body, status = 200) {
  const response = await fetch(`${base}/api/v1/analysis/transport`, {method:"POST", headers:{"Content-Type":"application/json"},
    body: typeof body === "string" ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000)});
  const result = await response.json();
  assert.equal(response.status,status,JSON.stringify(result));
  return result;
}
const catalog = await call({action:"catalog"});
assert.equal(catalog.contrasts.length,54);
assert.equal(catalog.groups.reduce((n,g)=>n+g.retained_contrasts,0),38);
assert.match(catalog.resource_sha256,/^[a-f0-9]{64}$/);
const query = {action:"compare",ids:["piontkowski2025_preheat","piraux1985_cucl2"],version:catalog.analysis_version};
const result = await call(query);
const near = (a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
near(result.result[0].response.thermal[0],398/364);
near(result.result[0].response.selectivity[0],398*6.7/(364*3));
near(result.result[0].response.selectivity[1],398*6.7/(364*2));
near(result.result[1].response.selectivity[0],184*.373/(500*3.91));
assert.equal((await call(query)).calculation_receipt_sha256,result.calculation_receipt_sha256);
checks.push("HTTP independent thermal/electrical/interval references", "deterministic receipt", "54 contrasts / 38 retained");
for (const body of [
  {action:"catalog",version:"wrong"}, {action:"catalog",group:"wrong"},
  {action:"catalog",filters:{family:"CNT"}}, {action:"compare",ids:["missing"]},
  {action:"compare",ids:["piraux1985_cucl2","piraux1985_cucl2"]},
  {action:"compare",ids:["vijaykumar2026_heating"]}, "{not json", " ".repeat(8193)
]) await call(body,400);
checks.push("invalid input / unsupported filter / context / version / body limits");
const context = await call({action:"compare",ids:["vijaykumar2026_heating"],include_contextual:true});
assert.match(context.result[0].qualification,/not a matched/);
const pointer = await call({action:"source",doi:"https://doi.org/10.1021/acs.jpcc.5c05657"});
assert.ok(pointer.source.locators.some(s=>s.includes("Fig.2b")));
assert.doesNotMatch(JSON.stringify([catalog,result,pointer]),/\/Users\/|"sigma_MS_m"|"kappa_W_mK"/);
const client = new Client({name:"cpt-independent-runtime-check",version:"1.0"});
const transport = new StdioClientTransport({command:process.execPath,
  args:["--import",path.join(packageDir,"node_modules/tsx/dist/loader.mjs"),path.join(packageDir,"index.ts")],
  env:{...process.env,CPT_API_URL:`${base}/api/v1`},stderr:"pipe"});
let stderr="";
transport.stderr?.on("data",d=>{stderr+=d.toString();});
try {
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),["compare_processing","paper_source_locations","processing_catalog"]);
  const parsed = async(name,args)=>{
    const response=await client.callTool({name,arguments:args});
    assert.ok(!response.isError,JSON.stringify(response));
    return JSON.parse(response.content.find(c=>c.type==="text").text);
  };
  assert.equal((await parsed("processing_catalog",{})).analysis_version,catalog.analysis_version);
  const mcp = await parsed("compare_processing",{ids:query.ids,version:query.version});
  assert.equal(mcp.calculation_receipt_sha256,result.calculation_receipt_sha256);
  assert.equal((await parsed("paper_source_locations",{doi:"10.1021/acs.jpcc.5c05657"})).found,true);
  assert.equal((await client.readResource({uri:"cpt://transport/contract"})).contents.length,1);
  assert.equal((await client.getPrompt({name:"compare-heat-and-charge"})).messages.length,1);
  const error=await client.callTool({name:"compare_processing",arguments:{ids:["vijaykumar2026_heating"]}});
  assert.equal(error.isError,true);
  checks.push("real stdio MCP handshake / tools / resource / prompt", "MCP-to-HTTP calculation parity", "MCP failure propagation");
} finally { await client.close(); }
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,"verification.json"),JSON.stringify({status:"pass",base_url:base,analysis_version:catalog.analysis_version,
  checks,comparison:result,source:pointer,model_calls:0,scope:"Real HTTP and MCP execution, not LLM answer evaluation",stderr},null,2)+"\n");
console.log(JSON.stringify({status:"pass",checks,version:catalog.analysis_version}));
