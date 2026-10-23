import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const base = (process.env.CPT_TEST_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const output = path.resolve(process.env.CPT_PRIMARY_TEST_OUTPUT ?? "../reports/primary_release_20261022");
const checks = [];
const close = (a, b) => assert.ok(Math.abs(a-b) < Math.max(1e-8, Math.abs(b)*1e-7), `${a} != ${b}`);
async function figure(body) {
  const response = await fetch(`${base}/api/v1/figures`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({kind:"scatter", formats:["svg"], top:1, top_by:"y", ...body}),
    signal: AbortSignal.timeout(60000)
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result.error));
  assert.doesNotMatch(result.images.svg, /NaN|Infinity/);
  return result;
}
const healthResponse = await fetch(`${base}/api/health/data`, {signal:AbortSignal.timeout(30000)});
assert.equal(healthResponse.status,200);
const health = await healthResponse.json();
const {release} = await (await fetch(`${base}/api/v1/release`)).json();
const summary = JSON.parse(await fs.readFile("data/public/public_release_summary.json", "utf8"));
assert.equal(release.record_count, summary.public_records);
assert.equal(release.measurement_count, summary.public_measurements);
assert.equal(release.publication_count, summary.public_publications);

// Constants are source-audited reference values, not calculated from the served CSV.
for (const [doi,x,y,expectedX,expectedY] of [
  ["10.1038/s41467-026-69498-7","tensile_strength","electrical_conductivity",2.49,27.34],
  ["10.1021/acsnano.5c14235","electrical_conductivity","tensile_strength",2.60,8.45],
  ["10.1038/s41563-026-02733-0","tensile_strength","thermal_conductivity",5.89,1720],
  ["10.1021/acsanm.6c00845","specific_electrical_conductivity","thermal_conductivity",1.302,199.7],
  ["10.1038/s41467-026-75150-1","initial_modulus","tensile_strength",370,11.63],
]) {
  const statusResponse = await fetch(`${base}/api/v1/doi-status?doi=${encodeURIComponent(doi)}`);
  assert.equal(statusResponse.status,200);
  const status = await statusResponse.json();
  assert.equal(status.in_database,true);
  assert.equal(status.measurements,undefined);
  assert.equal(status.record_ids,undefined);
  const result = await figure({x,y,filters:{doi,form_factor:"fiber_yarn"}});
  assert.equal(result.top_points.length,1);
  const point = result.top_points[0];
  assert.equal(point.doi,doi);
  close(point.x_value,expectedX); close(point.y_value,expectedY);
  if (doi === "10.1038/s41467-026-69498-7") assert.match(point.citation,/17, 3110/);
  if (doi === "10.1038/s41467-026-75150-1") assert.match(point.citation,/17, 8231/);
  assert.ok(result.citations.entries.some(c=>c.doi===doi));
  checks.push({doi,x,y,x_value:point.x_value,y_value:point.y_value});
}

const axes = {x:"tensile_strength",y:"electrical_conductivity",
  filters:{form_factor:"fiber_yarn",material_family:"CNT_or_CNT_hybrid",peer_reviewed:true}};
for (const [minimum_x,expected,doi] of [[2,27.34,"10.1038/s41467-026-69498-7"],
  [2.5,11.2,"10.1016/j.carbon.2022.04.040"],[8.3,2.6,"10.1021/acsnano.5c14235"]]) {
  const result = await figure({...axes,minimum_x});
  close(result.requirement.best.y_value,expected);
  assert.equal(result.requirement.best.doi,doi);
  assert.doesNotMatch(result.images.svg,/class="requirement-envelope"/);
  checks.push({minimum_strength_GPa:minimum_x,best_conductivity_MSm:expected,doi});
}

await fs.mkdir(output,{recursive:true});
for (const kind of ["scatter","ranked","trend","ashby"]) {
  const result = await figure({...axes,kind,formats:["svg","png","pdf"],
    temporary:{x:3,y:15,label:"Release test sample"}});
  assert.equal(result.temporary_point.label,"Release test sample");
  assert.ok(Buffer.from(result.images.png_base64,"base64").subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")));
  assert.equal(Buffer.from(result.images.pdf_base64,"base64").subarray(0,4).toString(),"%PDF");
  assert.ok(result.citations.entries.some(c=>c.doi==="10.1038/s41467-026-69498-7"));
  for (const format of ["svg","png","pdf"]) await fs.writeFile(path.join(output,`${kind}.${format}`),
    format==="svg" ? result.images.svg : Buffer.from(result.images[`${format}_base64`],"base64"));
}
const report = {status:"pass",tested_at:new Date().toISOString(),base_url:base,health,release,checks,
  figure_types:["scatter","ranked","trend","ashby"],formats:["svg","png","pdf"],temporary_sample:true};
await fs.writeFile(path.join(output,"results.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
