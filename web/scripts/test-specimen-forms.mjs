import assert from "node:assert/strict";
import { DEFAULT_FIGURE_FORMS, FORM_LABELS, referenceForm, validateSpecimenForms } from "../lib/specimen-forms.mjs";
import { loadPublicRelease } from "./db-import-public.mjs";

const release = loadPublicRelease();
const crystals = ["rec_38c78c9c3219", "rec_4e0f7ff3b136", "rec_0ac7a7d10e72", "rec_7a9c079963dd", "rec_fc1191f385c6", "rec_ec7066ef15ac", "rec_b48842d5bf66"];
const devices = ["rec_170355132b02", "rec_f562bb7a24e6", "rec_c08319e3ced9"];
for (const [ids, form] of [[crystals, "bulk_single_crystal"], [devices, "micro_nanoscale_device"]]) {
  assert.ok(FORM_LABELS[form]);
  assert.ok(!DEFAULT_FIGURE_FORMS.includes(form));
  for (const id of ids) assert.equal(release.records.find(row => row.record_id === id)?.form_factor, form);
}
assert.ok(DEFAULT_FIGURE_FORMS.includes("bulk"), "Ordinary bulk metal references remain visible.");
assert.ok(!DEFAULT_FIGURE_FORMS.includes("individual_nanotube_or_bundle"));
assert.ok(!DEFAULT_FIGURE_FORMS.includes("unknown"));
for (const [sample, doi, form] of [
  ["Single Crystal Graphite", "", "bulk_single_crystal"],
  ["HOPG", "", "bulk_single_crystal"],
  ["Graphene nanoribbon device", "", "micro_nanoscale_device"],
  ["Not reported", "https://doi.org/10.1063/1.3147183", "micro_nanoscale_device"]
]) {
  assert.equal(referenceForm(sample, doi), form);
  const record = { record_id: "specimen", sample_name: sample, doi_raw: doi, form_factor: form };
  validateSpecimenForms([record], [{ record_id: "specimen", form_factor: form }]);
  for (const wrong of ["fiber_yarn", "sheet_mat_film"]) {
    assert.throws(() => validateSpecimenForms([{ ...record, form_factor: wrong }], []), /contradicts/);
  }
  assert.throws(() => validateSpecimenForms([record], [{ record_id: "specimen", form_factor: "fiber_yarn" }]), /differs/);
}
assert.equal(referenceForm("Nanoribbon assembly fiber"), null);
assert.throws(() => validateSpecimenForms([{ record_id: "bad", form_factor: "typo" }], []), /Unrecognized/);
const thermal = release.measurements.find(row => row.record_id === devices[0] && row.property === "thermal_conductivity");
assert.equal(thermal.value_canonical, 1100);
assert.equal(thermal.reported_or_derived, "source_estimate");
assert.match(thermal.payload_json.source_qualification, /model estimate/);
console.log("Specimen form policy, ten release corrections, estimate preservation and rejection checks passed.");
