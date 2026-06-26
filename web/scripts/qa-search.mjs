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
await page.locator(".plot-search-result-card.is-in-plot").first().click();
const authorSearch = await page.evaluate(() => ({
  status: document.querySelector(".plot-search-status")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  hits: [...document.querySelectorAll(".plot-search-result-card")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  highlighted: document.querySelectorAll(".plot-point.is-search-match").length,
  halos: document.querySelectorAll(".search-highlight-halo").length,
  resultsBeforeFigure: !!(
    document.querySelector(".plot-search-results") &&
    document.querySelector(".plot-figure") &&
    document.querySelector(".plot-search-results").compareDocumentPosition(document.querySelector(".plot-figure")) & Node.DOCUMENT_POSITION_FOLLOWING
  ),
  plotted: document.querySelectorAll(".plot-point").length,
  leftRailSearchInputs: document.querySelectorAll(".control-rail input[type='search']").length,
  selectedTitle: document.querySelector(".detail-rail h3")?.textContent?.trim() ?? "",
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
}));

if (
  authorSearch.plotted < 1 ||
  authorSearch.highlighted < 1 ||
  authorSearch.halos < 1 ||
  authorSearch.leftRailSearchInputs !== 0 ||
  !authorSearch.resultsBeforeFigure ||
  !authorSearch.selectedTitle.includes("Intercalated carbon nanotube fibers") ||
  !/matching atlas rows/.test(authorSearch.status) ||
  authorSearch.hits.some((hit) => /Peng Liu|Materials & Design/.test(hit)) ||
  authorSearch.overflowX
) {
  throw new Error(`Author search QA failed: ${JSON.stringify(authorSearch)}`);
}

await searchInput.fill("10.1038/srep00083");
await page.waitForTimeout(250);
await page.locator(".plot-search-result-card.is-in-plot").first().click();
const doiSearch = await page.evaluate(() => ({
  status: document.querySelector(".plot-search-status")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  hits: [...document.querySelectorAll(".plot-search-result-card")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  highlighted: document.querySelectorAll(".plot-point.is-search-match").length,
  halos: document.querySelectorAll(".search-highlight-halo").length,
  plotted: document.querySelectorAll(".plot-point").length,
  selectedTitle: document.querySelector(".detail-rail h3")?.textContent?.trim() ?? "",
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
}));

if (
  doiSearch.plotted < 1 ||
  doiSearch.highlighted < 1 ||
  doiSearch.halos < 1 ||
  doiSearch.hits.length !== 1 ||
  !doiSearch.hits[0].includes("3 matched rows") ||
  !doiSearch.selectedTitle.includes("Iodine doped carbon nanotube cables") ||
  !/1 grouped result from 3 matching atlas rows/.test(doiSearch.status) ||
  doiSearch.overflowX
) {
  throw new Error(`DOI search QA failed: ${JSON.stringify(doiSearch)}`);
}

await searchInput.fill("iodine doped");
await page.waitForTimeout(250);
await page.locator(".plot-search-result-card.is-in-plot").first().click();
const keywordSearch = await page.evaluate(() => ({
  hits: [...document.querySelectorAll(".plot-search-result-card")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
  highlighted: document.querySelectorAll(".plot-point.is-search-match").length,
  halos: document.querySelectorAll(".search-highlight-halo").length,
  plotted: document.querySelectorAll(".plot-point").length,
  selectedTitle: document.querySelector(".detail-rail h3")?.textContent?.trim() ?? ""
}));

if (keywordSearch.plotted < 1 || keywordSearch.highlighted < 1 || keywordSearch.halos < 1 || !keywordSearch.selectedTitle.includes("Iodine doped carbon nanotube cables")) {
  throw new Error(`Keyword search QA failed: ${JSON.stringify(keywordSearch)}`);
}

await context.close();
await browser.close();

console.log(JSON.stringify({ target, authorSearch, doiSearch, keywordSearch }, null, 2));
