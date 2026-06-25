import { chromium } from "playwright-core";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const target = process.env.QA_URL ?? "http://localhost:3000";

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 1
});
const page = await context.newPage();
await page.goto(target, { waitUntil: "networkidle", timeout: 30000 });

const searchInput = page.getByLabel("Search records by DOI, author, title, or keyword");

await searchInput.fill("de Isidro-Gomez");
await page.waitForTimeout(250);
const authorSearch = await page.evaluate(() => ({
  notes: [...document.querySelectorAll(".search-note")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  hits: [...document.querySelectorAll(".search-hit-list button")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  plotted: document.querySelectorAll(".plot-point").length,
  selectedTitle: document.querySelector(".detail-rail h3")?.textContent?.trim() ?? "",
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
}));

if (
  authorSearch.plotted < 1 ||
  !authorSearch.selectedTitle.includes("Intercalated carbon nanotube fibers") ||
  !authorSearch.notes.some((note) => /atlas records match/.test(note)) ||
  authorSearch.hits.some((hit) => /Peng Liu|Materials & Design/.test(hit)) ||
  authorSearch.overflowX
) {
  throw new Error(`Author search QA failed: ${JSON.stringify(authorSearch)}`);
}

await searchInput.fill("10.1038/srep00083");
await page.waitForTimeout(250);
const doiSearch = await page.evaluate(() => ({
  notes: [...document.querySelectorAll(".search-note")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  hits: [...document.querySelectorAll(".search-hit-list button")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  plotted: document.querySelectorAll(".plot-point").length,
  selectedTitle: document.querySelector(".detail-rail h3")?.textContent?.trim() ?? "",
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
}));

if (
  doiSearch.plotted < 1 ||
  !doiSearch.selectedTitle.includes("Iodine doped carbon nanotube cables") ||
  !doiSearch.notes.some((note) => /atlas records match/.test(note)) ||
  doiSearch.overflowX
) {
  throw new Error(`DOI search QA failed: ${JSON.stringify(doiSearch)}`);
}

await searchInput.fill("iodine doped");
await page.waitForTimeout(250);
const keywordSearch = await page.evaluate(() => ({
  hits: [...document.querySelectorAll(".search-hit-list button")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  plotted: document.querySelectorAll(".plot-point").length,
  selectedTitle: document.querySelector(".detail-rail h3")?.textContent?.trim() ?? ""
}));

if (keywordSearch.plotted < 1 || !keywordSearch.selectedTitle.includes("Iodine doped carbon nanotube cables")) {
  throw new Error(`Keyword search QA failed: ${JSON.stringify(keywordSearch)}`);
}

await context.close();
await browser.close();

console.log(JSON.stringify({ target, authorSearch, doiSearch, keywordSearch }, null, 2));
