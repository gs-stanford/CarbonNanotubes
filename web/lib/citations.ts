import type { PlotRecord } from "@/lib/data";

export const ATLAS_CITATION = "Sharma, G. & Boies, A. M. Carbon Property Tables, version 0.1 (2026).";
export const ATLAS_CITATION_REQUIREMENT =
  "Cite every original publication represented by the values used and cite Carbon Property Tables. " +
  "For author-curated compilation records, also cite the compilation publication.";

export type CitationRole = "original" | "compilation" | "atlas";

export type CitationEntry = {
  citation_id: string;
  roles: CitationRole[];
  doi: string | null;
  text: string;
  bibtex: string;
  record_ids: string[];
};

export type CitationBundle = {
  requirement: string;
  style: "nature";
  entries: CitationEntry[];
  copy_all: string;
  bibtex: string;
};

export function stripMarkup(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function doiValue(value: string | null | undefined): string | null {
  const doi = value
    ?.split(";")[0]
    ?.trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
  return doi?.startsWith("10.") ? doi : null;
}

const NAME_PARTICLES = new Set(["da", "de", "del", "della", "der", "di", "dos", "du", "la", "le", "van", "von", "y"]);

function normalizeInitials(value: string): string {
  return value
    .replace(/\b([A-Z])\b/g, "$1.")
    .replace(/([A-Z])\.([A-Z])\./g, "$1. $2.")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenInitial(token: string): string {
  const cleaned = token.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ-]/g, "");
  return cleaned ? `${cleaned[0].toUpperCase()}.` : "";
}

function formatNatureAuthorName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) {
    const [family, given = ""] = cleaned.split(",", 2).map((part) => part.trim());
    return [family, normalizeInitials(given)].filter(Boolean).join(", ");
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return cleaned;
  let familyStart = parts.length - 1;
  while (familyStart > 0 && NAME_PARTICLES.has(parts[familyStart - 1].toLowerCase().replace(/\.$/, ""))) {
    familyStart -= 1;
  }
  const family = parts.slice(familyStart).join(" ");
  const initials = parts
    .slice(0, familyStart)
    .map((part) => {
      if (/^[A-Z](\.)?$/.test(part)) return `${part[0]}.`;
      if (/^([A-Z]\.)+$/.test(part)) return normalizeInitials(part);
      return tokenInitial(part);
    })
    .filter(Boolean)
    .join(" ");
  return [family, initials].filter(Boolean).join(", ");
}

function formatShortNatureAuthors(short: string | null | undefined): string {
  const cleaned = (short ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Unknown authors";
  const etAl = /\bet\s+al\.?$/i.test(cleaned);
  const firstAuthor = cleaned.replace(/\bet\s+al\.?$/i, "").trim();
  const formatted = formatNatureAuthorName(firstAuthor);
  return etAl ? `${formatted} et al.` : formatted;
}

function natureAuthors(full: string | null | undefined, short: string | null | undefined): string {
  const names = (full ?? "")
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) return formatShortNatureAuthors(short);
  const formatted = names.map(formatNatureAuthorName).filter(Boolean);
  if (formatted.length > 6) return `${formatted[0]} et al.`;
  if (formatted.length === 1) return formatted[0];
  return `${formatted.slice(0, -1).join(", ")} & ${formatted[formatted.length - 1]}`;
}

function formatJournalBlock(journal: string | null | undefined, issuePages: string | null | undefined): string {
  const cleanJournal = stripMarkup(journal ?? "");
  const parts = stripMarkup(issuePages ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!cleanJournal) return "";
  if (parts.length >= 3) return `${cleanJournal} ${parts[0]}, ${parts.slice(2).join(", ")}`;
  if (parts.length === 2) return `${cleanJournal} ${parts[0]}, ${parts[1]}`;
  if (parts.length === 1) return `${cleanJournal} ${parts[0]}`;
  return cleanJournal;
}

function bibtexEscape(value: string): string {
  return value.replace(/[{}]/g, "");
}

function citationKey(record: PlotRecord): string {
  const author = (record.publication_authors_short_verified ?? "source").split(/\s+/)[0]?.replace(/[^A-Za-z0-9]/g, "") || "source";
  const year = record.publication_year_verified ?? "nd";
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  const suffix = doi ? doi.replace(/[^A-Za-z0-9]/g, "").slice(-8) : record.record_id.slice(-6);
  return `${author}${year}_${suffix}`;
}

export function formatNatureCitation(record: PlotRecord): string {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  const authors = natureAuthors(record.publication_authors_full_verified, record.publication_authors_short_verified);
  const title = stripMarkup(record.publication_title_verified ?? record.citation_raw ?? record.record_label);
  const journalBlock = formatJournalBlock(record.publication_journal_verified, record.publication_issue_pages_verified);
  const year = record.publication_year_verified ?? "n.d.";
  const doiBlock = doi ? ` https://doi.org/${doi}` : "";
  return `${authors} ${title}. ${journalBlock} (${year}).${doiBlock}`.replace(/\s+/g, " ").trim();
}

