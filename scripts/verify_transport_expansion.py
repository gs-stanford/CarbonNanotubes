#!/usr/bin/env python3
"""Verify additive publication, record, value and provenance preservation."""
import json
import math
import csv

import pandas as pd

from admit_transport_expansion import OUT, ROOT, build_packets, digest, write_json, FIELDS


def verify():
    errors = []
    baseline = OUT / "baseline"
    hashes = json.loads((baseline / "sha256.json").read_text())
    before, after = {}, {}
    for kind in ("records", "measurements", "publications"):
        filename = f"public_{kind}_v0.csv"
        assert digest(baseline / filename) == hashes[filename], "Frozen baseline changed"
        before[kind] = pd.read_csv(baseline / filename, keep_default_na=False, low_memory=False)
        after[kind] = pd.read_csv(ROOT / "data/public" / filename, keep_default_na=False, low_memory=False)
        if digest(ROOT / "data/public" / filename) != digest(ROOT / "web/data/public" / filename):
            errors.append(f"Web payload differs: {filename}")
    packets = build_packets()
    # Header expansion must not change any pre-existing value or provenance field.
    with (baseline / "public_measurements_v0.csv").open() as old_handle, (ROOT / "data/public/public_measurements_v0.csv").open() as new_handle:
        old_rows = list(csv.DictReader(old_handle))
        new_rows = {r["measurement_id"]: r for r in csv.DictReader(new_handle)}
    for old in old_rows:
        actual = new_rows.get(old["measurement_id"], {})
        if any(value != actual.get(key) for key, value in old.items()):
            errors.append(f"Existing measurement/provenance field changed: {old['measurement_id']}")
    records = [r for p in packets.values() for r in p["records"]]
    expected = {r["record_id"] for r in records}
    if set(after["records"].record_id) - set(before["records"].record_id) != expected:
        errors.append("Unexpected admission or a missing new state")
    if not set(before["records"].record_id) <= set(after["records"].record_id):
        errors.append("An existing record was lost")
    current = after["measurements"].set_index("measurement_id")
    assert current.index.is_unique
    for _, row in before["measurements"].iterrows():
        if row.measurement_id not in current.index:
            errors.append(f"Existing measurement lost: {row.measurement_id}")
            continue
        actual = current.loc[row.measurement_id]
        if any(row[f] != actual[f] for f in ("record_id", "property", "unit_canonical", "reported_or_derived")) or not math.isclose(float(row.value_canonical), float(actual.value_canonical), rel_tol=1e-12):
            errors.append(f"Existing measurement changed: {row.measurement_id}")
    by_prop = after["measurements"].set_index(["record_id", "property"])
    for r in records:
        for prop, m in r["measurement_metadata"].items():
            key = (r["record_id"], prop)
            if key not in by_prop.index:
                errors.append(f"New measurement missing: {key}")
                continue
            actual = by_prop.loc[key]
            if not math.isclose(float(actual.value_canonical), r["values"][FIELDS[prop]], rel_tol=1e-12):
                errors.append(f"Incorrect new value: {key}")
            for field in ("source_document_sha256", "source_locator", "source_qualification", "reported_or_derived"):
                if actual[field] != m[field]:
                    errors.append(f"Lost provenance: {key}/{field}")
    result = {"status": "fail" if errors else "pass", "errors": errors,
              "before": {k: len(v) for k, v in before.items()}, "after": {k: len(v) for k, v in after.items()},
              "public_measurements_sha256": digest(ROOT / "data/public/public_measurements_v0.csv"),
              "all_prior_measurement_fields_unchanged": not any("field changed" in error for error in errors),
              "deployment_verified": False}
    write_json(OUT / "verification.json", result)
    print(json.dumps(result, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    verify()
