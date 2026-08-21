"""Controlled figure client for the Carbon Property Tables API v1."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping, Sequence
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from ._version import __version__
from .exceptions import CPTError, CPTHTTPError, CPTValidationError
from .models import CitationBundle, CitationEntry, PlotResult, RenderedFigure, TemporaryPoint
from .plotting import render_figure, representative_points


class CPTClient:
    """Create citation-backed figures without exposing the full canonical table."""

    def __init__(self, base_url: str | None = None, *, timeout: float = 30.0, user_agent: str | None = None) -> None:
        configured = base_url or os.environ.get("CPT_API_URL") or "http://localhost:3000/api/v1"
        self.base_url = configured.rstrip("/")
        if not self.base_url.endswith("/api/v1"):
            self.base_url = f"{self.base_url}/api/v1"
        self.timeout = timeout
        self.user_agent = user_agent or f"carbon-property-tables-python/{__version__}"

    def _request(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        method: str = "GET",
        body: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        encoded = self._encode_params(params or {})
        url = f"{self.base_url}/{path.lstrip('/')}"
        if encoded:
            url = f"{url}?{encoded}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = Request(
            url,
            data=data,
            method=method,
            headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": self.user_agent},
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            try:
                payload = json.loads(error.read().decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = None
            message = self._error_message(payload) or error.reason or "request failed"
            raise CPTHTTPError(error.code, str(message), payload) from error
        except URLError as error:
            raise CPTError(f"Could not reach CPT API at {self.base_url}: {error.reason}") from error
        except json.JSONDecodeError as error:
            raise CPTError("CPT API returned invalid JSON.") from error
        if not isinstance(payload, dict):
            raise CPTError("CPT API returned a non-object JSON response.")
        return payload

    @staticmethod
    def _error_message(payload: object) -> str | None:
        if not isinstance(payload, Mapping):
            return None
        error = payload.get("error")
        return str(error.get("message")) if isinstance(error, Mapping) and error.get("message") else None

    @staticmethod
    def _encode_params(params: Mapping[str, Any]) -> str:
        pairs: list[tuple[str, str]] = []
        for key, value in params.items():
            if value is None:
                continue
            if isinstance(value, bool):
                pairs.append((key, "true" if value else "false"))
            elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
                pairs.extend((key, str(item)) for item in value)
            else:
                pairs.append((key, str(value)))
        return urlencode(pairs, doseq=True)

    def release(self) -> dict[str, Any]:
        """Return the active release identity, hashes, and aggregate row counts."""
        return self._request("release")

    def properties(self) -> tuple[dict[str, Any], ...]:
        """Return supported plot-property keys and their units."""
        return tuple(self._request("properties").get("properties", []))

    def _plot_result(self, x: str, y: str, filters: Mapping[str, Any]) -> PlotResult:
        x_key = x.strip()
        y_key = y.strip()
        if not x_key or not y_key or x_key == y_key:
            raise CPTValidationError("x and y must be two different property keys.")
        reserved = {"x", "y", "limit", "after"}.intersection(filters)
        if reserved:
            names = ", ".join(sorted(reserved))
            raise CPTValidationError(f"Figure filters cannot override reserved parameters: {names}.")
        payload = self._request("plot", params={"x": x_key, "y": y_key, "limit": 2000, **filters})
        result = PlotResult.from_dict(payload)
        if result.has_more:
            raise CPTError(
                "The requested figure exceeds the API's complete-result limit. "
                "Narrow the material, form-factor, year, or measurement filters."
            )
        return result

    def _citation_bundle(self, record_ids: Sequence[str]) -> CitationBundle:
        if not record_ids:
            return CitationBundle.from_dict(None)
        merged: dict[str, CitationEntry] = {}
        requirement = ""
        style = "nature"
        for start in range(0, len(record_ids), 500):
            chunk = list(dict.fromkeys(record_ids[start : start + 500]))
            payload = self._request("citations", method="POST", body={"record_ids": chunk})
            bundle = CitationBundle.from_dict(payload.get("citations"))
            requirement = requirement or bundle.requirement
            style = bundle.style or style
            for entry in bundle.entries:
                existing = merged.get(entry.citation_id)
                if existing is None:
                    merged[entry.citation_id] = entry
                    continue
                merged[entry.citation_id] = CitationEntry(
                    citation_id=existing.citation_id,
                    roles=tuple(dict.fromkeys((*existing.roles, *entry.roles))),
                    doi=existing.doi or entry.doi,
                    text=existing.text or entry.text,
                    bibtex=existing.bibtex or entry.bibtex,
                    record_ids=tuple(dict.fromkeys((*existing.record_ids, *entry.record_ids))),
                )
        ordered = list(merged.values())
        entries = tuple(
            [entry for entry in ordered if "atlas" not in entry.roles]
            + [entry for entry in ordered if "atlas" in entry.roles]
        )
        return CitationBundle(
            requirement=requirement,
            style=style,
            entries=entries,
            copy_all="\n".join(f"{index}. {entry.text}" for index, entry in enumerate(entries, start=1)),
            bibtex="\n\n".join(entry.bibtex for entry in entries if entry.bibtex),
        )

    def figure(
        self,
        kind: str,
        x: str,
        y: str,
        *,
        top: int = 0,
        top_by: str = "auto",
        temporary: TemporaryPoint | None = None,
        log_x: bool = False,
        log_y: bool = False,
        colors: Mapping[str, str] | None = None,
        **filters: Any,
    ) -> RenderedFigure:
        """Render a bounded figure package for one same-record property pairing."""
        normalized_kind = kind.strip().lower()
        if normalized_kind not in {"scatter", "ranked", "ashby"}:
            raise CPTValidationError("kind must be 'scatter', 'ranked', or 'ashby'.")
        result = self._plot_result(x, y, filters)
        selected = representative_points(result.points, x.strip(), y.strip(), normalized_kind)
        citations = self._citation_bundle([point.record_id for point in selected])
        return render_figure(
            selected,
            citations,
            kind=normalized_kind,
            x_property=x.strip(),
            y_property=y.strip(),
            top=top,
            top_by=top_by,
            temporary=temporary,
            log_x=log_x,
            log_y=log_y,
            colors=colors,
            release=result.release,
            points_are_representative=True,
        )

    def scatter(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Render a publication-oriented scatter figure."""
        return self.figure("scatter", x, y, **kwargs)

    def ashby(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Render an Ashby-style comparison with logarithmic axes enforced."""
        kwargs["log_x"] = True
        kwargs["log_y"] = True
        return self.figure("ashby", x, y, **kwargs)

    def ranked(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Rank the y property across records that also contain the x property."""
        return self.figure("ranked", x, y, **kwargs)
