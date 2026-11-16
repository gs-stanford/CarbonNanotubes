export const FORM_LABELS = Object.freeze({
  fiber_yarn: "Fiber / yarn",
  sheet_mat_film: "Sheet / mat / film",
  buckypaper: "Buckypaper",
  foam_aerogel: "Foam / aerogel",
  forest_array: "Forest / array",
  bulk: "Bulk",
  bulk_single_crystal: "Graphite crystal / HOPG",
  micro_nanoscale_device: "Micro / nanoscale device",
  individual_nanotube_or_bundle: "Individual tube / bundle",
  unknown: "Unknown"
});

// Presentation grouping only: retain precise specimen identities in stored records.
export const REFERENCE_FORM_GROUP = Object.freeze({
  key: "crystal_micro_nano",
  label: "Crystals & micro/nanostructures",
  forms: Object.freeze(["bulk_single_crystal", "individual_nanotube_or_bundle", "micro_nanoscale_device"])
});

export const FIGURE_FORM_LABELS = Object.freeze({
  ...FORM_LABELS,
  [REFERENCE_FORM_GROUP.key]: REFERENCE_FORM_GROUP.label
});

export function figureFormGroup(form) {
  return REFERENCE_FORM_GROUP.forms.includes(form) ? REFERENCE_FORM_GROUP.key : form;
}

// Nanoscale specimens, graphite crystals and unresolved forms require opt-in.
export const DEFAULT_FIGURE_FORMS = Object.freeze([
  "fiber_yarn", "sheet_mat_film", "buckypaper", "foam_aerogel", "forest_array", "bulk"
]);

export function referenceForm(sample, doi = "") {
  const text = String(sample ?? "").toLowerCase();
  if (/\bsingle[- ]crystal graphite\b|\bhopg\b|\bhighly oriented pyrolytic graphite\b/.test(text)) return "bulk_single_crystal";
  if (String(doi).toLowerCase().includes("10.1063/1.3147183")) return "micro_nanoscale_device";
  if (/\bnanoribbons?\b/.test(text) && (
    text.includes("device") || !/\b(fibers?|fibres?|yarns?|films?|sheets?|mats?|assembl(?:y|ies))\b/.test(text)
  )) return "micro_nanoscale_device";
  return null;
}

export function validateSpecimenForms(records, measurements) {
  const forms = new Map();
  for (const row of records) {
    if (!Object.hasOwn(FORM_LABELS, row.form_factor)) throw new Error(`Unrecognized specimen form: ${row.record_id}/${row.form_factor}`);
    const expected = referenceForm(row.sample_name, row.doi_raw);
    if (expected && row.form_factor !== expected) throw new Error(`Specimen form contradicts source identity: ${row.record_id}; expected ${expected}.`);
    forms.set(row.record_id, row.form_factor);
  }
  for (const row of measurements) {
    if (forms.has(row.record_id) && row.form_factor !== forms.get(row.record_id)) {
      throw new Error(`Measurement specimen form differs from record: ${row.record_id}`);
    }
  }
}
