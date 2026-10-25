import assert from "node:assert/strict";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3002";
const releaseResponse = await fetch(`${base}/api/v1/release`);
assert.equal(releaseResponse.status, 200);
const { release } = await releaseResponse.json();
const page = await fetch(base);
assert.equal(page.status, 200);
const html = await page.text();
const activeScales = [...html.matchAll(/<button class="segmented is-active"[^>]*>([^<]+)<\/button>/g)].map(match => match[1]);
assert.deepEqual(activeScales, ["Log", "Log"], "First server render must use log-log scales");
assert.match(html, /<input type="checkbox" checked=""\/><span>Commercial\/spec-sheet<\/span>/);
assert.match(html, /aria-label="Published database totals"/);
assert.ok(html.includes(`<strong>${release.record_count.toLocaleString("en-US")}</strong>`));
assert.ok(html.includes(`<strong>${release.publication_count.toLocaleString("en-US")}</strong>`));
assert.match(html, /href="\/api-guide"/);
assert.doesNotMatch(html, /Research assistant|research-assistant-drawer/);
const guide = await fetch(`${base}/api-guide`);
assert.equal(guide.status, 200);
const guideHtml = await guide.text();
for (const section of ["quickstart", "figures", "filters", "sample", "search", "rest", "reproducibility"]) {
  assert.ok(guideHtml.includes(`id="${section}"`), section);
}
assert.match(guideHtml, /Copy quickstart example/);
assert.match(guideHtml, /Property explorer/);
console.log(JSON.stringify({
  passed: true, base, defaults: "log-log; all three source classes",
  records: release.record_count, publications: release.publication_count,
  guide_sections: 7,
}, null, 2));
