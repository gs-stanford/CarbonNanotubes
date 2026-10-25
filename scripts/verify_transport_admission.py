#!/usr/bin/env python3
"""Check additive admission against the immutable, pre-change local release."""
import hashlib
import csv
import json
import math

import pandas as pd

from admit_transport_records import DECISIONS, FIELDS, OUT, ROOT, STAGED


def main():
    errors = []
    old, new = {}, {}
    hashes = json.loads((OUT / "baseline/sha256.json").read_text())
    for kind in ("records", "measurements", "publications"):
        name = f"public_{kind}_v0.csv"
        if hashlib.sha256((OUT / "baseline" / name).read_bytes()).hexdigest() != hashes[name]:
            errors.append(f"Pre-admission baseline changed: {name}")
        old[kind] = pd.read_csv(OUT / "baseline" / name, keep_default_na=False, low_memory=False)
        new[kind] = pd.read_csv(ROOT / "data/public" / name, keep_default_na=False, low_memory=False)
        if (ROOT / "data/public" / name).read_bytes() != (ROOT / "web/data/public" / name).read_bytes():
            errors.append(f"Website payload mismatch: {name}")
    if not set(old["records"].record_id) <= set(new["records"].record_id):
        errors.append("An existing public record was lost")
    current = new["measurements"].set_index("measurement_id")
    if not current.index.is_unique:
        errors.append("Duplicate measurement identities")
    for _, before in old["measurements"].iterrows():
        mid = before.measurement_id
        if mid not in current.index:
            errors.append(f"Existing measurement lost: {mid}")
            continue
        after = current.loc[mid]
        for field in ("record_id", "property", "unit_canonical", "reported_or_derived"):
            if before[field] != after[field]:
                errors.append(f"Existing measurement changed: {mid}/{field}")
        if not math.isclose(float(before.value_canonical), float(after.value_canonical), rel_tol=1e-12):
            errors.append(f"Existing value changed: {mid}")
    decisions = json.loads(DECISIONS.read_text())
    public = new["records"].set_index("record_id")
    by_prop = new["measurements"].set_index(["record_id", "property"])
    admitted = []
    for name in decisions["admit"]:
        path = ROOT / f"data/curation/primary_additions/transport_{name}.json"
        packet = json.loads(path.read_text())
        for r in packet["records"]:
            if r["record_id"] not in public.index:
                errors.append(f"Admitted record absent from public release: {r['record_id']}")
                continue
            for prop, meta in r["measurement_metadata"].items():
                key = (r["record_id"], prop)
                if key not in by_prop.index:
                    errors.append(f"Missing admitted property: {key}")
                    continue
                actual = by_prop.loc[key]
                if not math.isclose(float(actual.value_canonical), r["values"][FIELDS[prop]], rel_tol=1e-12):
                    errors.append(f"Changed admitted value: {key}")
                for field in ("source_locator", "source_document_sha256", "source_qualification", "reported_or_derived"):
                    if actual[field] != meta[field]:
                        errors.append(f"Lost qualification: {key}/{field}")
            admitted.append({"record_id": r["record_id"], "doi": r["doi_raw"], "state": r["stable_cohort"]})
    expected_ids = {r["record_id"] for r in admitted}
    if set(new["records"].record_id) - set(old["records"].record_id) != expected_ids:
        errors.append("Unexpected public record additions outside the reviewed decisions")
    with (STAGED.parent / "admission_manifest.csv").open() as handle:
        staged = {r["staging_id"] for r in csv.DictReader(handle)}
    decisions_by_id = {f"{r['doi']}|{r['state']}": "admitted" for r in admitted}
    decisions_by_id.update({r["state"]: "held" for r in decisions["holds"]})
    if staged - decisions_by_id.keys():
        errors.append("Some staged records have no explicit disposition")
    report = {"status": "fail" if errors else "pass", "errors": errors,
              "before": {k: len(v) for k, v in old.items()}, "after": {k: len(v) for k, v in new.items()},
              "admitted": admitted, "holds": decisions["holds"],
              "staged_dispositions": {key: decisions_by_id.get(key, "missing") for key in sorted(staged)},
              "public_measurements_sha256": hashlib.sha256((ROOT / "data/public/public_measurements_v0.csv").read_bytes()).hexdigest(),
              "deployment_verified": False}
    (OUT / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "admitted"}, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
