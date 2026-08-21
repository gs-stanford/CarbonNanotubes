"""Notebook-friendly convenience API for Carbon Property Tables."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from .client import CPTClient
from .exceptions import CPTValidationError
from .models import RenderedFigure


PROPERTY_KEYS = (
    "density",
    "specific_volume",
    "diameter",
    "linear_density",
    "specific_strength",
    "tensile_strength",
    "specific_modulus",
    "initial_modulus",
    "breaking_strain",
    "work_of_rupture",
    "electrical_conductivity",
    "specific_electrical_conductivity",
    "thermal_conductivity",
    "specific_thermal_conductivity",
    "ampacity",
    "g_d_ratio",
)


def _normalize_property_name(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_value.lower()).strip()


_PROPERTY_ALIASES: dict[str, str] = {
    _normalize_property_name(key): key for key in PROPERTY_KEYS
}
_PROPERTY_ALIASES.update(
    {
        "fiber diameter": "diameter",
        "fibre diameter": "diameter",
        "tex": "linear_density",
        "tenacity": "specific_strength",
        "strength": "tensile_strength",
        "youngs modulus": "initial_modulus",
        "young modulus": "initial_modulus",
        "elastic modulus": "initial_modulus",
        "stiffness": "initial_modulus",
        "strain at break": "breaking_strain",
        "elongation at break": "breaking_strain",
        "toughness": "work_of_rupture",
        "conductivity": "electrical_conductivity",
        "electrical cond": "electrical_conductivity",
        "ec": "electrical_conductivity",
        "specific conductivity": "specific_electrical_conductivity",
        "specific electrical cond": "specific_electrical_conductivity",
        "specific cond": "specific_electrical_conductivity",
        "sec": "specific_electrical_conductivity",
        "thermal cond": "thermal_conductivity",
        "specific thermal cond": "specific_thermal_conductivity",
        "gd ratio": "g_d_ratio",
        "g d": "g_d_ratio",
        "raman g d ratio": "g_d_ratio",
    }
)

_default_client: CPTClient | None = None


def resolve_property(name: str) -> str:
    """Resolve a readable property name to the canonical API key."""
    if not isinstance(name, str) or not name.strip():
        raise CPTValidationError("Property names must be non-empty strings.")
    normalized = _normalize_property_name(name)
    resolved = _PROPERTY_ALIASES.get(normalized)
    if resolved:
        return resolved
    choices = ", ".join(key.replace("_", " ") for key in PROPERTY_KEYS)
    raise CPTValidationError(f"Unknown property '{name}'. Supported properties: {choices}.")


def configure(
    api_url: str | None = None,
    *,
    timeout: float = 60.0,
    user_agent: str | None = None,
) -> CPTClient:
    """Configure and return the process-wide client used by convenience functions."""
    global _default_client
    _default_client = CPTClient(api_url, timeout=timeout, user_agent=user_agent)
    return _default_client


def get_client() -> CPTClient:
    """Return the lazily created process-wide client."""
    global _default_client
    if _default_client is None:
        _default_client = CPTClient()
    return _default_client


def release() -> dict[str, Any]:
    """Return the active database release descriptor."""
    return get_client().release()


def properties() -> tuple[dict[str, Any], ...]:
    """Return the live property catalog."""
    return get_client().properties()


def scatter(x: str, y: str, **kwargs: Any) -> RenderedFigure:
    """Render a scatter figure using readable or canonical property names."""
    return get_client().scatter(resolve_property(x), resolve_property(y), **kwargs)


def ranked(x: str, y: str, **kwargs: Any) -> RenderedFigure:
    """Render a ranked figure using readable or canonical property names."""
    return get_client().ranked(resolve_property(x), resolve_property(y), **kwargs)


def trend(x: str, y: str, **kwargs: Any) -> RenderedFigure:
    """Render a trend figure using readable or canonical property names."""
    return get_client().trend(resolve_property(x), resolve_property(y), **kwargs)


def ashby(x: str, y: str, **kwargs: Any) -> RenderedFigure:
    """Render an Ashby figure using readable or canonical property names."""
    return get_client().ashby(resolve_property(x), resolve_property(y), **kwargs)
