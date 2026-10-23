#!/usr/bin/env python3
"""Freeze old values, then verify an additive primary-data release and web parity."""
import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs/primary_release_20261022"
BASELINE = OUT / "baseline.json"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read():
    return {kind: pd.read_csv(ROOT / f"data/public/public_{kind}_v0.csv", keep_default_na=False)
            for kind in ["records", "measurements", "publications"]}


def run(snapshot=False):
    data = read()
    OUT.mkdir(parents=True, exist_ok=True)
    if snapshot:
        if BASELINE.exists():
            raise SystemExit("Baseline already exists; refusing to overwrite historical evidence")
        payload = dict(counts={k: len(v) for k, v in data.items()},
            file_hashes={k: digest(ROOT / f"data/public/public_{k}_v0.csv") for k in data},
            record_ids=data["records"].record_id.tolist(),
            measurements=data["measurements"][["measurement_id", "record_id", "property",
                "value_canonical", "unit_canonical", "reported_or_derived"]].to_dict("records"))
        BASELINE.write_text(json.dumps(payload, indent=2)+"\n")
        print(json.dumps(payload["counts"]))
        return
    before = json.loads(BASELINE.read_text())
    errors = []
    records, measurements = data["records"], data["measurements"]
    if not set(before["record_ids"]).issubset(set(records.record_id)):
        errors.append("Existing public records disappeared")
    indexed = measurements.set_index("measurement_id")
    for old in before["measurements"]:
        mid = old["measurement_id"]
        if mid not in indexed.index:
            errors.append(f"Existing measurement disappeared: {mid}")
            continue
        new = indexed.loc[mid]
        for key in ["record_id", "property", "unit_canonical", "reported_or_derived"]:
            if old[key] != new[key]:
                errors.append(f"Existing {mid}/{key} changed")
        if abs(float(old["value_canonical"])-float(new.value_canonical)) > max(abs(float(old["value_canonical"]))*1e-12, 1e-30):
            errors.append(f"Existing measurement value changed: {mid}")
    packets = [json.loads(p.read_text()) for p in sorted((ROOT / "data/curation/primary_additions").glob("*.json"))]
    additions = [r for p in packets for r in p["records"]]
    expected = {r["record_id"] for r in additions}
    actual = set(records.record_id)-set(before["record_ids"])
    if expected != actual:
        errors.append(f"Added identities differ: missing={sorted(expected-actual)}, unexpected={sorted(actual-expected)}")
    joined = measurements[measurements.record_id.isin(expected)]
    for record in additions:
        subset = joined[joined.record_id.eq(record["record_id"])]
        for prop, meta in record["measurement_metadata"].items():
            row = subset[subset.property.eq(prop)]
            if len(row) != 1:
                errors.append(f"Measurement missing/duplicated: {record['record_id']}/{prop}")
                continue
            row = row.iloc[0]
            for key in ["reported_unit", "uncertainty_type", "source_locator", "source_qualification"]:
                if key == "source_qualification" and not meta.get(key):
                    continue
                if str(row[key]) != str(meta.get(key) or ""):
                    errors.append(f"Metadata lost: {record['record_id']}/{prop}/{key}")
            if meta.get("sample_size_n") is None and row.sample_size_n != "":
                errors.append(f"Sample count invented: {record['record_id']}/{prop}")
        new_record = records[records.record_id.eq(record["record_id"])].iloc[0]
        if str(new_record.strict_comparison_ready).lower() == "true":
            errors.append("Unverified specimen linkage promoted to strict")
        if new_record.primary_source_verification_status != "ai_source_checked_not_human_adjudicated":
            errors.append("AI review incorrectly promoted")
    for kind in data:
        path = f"public_{kind}_v0.csv"
        if digest(ROOT / "data/public" / path) != digest(ROOT / "web/data/public" / path):
            errors.append(f"Website data stale: {path}")
    if measurements.duplicated(["record_id", "property"]).any():
        errors.append("Duplicate measurement identity")
    report = dict(status="pass" if not errors else "fail", errors=errors,
        before_counts=before["counts"], after_counts={k: len(v) for k,v in data.items()},
        added_records=len(actual), added_measurements=len(joined),
        publication_counts={p.get("doi", p["records"][0]["doi_raw"]): len(p["records"]) for p in packets},
        source_hashes={k: digest(ROOT / f"data/public/public_{k}_v0.csv") for k in data},
        review_status="source-audited by AI; no independent human adjudication asserted",
        deployment_status="Repository/web payload verified; this receipt does not establish live deployment")
    (OUT / "verification.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true")
    run(parser.parse_args().snapshot)
