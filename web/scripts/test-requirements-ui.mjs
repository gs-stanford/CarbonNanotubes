import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { unzipSync } from "fflate";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3002";
const output = process.env.CPT_QA_DIR ?? "/tmp/cpt-requirement-qa";
await fs.mkdir(output, {recursive:true});
const browser = await chromium.launch({ headless:true, executablePath:process.env.CPT_CHROME_PATH
  ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined) });
try {
  const page = await browser.newPage({viewport:{width:1600,height:1100}, acceptDownloads:true});
  const errors=[];
  page.on("pageerror", error=>errors.push(error.message));
  await page.goto(base);
  await page.waitForSelector(".plot-point", {timeout:60000});
  await page.locator("#x-property").selectOption("specific_strength");
  await page.locator("#y-property").selectOption("specific_electrical_conductivity");
  const callouts = page.getByRole("checkbox", {name:"Point callouts", exact:true});
  assert.equal(await callouts.isChecked(), true);
  assert.equal(await page.getByRole("checkbox", {name:"Best-qualifying curve", exact:true}).count(), 0);
  await page.locator(".scale-row").nth(0).getByRole("button", {name:"Log",exact:true}).click();
  await page.locator(".scale-row").nth(1).getByRole("button", {name:"Log",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector(".plot-figure")?.getAttribute("aria-busy")==="false" && Array.from(document.querySelectorAll(".axis-text")).some(e=>e.textContent==="0.001"));
  await page.locator(".server-figure-svg").screenshot({path:`${output}/callouts-fixed.png`});
  await callouts.uncheck();
  await page.waitForFunction(()=>document.querySelector(".plot-figure")?.getAttribute("aria-busy")==="false" && !document.querySelector(".point-label"));
  await page.locator("#minimum-x").fill("2");
  await page.waitForFunction(()=>document.querySelector(".plot-figure")?.getAttribute("aria-busy")==="false" && document.querySelector(".requirement-cutoff"));
  assert.equal(await page.locator(".requirement-envelope").count(), 0);
  assert.equal(await page.locator(".requirement-cutoff").count(), 1);
  await page.screenshot({path:`${output}/desktop.png`,fullPage:true});
  assert.ok(await page.locator(".requirement-result").textContent());
  await page.getByRole("tab",{name:"Ashby",exact:true}).click();
  await page.waitForSelector(".plot-ashby .requirement-cutoff", {state:"attached"});
  await page.getByRole("button",{name:"Download Figure",exact:true}).click();
  const download = page.waitForEvent("download", d=>d.suggestedFilename().endsWith(".svg"));
  await page.getByRole("button",{name:"Download SVG",exact:true}).click();
  const artifact = await download;
  await artifact.saveAs(`${output}/requirement.svg`);
  const exported = await fs.readFile(`${output}/requirement.svg`,"utf8");
  assert.match(exported,/requirement-cutoff/);
  assert.doesNotMatch(exported,/class="point-label"|class="label-leader"|class="requirement-envelope"/);
  await page.waitForFunction(()=>!document.querySelector('[aria-label="Download all four figures"]')?.disabled);
  const bundleDownload = page.waitForEvent("download", d=>d.suggestedFilename().endsWith(".zip"));
  await page.getByRole("button",{name:"Download all four figures",exact:true}).click();
  await (await bundleDownload).saveAs(`${output}/figures.zip`);
  const archive = unzipSync(await fs.readFile(`${output}/figures.zip`));
  const svgs = Object.entries(archive).filter(([name])=>name.endsWith(".svg"));
  assert.equal(svgs.length, 4);
  for (const [name, bytes] of svgs) {
    const svg = new TextDecoder().decode(bytes);
    assert.doesNotMatch(svg,/class="point-label"|class="label-leader"|class="requirement-envelope"/,name);
  }
  await page.getByRole("button",{name:"Close export",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${output}/mobile.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Body overflows mobile viewport");
  await page.getByRole("button",{name:"Clear performance requirement",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".requirement-cutoff") && document.querySelector(".plot-figure")?.getAttribute("aria-busy")==="false");
  assert.equal(await page.locator("#minimum-x").inputValue(),"");
  await callouts.check();
  await page.waitForFunction(()=>document.querySelector(".plot-figure")?.getAttribute("aria-busy")==="false" && document.querySelector(".point-label"));
  await page.setViewportSize({width:1600,height:1100});
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  assert.equal(await callouts.isChecked(), true);
  assert.deepEqual(errors,[]);
  console.log(`Requirement UI checks passed; screenshots and SVG: ${output}`);
} finally {await browser.close();}
