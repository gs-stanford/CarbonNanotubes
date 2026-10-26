import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const base=(process.env.CPT_TEST_URL??"http://127.0.0.1:3004").replace(/\/$/,"");
const output=path.resolve(process.env.CPT_EXPANSION_TEST_OUTPUT??"../outputs/transport_expansion_admission_20261025/api");
const checks=[];
const expected=[
  ["10.1021/acs.jpcc.5c05657","electrical_conductivity","thermal_conductivity",2.5,777,2],
  ["10.1002/smll.202513355","electrical_conductivity","thermal_conductivity",1/1.1,400,1],
  ["10.1002/smll.202513355","density","electrical_conductivity",(6e-7)/(Math.PI*(20e-6)**2/4),10,2],
  ["10.1002/smll.202513355","electrical_conductivity","specific_strength",1/1.1,1.31,2],
];
for (const [doi,x,y,expectedX,expectedY,count] of expected) {
  const response=await fetch(`${base}/api/v1/figures`,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind:"scatter",x,y,minimum_x:0,top:1,top_by:"y",formats:["svg"],filters:{doi,form_factor:"fiber_yarn"}}),signal:AbortSignal.timeout(90000)});
  const r=await response.json();assert.equal(response.status,200,JSON.stringify(r.error));
  assert.equal(r.point_count,count,doi);
  const point=r.top_points[0];
  for(const [actual,want] of [[point.x_value,expectedX],[point.y_value,expectedY]]) assert.ok(Math.abs(actual-want)<Math.max(1e-8,Math.abs(want)*1e-7),`${doi}: ${actual} != ${want}`);
  assert.ok(r.citations.entries.some(c=>c.doi===doi));
  checks.push({doi,x,y,count,x_value:point.x_value,y_value:point.y_value});
}
for(const doi of ["10.1103/physrevb.41.4961","10.1016/j.cej.2025.171739"]) {
  const s=await(await fetch(`${base}/api/v1/doi-status?doi=${encodeURIComponent(doi)}`)).json();
  assert.equal(s.in_database,true);assert.equal(s.measurements,undefined);
}
const absent=await fetch(`${base}/api/v1/figures`,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({kind:"scatter",x:"electrical_conductivity",y:"thermal_conductivity",top:1,formats:["svg"],filters:{doi:"10.1016/j.cej.2025.171739"}})});
const absentBody=await absent.json();
assert.ok(absent.status===400 || absentBody.point_count===0,"Borrowed Choi thermal conductivity must not appear as a measurement");
const health=await(await fetch(`${base}/api/health/data`)).json();
const counts=health.release ? {records:health.release.recordCount,measurements:health.release.measurementCount,publications:health.release.publicationCount} : health.counts;
assert.deepEqual(counts,{records:1579,measurements:5992,publications:336});
if(process.env.CPT_VERIFY_DEPLOYMENT==="1") { assert.equal(health.backend,"postgresql");assert.equal(health.status,"ok"); }
if(process.env.CPT_EXPECT_COMMIT) assert.equal(health.build.commit,process.env.CPT_EXPECT_COMMIT);
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,"verification.json"),JSON.stringify({status:"pass",base_url:base,checks,adopted_thermal_excluded:true,health,deployment_verified:process.env.CPT_VERIFY_DEPLOYMENT==="1"},null,2)+"\n");
console.log(JSON.stringify({status:"pass",checks,health}));
