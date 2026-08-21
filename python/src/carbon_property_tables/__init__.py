"""Carbon Property Tables Python client."""

from ._version import __version__
from .client import CPTClient
from .convenience import ashby, configure, doi_status, get_client, has_doi, properties, ranked, release, resolve_property, scatter, trend
from .exceptions import CPTError, CPTHTTPError, CPTValidationError
from .models import CitationBundle, CitationEntry, DoiStatus, RenderedFigure, TemporaryPoint, TemporaryPointRank, TopPoint

__all__ = [
    "CPTClient",
    "CPTError",
    "CPTHTTPError",
    "CPTValidationError",
    "CitationBundle",
    "CitationEntry",
    "DoiStatus",
    "RenderedFigure",
    "TemporaryPoint",
    "TemporaryPointRank",
    "TopPoint",
    "ashby",
    "configure",
    "doi_status",
    "get_client",
    "has_doi",
    "properties",
    "ranked",
    "release",
    "resolve_property",
    "scatter",
    "trend",
    "__version__",
]
