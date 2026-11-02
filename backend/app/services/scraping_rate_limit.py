"""Distributed request rate limit for VTEX scraping."""

import asyncio
import time
from collections.abc import Awaitable, Callable

import httpx
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.cache import redis_client
from app.services.errors import BusinessError

INTERVAL_MS = 1000
MAX_WAIT_SECONDS = 10.0
KEY_PREFIX = "pricescope:scraping:rate:"


class ScrapingRateLimitError(BusinessError):
    """The request cannot safely obtain a scraping slot."""

    status_code = 503


async def acquire_scraping_slot(
    host: str,
    *,
    cache: Redis | None = None,
    pause: Callable[[float], Awaitable[None]] = asyncio.sleep,
    max_wait_seconds: float = MAX_WAIT_SECONDS,
) -> None:
    """Reserve one HTTP request per second for a store host."""

    if not host or max_wait_seconds < 0:
        raise ValueError("Invalid rate limiter configuration")

    redis = cache if cache is not None else redis_client
    key = f"{KEY_PREFIX}{host.lower()}"
    deadline = time.monotonic() + max_wait_seconds

    while True:
        try:
            acquired = await redis.set(
                key,
                "1",
                nx=True,
                px=INTERVAL_MS,
            )

            if acquired:
                return

            remaining_ms = await redis.pttl(key)

        except RedisError as exc:
            raise ScrapingRateLimitError("Redis no está disponible; extracción cancelada") from exc

        remaining_seconds = deadline - time.monotonic()

        if remaining_seconds <= 0:
            raise ScrapingRateLimitError("Se agotó la espera para consultar la tienda")

        delay = max(remaining_ms / 1000, 0.05)

        await pause(min(delay, remaining_seconds))


async def throttle_scraping_request(
    request: httpx.Request,
) -> None:
    """Run before HTTPX sends a scraping request."""

    if request.url.scheme != "https":
        raise ScrapingRateLimitError("El scraping solo admite solicitudes HTTPS")

    await acquire_scraping_slot(request.url.host)
