import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ApiCodeBlock } from "@/components/ApiCodeBlock";
import { API_GUIDE_EXAMPLES as examples } from "@/lib/api-guide-examples";
import styles from "./guide.module.css";

export const metadata: Metadata = {
  title: "API guide | Carbon Property Tables",
  description: "Generate CPT figures, export citations, filter comparisons, and benchmark a temporary sample from Python or the REST API.",
};

const sections = [
  ["quickstart", "Get started"],
  ["figures", "Four figure types"],
  ["filters", "Filters and top results"],
  ["sample", "Your sample"],
  ["search", "Find publications"],
  ["rest", "REST API"],
  ["reproducibility", "Cite and reproduce"],
];

export default function ApiGuide() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>Carbon Property Tables</Link>
      <Link href="/"><ArrowLeft size={16} aria-hidden="true"/>Property explorer</Link>
    </header>
    <div className={styles.layout}>
      <nav className={styles.contents} aria-label="API guide sections">
        <p>API guide</p>
        {sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
        <a href="/api/v1/openapi.json">OpenAPI specification<ExternalLink size={13}/></a>
      </nav>
      <article className={styles.article}>
        <h1>API guide</h1>
        <p className={styles.intro}>Create comparison figures and citation bundles from Python or HTTP. Benchmark your own sample against the published CPT database.</p>
        <p className={styles.access}>No API key required. Figures, source metadata, and up to ten top results per request are available; bulk measurement downloads are not.</p>

        <section id="quickstart">
          <h2>Get started</h2>
          <p>Use Python 3.10 or newer. The client connects to the public CPT service; it does not download the database.</p>
          <ApiCodeBlock code={examples.install} language="Terminal" label="installation command"/>
          <p>The first argument is the x property; the second is the y property. This example includes commercial reference materials as well as research records.</p>
          <ApiCodeBlock code={examples.quickstart} language="Python" label="quickstart example"/>
          <p><code>save_bundle()</code> writes SVG, PNG, and PDF figures, a citation list, BibTeX, and a reproducibility manifest. To save one format instead, use <code>figure.save("comparison.svg")</code>; request that format when creating the figure.</p>
        </section>

        <section id="figures">
          <h2>Four figure types</h2>
          <dl className={styles.modes}>
            <div><dt>Scatter</dt><dd>Compare two reported properties.</dd></div>
            <div><dt>Ranked</dt><dd>Highest reported values of the y property.</dd></div>
            <div><dt>Trend</dt><dd>The y property against publication year.</dd></div>
            <div><dt>Ashby</dt><dd>Logarithmic property comparison with material-family regions.</dd></div>
          </dl>
          <ApiCodeBlock code={examples.modes} language="Python" label="four figure types example"/>
          <p>Set <code>log_x</code> and <code>log_y</code> explicitly in Python. Ashby always uses log axes; Trend keeps publication year linear.</p>
        </section>

        <section id="filters">
          <h2>Filters and top results</h2>
          <p>Select material families, form, year, or measurement ranges. The example below compares CNT and carbon fibers with reported densities from 500 to 2,000 kg/m<sup>3</sup>.</p>
          <ApiCodeBlock code={examples.filters} language="Python" label="filter example"/>
          <p><code>measurement_filter</code> uses <code>property:min:max</code> in canonical SI units. Leave a bound empty for no limit. A record missing the filtered property is excluded. <code>top=5, top_by="y"</code> returns the five highest y values; the maximum is ten.</p>
          <p>Commercial/spec-sheet records are included unless excluded by a filter. Use <code>peer_reviewed=True</code> for only peer-reviewed sources. For a minimum x-property threshold with the qualifying leader highlighted, see the <a href="#rest">REST example</a>.</p>
        </section>

        <section id="sample">
          <h2>Benchmark your sample</h2>
          <p>Add a labelled marker without changing the database. Coordinates use the displayed axis units, not the canonical units used in measurement filters.</p>
          <ApiCodeBlock code={examples.temporary} language="Python" label="temporary sample example"/>
          <p>The response reports axis ranks, percentiles, and Pareto status within the plotted cohort. The sample is temporary, user-supplied, and not a curated CPT measurement.</p>
        </section>

        <section id="search">
          <h2>Find publications and properties</h2>
          <ApiCodeBlock code={examples.search} language="Python" label="publication search example"/>
          <p>Search DOI, author, title, or indexed keywords. DOI lookup and publication search return bibliographic metadata, not measurements or bulk coordinates.</p>
        </section>

        <section id="rest">
          <h2>REST API</h2>
          <p>Use <code>/api/v1</code> on this website. <a href="/api/v1/release">Release metadata</a>, the <a href="/api/v1/properties">property catalog</a>, and the <a href="/api/v1/openapi.json">OpenAPI specification</a> describe the current service.</p>
          <p>This request applies a minimum specific strength of 2 N/tex, hides point callouts, and returns all three image formats. <code>minimum_x</code> uses displayed x-axis units. These two settings are supported by the server but require a newer source-checkout client for Python; the published 0.4.0 package examples above do not depend on them.</p>
          <ApiCodeBlock code={examples.rest} language="Terminal" label="REST figure request"/>
          <ApiCodeBlock code={examples.restSave} language="Python" label="REST export example"/>
          <p>For a repeatable request, also pass <code>release</code> with the <code>release_id</code> returned by <code>/api/v1/release</code>. PNG and PDF are base64-encoded in the JSON response; SVG is text.</p>
        </section>

        <section id="reproducibility">
          <h2>Cite and reproduce</h2>
          <ol>
            <li>Pin the release ID and retain the generated manifest with your figures.</li>
            <li>Cite CPT and the original sources in the figure's citation bundle.</li>
            <li>Report your properties, units, source classes, and other active filters.</li>
            <li>Check specimen identity and measurement conditions before interpreting differences across papers.</li>
          </ol>
          <p>The service currently serves one active release. An unavailable release pin fails rather than silently using newer data. Unknown properties, invalid bounds, and unsupported requests return explicit errors; narrow the filters for an empty or overly broad comparison.</p>
          <p><a href="https://github.com/gs-stanford/CarbonNanotubes/blob/main/docs/API_TUTORIAL.md">Full tutorial and reference examples<ExternalLink size={13}/></a></p>
        </section>
      </article>
    </div>
    <footer className="atlas-footer">Designed by Boies Group, Stanford University</footer>
  </main>;
}
