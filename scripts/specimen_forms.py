"""Conservative specimen-form inference and release admission checks."""

import re

FORMS = {
    "fiber_yarn", "sheet_mat_film", "buckypaper", "foam_aerogel",
    "forest_array", "individual_nanotube_or_bundle", "bulk",
    "bulk_single_crystal", "micro_nanoscale_device", "unknown",
}


def reference_form(specimen, doi=""):
    text = str(specimen).lower()
    if re.search(r"\bsingle[- ]crystal graphite\b|\bhopg\b|\bhighly oriented pyrolytic graphite\b", text):
        return "bulk_single_crystal"
    if "10.1063/1.3147183" in str(doi).lower():
        return "micro_nanoscale_device"
    if re.search(r"\bnanoribbons?\b", text) and (
        "device" in text or not re.search(r"\b(fibers?|fibres?|yarns?|films?|sheets?|mats?|assembl(?:y|ies))\b", text)
    ):
        return "micro_nanoscale_device"
    return None


def specimen_form(text):
    text = str(text).lower()
    reference = reference_form(text)
    if reference:
        return reference
    if re.search(r"\bindividual\b.*\b(nanotubes?|tubes?|bundles?|cnts?)\b", text):
        return "individual_nanotube_or_bundle"
    for pattern, form in (
        (r"\bbucky(?:papers?)?\b", "buckypaper"),
        (r"\b(sheets?|films?|mats?)\b", "sheet_mat_film"),
        (r"\b(foams?|aerogels?)\b", "foam_aerogel"),
        (r"\b(forests?|arrays?)\b", "forest_array"),
        (r"\bbulk\b", "bulk"),
        (r"\b(fibers?|fibres?|yarns?|cables?|filaments?)\b", "fiber_yarn"),
    ):
        if re.search(pattern, text):
            return form
    return "unknown"


def validate_specimen_forms(records, measurements):
    forms = {}
    for row in records.to_dict("records"):
        rid, form = row["record_id"], row["form_factor"]
        if form not in FORMS:
            raise ValueError(f"Unrecognized specimen form: {rid}/{form}")
        expected = reference_form(row.get("sample_name", ""), row.get("doi_raw", ""))
        if expected and form != expected:
            raise ValueError(f"Specimen form contradicts source identity: {rid}; expected {expected}, got {form}")
        forms[rid] = form
    for row in measurements[["record_id", "form_factor"]].to_dict("records"):
        if row["record_id"] in forms and row["form_factor"] != forms[row["record_id"]]:
            raise ValueError(f"Measurement specimen form differs from record: {row['record_id']}")
