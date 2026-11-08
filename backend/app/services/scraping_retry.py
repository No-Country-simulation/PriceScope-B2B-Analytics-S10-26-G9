"""Retry policy for controlled scraping jobs."""

from app.scrapers.vtex_client import VtexFetchError

RETRYABLE_STATUS_CODES = frozenset({500, 502, 503, 504})


def should_retry_vtex_error(
    error: VtexFetchError,
) -> bool:
    """Return whether a VTEX failure is eligible for retry."""

    if error.status_code == 429:
        return False

    if error.network_error:
        return True

    return error.status_code in RETRYABLE_STATUS_CODES
