"""Controlled artifact client for the Carbon Property Tables API v1."""

from __future__ import annotations

import base64
import json
import os
import ssl
from collections.abc import Mapping, Sequence
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi

from ._version import __version__
from .exceptions import CPTError, CPTHTTPError, CPTValidationError
from .models import RenderedFigure, TemporaryPoint

DEFAULT_API_URL = "https://carbonnanotubes.onrender.com/api/v1"


class CPTClient:
    """Create citation-backed figures without downloading canonical point tables."""

    def __init__(self, base_url: str | None = None, *, timeout: float = 60.0, user_agent: str | None = None) -> None:
        configured = base_url or os.environ.get("CPT_API_URL") or DEFAULT_API_URL
        self.base_url = configured.rstrip("/")
        if not self.base_url.endswith("/api/v1"):
            self.base_url = f"{self.base_url}/api/v1"
        self.timeout = timeout
        self.user_agent = user_agent or f"carbon-property-tables-python/{__version__}"
        self._ssl_context = ssl.create_default_context(cafile=certifi.where())

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
            with urlopen(request, timeout=self.timeout, context=self._ssl_context) as response:
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
        """Return the active release identity, hashes, and aggregate counts."""
        return self._request("release")

    def properties(self) -> tuple[dict[str, Any], ...]:
        """Return supported figure-property keys and units."""
        return tuple(self._request("properties").get("properties", []))

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
        formats: Sequence[str] = ("svg",),
        **filters: Any,
    ) -> RenderedFigure:
        """Request a rendered figure and, optionally, at most ten exact top rows."""
        normalized_kind = kind.strip().lower()
        if normalized_kind not in {"scatter", "ranked", "trend", "ashby"}:
            raise CPTValidationError("kind must be 'scatter', 'ranked', 'trend', or 'ashby'.")
        x_key = x.strip()
        y_key = y.strip()
        if not x_key or not y_key or (normalized_kind in {"scatter", "ashby"} and x_key == y_key):
            raise CPTValidationError("x and y must be two different property keys for an x-y figure.")
        if not isinstance(top, int) or top < 0 or top > 10:
            raise CPTValidationError("top must be an integer from 0 to 10.")
        if top_by not in {"auto", "x", "y"}:
            raise CPTValidationError("top_by must be 'auto', 'x', or 'y'.")
        normalized_formats = tuple(dict.fromkeys(str(item).lower() for item in formats))
        if not normalized_formats or any(item not in {"svg", "png", "pdf"} for item in normalized_formats):
            raise CPTValidationError("formats must contain only 'svg', 'png', and/or 'pdf'.")
        reserved = {
            "kind", "x", "y", "x_scale", "y_scale", "top", "top_by", "temporary",
            "selected_record_id", "highlight_record_ids", "formats", "filters", "limit", "after"
        }.intersection(filters)
        if reserved:
            raise CPTValidationError(f"Figure filters cannot override reserved parameters: {', '.join(sorted(reserved))}.")
        if normalized_kind == "ashby":
            log_x = True
            log_y = True
        body: dict[str, Any] = {
            "kind": normalized_kind,
            "x": x_key,
            "y": y_key,
            "x_scale": "log" if log_x else "linear",
            "y_scale": "log" if log_y else "linear",
            "top": top,
            "top_by": top_by,
            "formats": list(normalized_formats),
            "filters": dict(filters),
        }
        if temporary is not None:
            body["temporary"] = {"x": temporary.x, "y": temporary.y, "label": temporary.label}
        payload = self._request("figures", method="POST", body=body)
        images = payload.get("images", {})
        if not isinstance(images, Mapping):
            raise CPTError("CPT API omitted the rendered image package.")
        decoded: dict[str, bytes] = {}
        if isinstance(images.get("svg"), str):
            decoded["svg"] = images["svg"].encode("utf-8")
        for name in ("png", "pdf"):
            encoded = images.get(f"{name}_base64")
            if isinstance(encoded, str):
                try:
                    decoded[name] = base64.b64decode(encoded, validate=True)
                except ValueError as error:
                    raise CPTError(f"CPT API returned invalid {name.upper()} data.") from error
        return RenderedFigure.from_dict(payload, decoded)

    def scatter(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Render a publication-oriented scatter figure."""
        return self.figure("scatter", x, y, **kwargs)

    def ashby(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Render an Ashby comparison with logarithmic axes enforced server-side."""
        return self.figure("ashby", x, y, **kwargs)

    def ranked(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Rank the selected y property for the eligible representative set."""
        return self.figure("ranked", x, y, **kwargs)

    def trend(self, x: str, y: str, **kwargs: Any) -> RenderedFigure:
        """Render the selected y property against publication year."""
        return self.figure("trend", x, y, **kwargs)