export function formatCompilationCitation(record: PlotRecord): string | null {
  const doi = doiValue(record.compilation_source_doi_raw);
  if (!doi) return null;
  if (doi === "10.1002/adma.202008432") {
    return "Bulmer, J. S., Kaniyoor, A. & Elliott, J. A. A meta-analysis of conductive and strong carbon nanotube materials. Advanced Materials 33, 2008432 (2021). https://doi.org/10.1002/adma.202008432";
  }
  const year = record.compilation_source_year ?? "n.d.";
  const authors = formatShortNatureAuthors(record.compilation_source_authors_short ?? "Unknown authors");
  const title = stripMarkup(record.compilation_source_title ?? "Published data compilation");
  const journal = stripMarkup(record.compilation_source_journal ?? "");
  return `${authors} ${title}. ${journal} (${year}). https://doi.org/${doi}`.replace(/\s+/g, " ").trim();
}

export function formatAtlasCitation(): string {
  return ATLAS_CITATION;
}

export function formatBibtex(record: PlotRecord): string {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  const title = bibtexEscape(stripMarkup(record.publication_title_verified ?? record.record_label));
  const fullAuthors = record.publication_authors_full_verified
    ? record.publication_authors_full_verified.split(";").map((name) => name.trim()).filter(Boolean).join(" and ")
    : formatShortNatureAuthors(record.publication_authors_short_verified).replace(/\s+et al\.$/, " and others");
  return `@article{${citationKey(record)},\n  title = {${title}},\n  author = {${bibtexEscape(fullAuthors)}},\n  journal = {${bibtexEscape(stripMarkup(record.publication_journal_verified ?? ""))}},\n  year = {${record.publication_year_verified ?? ""}},\n  doi = {${doi ?? ""}}\n}`;
}

function formatCompilationBibtex(record: PlotRecord): string | null {
  const doi = doiValue(record.compilation_source_doi_raw);
  if (!doi) return null;
  if (doi === "10.1002/adma.202008432") {
    return "@article{Bulmer2021_meta_analysis,\n  title = {A meta-analysis of conductive and strong carbon nanotube materials},\n  author = {Bulmer, John S. and Kaniyoor, Ajit and Elliott, James A.},\n  journal = {Advanced Materials},\n  year = {2021},\n  volume = {33},\n  pages = {2008432},\n  doi = {10.1002/adma.202008432}\n}";
  }
  const key = `compilation_${doi.replace(/[^A-Za-z0-9]/g, "").slice(-12)}`;
  return `@article{${key},\n  title = {${bibtexEscape(stripMarkup(record.compilation_source_title ?? "Published data compilation"))}},\n  author = {${bibtexEscape(record.compilation_source_authors_short ?? "Unknown authors")}},\n  journal = {${bibtexEscape(stripMarkup(record.compilation_source_journal ?? ""))}},\n  year = {${record.compilation_source_year ?? ""}},\n  doi = {${doi}}\n}`;
}

export function formatAtlasBibtex(): string {
  return "@misc{sharma_boies_carbon_property_tables_2026,\n  title = {Carbon Property Tables},\n  author = {Sharma, Gaurav and Boies, Adam M.},\n  year = {2026},\n  version = {0.1}\n}";
}

type PendingCitation = Omit<CitationEntry, "roles" | "record_ids"> & {
  role: CitationRole;
  record_id: string | null;
};

function originalEntry(record: PlotRecord): PendingCitation {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  return {
    citation_id: doi ? `doi:${doi}` : `record:${record.record_id}`,
    role: "original",
    doi,
    text: formatNatureCitation(record),
    bibtex: formatBibtex(record),
    record_id: record.record_id
  };
}

function compilationEntry(record: PlotRecord): PendingCitation | null {
  const text = formatCompilationCitation(record);
  const bibtex = formatCompilationBibtex(record);
  const doi = doiValue(record.compilation_source_doi_raw);
  if (!text || !bibtex || !doi) return null;
  return {
    citation_id: `doi:${doi}`,
    role: "compilation",
    doi,
    text,
    bibtex,
    record_id: record.record_id
  };
}

export function citationBundleForRecords(records: PlotRecord[]): CitationBundle {
  const pending: PendingCitation[] = records.map(originalEntry);
  records.forEach((record) => {
    const entry = compilationEntry(record);
    if (entry) pending.push(entry);
  });
  if (records.length) {
    pending.push({
      citation_id: "atlas:carbon-property-tables-v0.1",
      role: "atlas",
      doi: null,
      text: formatAtlasCitation(),
      bibtex: formatAtlasBibtex(),
      record_id: null
    });
  }

  const merged = new Map<string, CitationEntry>();
  pending.forEach((entry) => {
    const existing = merged.get(entry.citation_id);
    if (!existing) {
      merged.set(entry.citation_id, {
        citation_id: entry.citation_id,
        roles: [entry.role],
        doi: entry.doi,
        text: entry.text,
        bibtex: entry.bibtex,
        record_ids: entry.record_id ? [entry.record_id] : []
      });
      return;
    }
    if (!existing.roles.includes(entry.role)) existing.roles.push(entry.role);
    if (entry.record_id && !existing.record_ids.includes(entry.record_id)) existing.record_ids.push(entry.record_id);
  });

  const entries = Array.from(merged.values());
  return {
    requirement: ATLAS_CITATION_REQUIREMENT,
    style: "nature",
    entries,
    copy_all: entries.map((entry, index) => `${index + 1}. ${entry.text}`).join("\n"),
    bibtex: entries.map((entry) => entry.bibtex).join("\n\n")
  };
}
