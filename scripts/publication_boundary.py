"""Keep acquisition files and restricted-source records out of runtime exports."""
import re
import pandas as pd

PRIVATE_PATH = re.compile(r"(?:file://|/(?:Users|home|private|Volumes|tmp|var)/|[A-Za-z]:\\|(?:^|[\s\"'])\.?/?(?:data/literature|outputs|reports|research)/)")
PRIVATE_PATH_COLUMNS = {"source_document_path", "source_pdf_path", "pdf_path", "document_path", "local_path", "source_path"}


def restricted_source_ids(records):
    mask = records.astype(str).apply(lambda col: col.str.contains(r"matweb\.com", case=False, regex=True)).any(axis=1)
    return set(records.loc[mask, "record_id"])


def sanitize_runtime_table(frame):
    result = frame.drop(columns=[c for c in frame if c in PRIVATE_PATH_COLUMNS or c.endswith("_local_path")], errors="ignore").copy()
    assert_no_private_paths(result)
    return result


def assert_no_private_paths(frame):
    failures = []
    for col in frame:
        bad = frame[col].fillna("").astype(str).map(lambda value: bool(PRIVATE_PATH.search(value)))
        if bad.any():
            failures.append(f"{col}: {int(bad.sum())} private path values")
    if failures:
        raise ValueError("Runtime export contains private paths: " + "; ".join(failures))


def quarantine_restricted_sources(records, measurements):
    ids = restricted_source_ids(records)
    held = records[records.record_id.isin(ids)].copy()
    held["exclusion_reasons"] = "restricted_source_redistribution_pending_independent_resourcing"
    return records[~records.record_id.isin(ids)].copy(), measurements[~measurements.record_id.isin(ids)].copy(), held
