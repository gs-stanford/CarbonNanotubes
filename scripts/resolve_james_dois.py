#!/usr/bin/env python3
"""Resolve DOI candidates for the Bulmer/James meta-analysis workbook references.

The workbook stores row provenance mostly as "YEAR Title" strings rather than DOI
values. This script queries Crossref and OpenAlex, scores title/year agreement,
and writes a reproducible lookup table used by the database importer.

Outputs:
  data/literature/james_reference_doi_lookup.csv
  data/literature/james_unresolved_references.csv
  data/cache/james_reference_doi_cache.json
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import html
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import pandas as pd

try:
    import certifi
except ImportError:  # pragma: no cover - only used when the venv is incomplete.
    certifi = None


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "literature" / "source_files" / "20210409_Metaanalysis_database.xlsx"
OUT = ROOT / "data" / "literature"
CACHE_PATH = ROOT / "data" / "cache" / "james_reference_doi_cache.json"
USER_AGENT = "CNT-property-database-curation/0.1 (mailto:no-email-provided@example.com)"
DOI_RE = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)
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
    text = re.sub(r"^https?://(dx\.)?doi\.org/", "", text, flags=re.I)
    match = DOI_RE.search(text)
    if match:
        text = match.group(0)
    return text.rstrip(" .,)];").lower()


def article_doi(value: Any) -> str | None:
    doi = normalize_doi(value)
    if doi and doi.startswith("10.1021/"):
        doi = re.sub(r"\.s\d+$", "", doi)
    return doi


def is_supplement_doi(value: Any) -> bool:
    doi = normalize_doi(value) or ""
    return bool(re.search(r"\.s\d+$", doi)) or doi.endswith("asupp")


def normalize_title(value: Any) -> str:
    text = clean(value) or ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("_", " ").replace("\n", " ")
    text = re.sub(r"^\s*(?:18|19|20)\d{2}\s+", "", text)
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = re.sub(r"\.\.\.$", "", text)
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def year_hint(value: Any) -> int | None:
    match = re.search(r"(?<!\d)((?:18|19|20)\d{2})(?!\d)", clean(value) or "")
    if not match:
        return None
    return int(match.group(1))


def title_query(value: Any) -> str:
    text = clean(value) or ""
    text = text.replace("_", " ").replace("\n", " ")
    text = re.sub(r"^\s*(?:18|19|20)\d{2}\s+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def score_match(reference: str, candidate_title: Any, candidate_year: Any) -> float:
    ref_title = normalize_title(reference)
    cand_title = normalize_title(candidate_title)
    if not ref_title or not cand_title:
        return 0.0
    similarity = SequenceMatcher(None, ref_title, cand_title).ratio()
    ref_year = year_hint(reference)
    year_score = 0.0
    try:
        cand_year_int = int(float(candidate_year)) if clean(candidate_year) else None
    except ValueError:
        cand_year_int = None
    if ref_year and cand_year_int:
        delta = abs(ref_year - cand_year_int)
        if delta == 0:
            year_score = 0.08
        elif delta == 1:
            year_score = 0.035
        elif delta > 2:
            year_score = -0.08
    return max(0.0, min(1.0, similarity + year_score))


def http_json(url: str, timeout: float = 20.0) -> tuple[int, dict[str, Any] | None, str | None]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            return response.status, json.loads(response.read().decode("utf-8")), None
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            payload = None
        return exc.code, payload, str(exc)
    except Exception as exc:
        return 0, None, str(exc)


def crossref_candidates(reference: str) -> list[dict[str, Any]]:
    query = title_query(reference)
    if not query or query.lower().startswith(("http://", "https://")):
        return []
    params = urllib.parse.urlencode({"query.bibliographic": query, "rows": 5, "select": "DOI,title,container-title,published-print,published-online,published,issued,score"})
    status, payload, error = http_json(f"https://api.crossref.org/works?{params}")
    if status != 200 or not payload:
        return [{"source": "crossref", "api_status": status, "api_error": error}]
    out = []
    for item in (payload.get("message") or {}).get("items", []):
        year = None
        for key in ["published-print", "published-online", "published", "issued"]:
            try:
                year = int(item[key]["date-parts"][0][0])
                break
            except Exception:
                continue
        title = (item.get("title") or [None])[0]
        journal = (item.get("container-title") or [None])[0]
        out.append(
            {
                "source": "crossref",
                "doi": article_doi(item.get("DOI")),
                "doi_original_candidate": normalize_doi(item.get("DOI")),
                "title": clean(title),
                "journal": clean(journal),
                "year": year,
                "api_score": item.get("score"),
                "match_score": score_match(reference, title, year),
                "api_status": status,
                "api_error": None,
            }
        )
    return out


def openalex_candidates(reference: str) -> list[dict[str, Any]]:
    query = title_query(reference)
    if not query or query.lower().startswith(("http://", "https://")):
        return []
    params = urllib.parse.urlencode({"search": query, "per-page": 5})
    status, payload, error = http_json(f"https://api.openalex.org/works?{params}")
    if status != 200 or not payload:
        return [{"source": "openalex", "api_status": status, "api_error": error}]
    out = []
    for item in payload.get("results", []):
        source = ((item.get("primary_location") or {}).get("source") or {})
        title = item.get("display_name")
        year = item.get("publication_year")
        out.append(
            {
                "source": "openalex",
                "doi": article_doi(item.get("doi")),
                "doi_original_candidate": normalize_doi(item.get("doi")),
                "title": clean(title),
                "journal": clean(source.get("display_name")),
                "year": year,
                "api_score": item.get("relevance_score"),
                "match_score": score_match(reference, title, year),
                "api_status": status,
                "api_error": None,
            }
        )
    return out


def accept_candidate(candidate: dict[str, Any], reference: str) -> bool:
    score = float(candidate.get("match_score") or 0)
    ref_year = year_hint(reference)
    cand_year = candidate.get("year")
    try:
        cand_year_int = int(float(cand_year)) if clean(cand_year) else None
    except ValueError:
        cand_year_int = None
    year_conflict = bool(ref_year and cand_year_int and abs(ref_year - cand_year_int) > 1)
    year_ok = not year_conflict
    return bool(candidate.get("doi")) and score >= 0.88 and year_ok


def candidate_rank(candidate: dict[str, Any]) -> float:
    score = float(candidate.get("match_score") or 0)
    if clean(candidate.get("journal")):
        score += 0.015
    if clean(candidate.get("year")):
        score += 0.01
    if is_supplement_doi(candidate.get("doi_original_candidate") or candidate.get("doi")):
        score -= 0.03
    return score


def load_cache() -> dict[str, Any]:
    if not CACHE_PATH.exists():
        return {}
    return json.loads(CACHE_PATH.read_text(encoding="utf-8"))


def cache_entry_usable(candidates: Any) -> bool:
    if not isinstance(candidates, list) or not candidates:
        return False
    return any(candidate.get("doi") or candidate.get("api_status") not in {0, None} for candidate in candidates if isinstance(candidate, dict))


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing source workbook: {SOURCE}", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    df = pd.read_excel(SOURCE, sheet_name="Main")
    refs = df["Reference"].dropna().astype(str).str.strip()
    counts = refs.value_counts()
    cache = load_cache()
    rows: list[dict[str, Any]] = []

    for reference, count in counts.items():
        reference = clean(reference)
        if not reference:
            continue
        query = title_query(reference)
        if reference.lower().startswith(("http://", "https://")):
            rows.append(
                {
                    "reference_raw": reference,
                    "reference_normalized": normalize_title(reference),
                    "row_count": int(count),
                    "year_hint": year_hint(reference),
                    "query_title": query,
                    "resolved_doi": None,
                    "resolved_title": None,
                    "resolved_journal": None,
                    "resolved_year": None,
                    "resolved_source": None,
                    "match_score": 0,
                    "resolution_status": "web_or_specsheet_reference",
                    "candidate_json": "[]",
                }
            )
            continue
        if query.lower() in {"need a reference", "need reference"} or len(normalize_title(query)) < 16:
            rows.append(
                {
                    "reference_raw": reference,
                    "reference_normalized": normalize_title(reference),
                    "row_count": int(count),
                    "year_hint": year_hint(reference),
                    "query_title": query,
                    "resolved_doi": None,
                    "resolved_title": None,
                    "resolved_journal": None,
                    "resolved_year": None,
                    "resolved_source": None,
                    "match_score": 0,
                    "resolution_status": "insufficient_reference_text",
                    "candidate_json": "[]",
                }
            )
            continue

        if reference in cache and cache_entry_usable(cache[reference]):
            candidates = cache[reference]
        else:
            candidates = crossref_candidates(reference)
            time.sleep(0.08)
            candidates += openalex_candidates(reference)
            time.sleep(0.08)
            cache[reference] = candidates
            save_cache(cache)

        candidates = [candidate for candidate in candidates if candidate.get("doi")]
        candidates = sorted(candidates, key=candidate_rank, reverse=True)
        accepted_best = next((candidate for candidate in candidates if accept_candidate(candidate, reference)), None)
        best = accepted_best or (candidates[0] if candidates else {})
        accepted = bool(accepted_best)
        rows.append(
            {
                "reference_raw": reference,
                "reference_normalized": normalize_title(reference),
                "row_count": int(count),
                "year_hint": year_hint(reference),
                "query_title": query,
                "resolved_doi": best.get("doi") if accepted else None,
                "resolved_title": best.get("title") if accepted else None,
                "resolved_journal": best.get("journal") if accepted else None,
                "resolved_year": best.get("year") if accepted else None,
                "resolved_source": best.get("source") if accepted else None,
                "match_score": round(float(best.get("match_score") or 0), 4) if best else 0,
                "resolution_status": "accepted" if accepted else ("candidate_below_threshold" if candidates else "no_candidate"),
                "candidate_json": json.dumps(candidates[:5], ensure_ascii=False),
            }
        )

    lookup = pd.DataFrame(rows).sort_values(["resolution_status", "row_count", "reference_raw"], ascending=[True, False, True])
    lookup.to_csv(OUT / "james_reference_doi_lookup.csv", index=False)
    unresolved = lookup[lookup["resolution_status"].ne("accepted")].copy()
    unresolved.to_csv(OUT / "james_unresolved_references.csv", index=False)
    summary = {
        "unique_references": int(len(lookup)),
        "accepted": int(lookup["resolution_status"].eq("accepted").sum()),
        "unresolved": int(lookup["resolution_status"].ne("accepted").sum()),
        "rows_covered_by_accepted": int(lookup.loc[lookup["resolution_status"].eq("accepted"), "row_count"].sum()),
        "rows_unresolved": int(lookup.loc[lookup["resolution_status"].ne("accepted"), "row_count"].sum()),
        "outputs": [
            "data/literature/james_reference_doi_lookup.csv",
            "data/literature/james_unresolved_references.csv",
            "data/cache/james_reference_doi_cache.json",
        ],
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
