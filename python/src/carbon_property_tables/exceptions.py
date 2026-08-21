"""Exceptions raised by the Carbon Property Tables client."""


class CPTError(Exception):
    """Base client error."""


class CPTValidationError(CPTError, ValueError):
    """Invalid local request arguments."""


class CPTHTTPError(CPTError):
    """HTTP or API-level failure."""

    def __init__(self, status: int, message: str, payload: object | None = None) -> None:
        super().__init__(f"CPT API returned HTTP {status}: {message}")
        self.status = status
        self.message = message
        self.payload = payload
