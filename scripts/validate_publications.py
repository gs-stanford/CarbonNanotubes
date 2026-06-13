#!/usr/bin/env python3
"""Validate and enrich publication rows with Crossref/OpenAlex metadata.

Inputs:
  data/processed/publications.csv

Outputs:
  data/processed/publications_enriched.csv
  data/processed/doi_validation_results.csv
  data/cache/doi_validation_cache.json
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import pandas as pd

try:
    import certifi
except ImportError:  # pragma: no cover - only used when the venv is incomplete.
    certifi = None


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
CACHE_DIR = ROOT / "data" / "cache"
CACHE_PATH = CACHE_DIR / "doi_validation_cache.json"

DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)
USER_AGENT = "CNT-property-database-curation/0.1 (mailto:no-email-provided@example.com)"
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where()) if certifi else None


def clean(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    return text


def normalize_doi(value: Any) -> str | None:
    text = clean(value)
    if not text:
        return None
    text = urllib.parse.unquote(text)
    text = re.sub(r"^doi:\s*", "", text, flags=re.I)
    text = re.sub(r"^https?://(dx\.)?doi\.org/", "", text, flags=re.I)
    text = re.sub(r"^https?://(?:www\.)?science\.org/doi/(?:epdf/|abs/|full/)?", "", text, flags=re.I)
    match = DOI_RE.search(text)
    if match:
        text = match.group(0)
    text = text.rstrip(" .,)];")
    return text.lower()


def date_from_parts(parts: Any) -> str | None:
    try:
        values = parts["date-parts"][0]
    except (TypeError, KeyError, IndexError):
        return None
    if not values:
        return None
    year = int(values[0])
    month = int(values[1]) if len(values) > 1 else 1
    day = int(values[2]) if len(values) > 2 else 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def year_from_date(date_text: str | None) -> int | None:
    if not date_text:
        return None
    match = re.match(r"^(\d{4})", str(date_text))
    return int(match.group(1)) if match else None


def first(values: Any) -> Any:
    if isinstance(values, list) and values:
        return values[0]
    return None


def authors_short_crossref(authors: Any) -> str | None:
    if not isinstance(authors, list) or not authors:
        return None
    names = []
    for author in authors[:3]:
        given = clean(author.get("given"))
        family = clean(author.get("family"))
        name = " ".join(part for part in [given, family] if part)
        if name:
            names.append(name)
    if not names:
        return None
    return f"{names[0]} et al." if len(authors) > 1 else names[0]


def authors_full_crossref(authors: Any) -> str | None:
    if not isinstance(authors, list) or not authors:
        return None
    names = []
    for author in authors:
        given = clean(author.get("given"))
        family = clean(author.get("family"))
        name = " ".join(part for part in [given, family] if part)
        if name:
            names.append(name)
    return "; ".join(names) if names else None


def authors_short_openalex(authorships: Any) -> str | None:
    if not isinstance(authorships, list) or not authorships:
        return None
    names = []
    for authorship in authorships[:3]:
        author = authorship.get("author") or {}
        name = clean(author.get("display_name"))
        if name:
            names.append(name)
    if not names:
        return None
    return f"{names[0]} et al." if len(authorships) > 1 else names[0]


def authors_full_openalex(authorships: Any) -> str | None:
    if not isinstance(authorships, list) or not authorships:
        return None
    names = []
    for authorship in authorships:
        author = authorship.get("author") or {}
        name = clean(author.get("display_name"))
        if name:
            names.append(name)
    return "; ".join(names) if names else None


def http_json(url: str, timeout: float = 20.0) -> tuple[int, dict[str, Any] | None, str | None]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status, payload, None
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            payload = None
        return exc.code, payload, str(exc)
    except Exception as exc:
        return 0, None, str(exc)


def fetch_crossref(doi: str) -> dict[str, Any]:
    url = f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='')}"
    status, payload, error = http_json(url)
    result: dict[str, Any] = {"status_code": status, "error": error}
    if status == 200 and payload and isinstance(payload.get("message"), dict):
        msg = payload["message"]
        published_date = (
            date_from_parts(msg.get("published-print"))
            or date_from_parts(msg.get("published-online"))
            or date_from_parts(msg.get("published"))
            or date_from_parts(msg.get("issued"))
        )
        page = clean(msg.get("page"))
        volume = clean(msg.get("volume"))
        issue = clean(msg.get("issue"))
        issue_pages = ", ".join(part for part in [volume, issue, page] if part) or None
        result.update(
            {
                "found": True,
                "doi": normalize_doi(msg.get("DOI")) or doi,
                "title": clean(first(msg.get("title"))),
                "journal": clean(first(msg.get("container-title")) or first(msg.get("short-container-title"))),
                "publisher": clean(msg.get("publisher")),
                "type": clean(msg.get("type")),
                "authors_short": authors_short_crossref(msg.get("author")),
                "authors_full": authors_full_crossref(msg.get("author")),
                "published_date": published_date,
                "year": year_from_date(published_date),
                "issue_pages": issue_pages,
                "is_referenced_by_count": msg.get("is-referenced-by-count"),
                "url": clean(msg.get("URL")),
            }
        )
    else:
        result["found"] = False
    return result


def fetch_openalex(doi: str) -> dict[str, Any]:
    url = f"https://api.openalex.org/works/doi:{urllib.parse.quote(doi, safe='/:._;()')}"
    status, payload, error = http_json(url)
    result: dict[str, Any] = {"status_code": status, "error": error}
    if status == 200 and payload:
        source = ((payload.get("primary_location") or {}).get("source") or {})
        result.update(
            {
                "found": True,
                "doi": normalize_doi(payload.get("doi")) or doi,
                "title": clean(payload.get("display_name")),
                "journal": clean(source.get("display_name")),
                "publisher": clean(source.get("host_organization_name")),
                "type": clean(payload.get("type")),
                "authors_short": authors_short_openalex(payload.get("authorships")),
                "authors_full": authors_full_openalex(payload.get("authorships")),
                "published_date": clean(payload.get("publication_date")),
                "year": payload.get("publication_year"),
                "issue_pages": None,
                "is_referenced_by_count": payload.get("cited_by_count"),
                "url": clean(payload.get("id")),
                "openalex_id": clean(payload.get("id")),
            }
        )
    else:
        result["found"] = False
    return result


def load_cache() -> dict[str, Any]:
    if not CACHE_PATH.exists():
        return {}
    return json.loads(CACHE_PATH.read_text(encoding="utf-8"))


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")


def validate_doi(doi: str, cache: dict[str, Any], offline: bool = False, sleep_s: float = 0.1) -> dict[str, Any]:
    key = normalize_doi(doi)
    if not key:
        return {"doi": None, "validation_status_enriched": "missing_doi"}
    if key in cache:
        cached_status = cache[key].get("validation_status_enriched")
        if offline or cached_status not in {"api_error", "not_found_or_api_error"}:
            return cache[key]
    if offline:
        return {"doi": key, "validation_status_enriched": "not_checked_offline"}
    crossref = fetch_crossref(key)
    time.sleep(sleep_s)
    openalex = fetch_openalex(key)
    time.sleep(sleep_s)
    crossref_found = bool(crossref.get("found"))
    openalex_found = bool(openalex.get("found"))
    if crossref_found and openalex_found:
        status = "verified_crossref_openalex"
    elif crossref_found:
        status = "verified_crossref"
    elif openalex_found:
        status = "verified_openalex"
    elif crossref.get("status_code") == 404 and openalex.get("status_code") == 404:
        status = "not_found"
    elif crossref.get("status_code") == 0 or openalex.get("status_code") == 0:
        status = "api_error"
    else:
        status = "not_found_or_api_error"
    result = {
        "doi": key,
        "validation_status_enriched": status,
        "crossref": crossref,
        "openalex": openalex,
        "checked_utc": pd.Timestamp.utcnow().isoformat(),
    }
    cache[key] = result
    return result


def choose(primary: Any, secondary: Any, fallback: Any = None) -> Any:
    return clean(primary) or clean(secondary) or clean(fallback)


def flatten_result(pub_row: pd.Series, validation: dict[str, Any]) -> dict[str, Any]:
    crossref = validation.get("crossref") or {}
    openalex = validation.get("openalex") or {}
    doi = normalize_doi(pub_row.get("doi")) or validation.get("doi")
    has_doi = bool(doi)
    if not has_doi:
        status = "url_or_citation_only_not_doi_validated"
    else:
        status = validation.get("validation_status_enriched", "not_checked")
    return {
        "publication_id": pub_row.get("publication_id"),
        "doi_input": normalize_doi(pub_row.get("doi")),
        "doi_verified": choose(crossref.get("doi"), openalex.get("doi"), doi),
        "url_input": clean(pub_row.get("url")),
        "title_input": clean(pub_row.get("title")),
        "title_verified": choose(crossref.get("title"), openalex.get("title"), pub_row.get("title")),
        "authors_short_verified": choose(crossref.get("authors_short"), openalex.get("authors_short"), pub_row.get("authors_short")),
        "authors_full_verified": choose(crossref.get("authors_full"), openalex.get("authors_full")),
        "journal_verified": choose(crossref.get("journal"), openalex.get("journal"), pub_row.get("journal")),
        "publisher_verified": choose(crossref.get("publisher"), openalex.get("publisher")),
        "type_verified": choose(crossref.get("type"), openalex.get("type")),
        "year_verified": crossref.get("year") or openalex.get("year") or pub_row.get("year"),
        "published_date_verified": choose(crossref.get("published_date"), openalex.get("published_date"), pub_row.get("published_date")),
        "issue_pages_verified": choose(crossref.get("issue_pages"), openalex.get("issue_pages"), pub_row.get("issue_pages")),
        "citation_count_crossref": crossref.get("is_referenced_by_count"),
        "citation_count_openalex": openalex.get("is_referenced_by_count"),
        "openalex_id": openalex.get("openalex_id"),
        "crossref_status_code": crossref.get("status_code"),
        "openalex_status_code": openalex.get("status_code"),
        "validation_status_enriched": status,
        "source_record_count": pub_row.get("source_record_count"),
        "citation_raw_examples": pub_row.get("citation_raw_examples"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Use cache only; do not call Crossref/OpenAlex.")
    parser.add_argument("--limit", type=int, default=None, help="Validate only the first N publication rows.")
    parser.add_argument("--sleep", type=float, default=0.1, help="Seconds to sleep between API calls.")
    args = parser.parse_args()

    input_path = PROCESSED / "publications.csv"
    if not input_path.exists():
        print(f"Missing input: {input_path}", file=sys.stderr)
        return 1

    pubs = pd.read_csv(input_path)
    if args.limit:
        pubs_to_validate = pubs.head(args.limit).copy()
    else:
        pubs_to_validate = pubs.copy()

    cache = load_cache()
    validation_rows = []
    enriched_rows = []
    for _, row in pubs_to_validate.iterrows():
        doi = normalize_doi(row.get("doi"))
        if doi:
            validation = validate_doi(doi, cache, offline=args.offline, sleep_s=args.sleep)
        else:
            validation = {"doi": None, "validation_status_enriched": "url_or_citation_only_not_doi_validated"}
        validation_rows.append(
            {
                "publication_id": row.get("publication_id"),
                "doi": doi,
                "validation_status_enriched": validation.get("validation_status_enriched"),
                "crossref_found": bool((validation.get("crossref") or {}).get("found")),
                "openalex_found": bool((validation.get("openalex") or {}).get("found")),
                "crossref_status_code": (validation.get("crossref") or {}).get("status_code"),
                "openalex_status_code": (validation.get("openalex") or {}).get("status_code"),
            }
        )
        enriched_rows.append(flatten_result(row, validation))

    save_cache(cache)
    enriched_df = pd.DataFrame(enriched_rows)
    validation_df = pd.DataFrame(validation_rows)

    enriched_df.to_csv(PROCESSED / "publications_enriched.csv", index=False)
    validation_df.to_csv(PROCESSED / "doi_validation_results.csv", index=False)

    summary = {
        "publications_input": len(pubs),
        "publications_checked": len(pubs_to_validate),
        "validation_status_counts": validation_df["validation_status_enriched"].value_counts(dropna=False).to_dict(),
        "outputs": ["publications_enriched.csv", "doi_validation_results.csv", str(CACHE_PATH.relative_to(ROOT))],
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
