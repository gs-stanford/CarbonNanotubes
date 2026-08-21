"""HTTP client for Carbon Property Tables API v1."""

from __future__ import annotations

import json
import os
from collections.abc import Iterator, Mapping, Sequence
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from ._version import __version__
from .exceptions import CPTError, CPTHTTPError, CPTValidationError
from .models import CitationBundle, PlotResult, Record, RecordPage


class CPTClient:
    """Read-only client for canonical property records and citation bundles."""

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
        """Return the active release identity, hashes, and row counts."""
        return self._request("release")

    def properties(self) -> tuple[dict[str, Any], ...]:
        """Return property keys and their canonical/display units."""
        return tuple(self._request("properties").get("properties", []))

    def records(self, **filters: Any) -> RecordPage:
        """Return one bounded page of canonical records."""
        return RecordPage.from_dict(self._request("records", params=filters))

    def iter_records(self, **filters: Any) -> Iterator[Record]:
        """Iterate through all pages matching the supplied filters."""
        after = filters.pop("after", None)
        while True:
            page = self.records(after=after, **filters)
            yield from page.records
            if not page.has_more or not page.next_cursor:
                return
            after = page.next_cursor

    def record(self, record_id: str) -> Record:
        """Retrieve one record by immutable record ID."""
        clean = record_id.strip()
        if not clean:
            raise CPTValidationError("record_id cannot be empty.")
        payload = self._request(f"records/{quote(clean, safe='')}")
        return Record.from_dict(payload["record"])

    def plot_data(self, x: str, y: str, **filters: Any) -> PlotResult:
        """Retrieve same-record paired measurements and a complete citation bundle."""
        if not x.strip() or not y.strip() or x == y:
            raise CPTValidationError("x and y must be two different property keys.")
        return PlotResult.from_dict(self._request("plot", params={"x": x, "y": y, **filters}))

    def citations(self, record_ids: Sequence[str]) -> CitationBundle:
        """Return deduplicated Nature-style and BibTeX citations for records."""
        ids = [record_id.strip() for record_id in record_ids if record_id.strip()]
        if not ids:
            raise CPTValidationError("At least one record_id is required.")
        payload = self._request("citations", method="POST", body={"record_ids": ids})
        return CitationBundle.from_dict(payload.get("citations"))

    def scatter(self, x: str, y: str, **kwargs: Any):
        """Create an optional Matplotlib scatter plot and return (figure, axes, PlotResult)."""
        from .plotting import scatter

        return scatter(self, x, y, **kwargs)
