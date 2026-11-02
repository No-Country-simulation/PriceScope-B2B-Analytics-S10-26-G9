from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app.services import scraping_rate_limit
from app.services.scraping_rate_limit import (
    KEY_PREFIX,
    ScrapingRateLimitError,
    acquire_scraping_slot,
    throttle_scraping_request,
)


def fake_redis(
    *,
    set_result=True,
    ttl=1000,
):
    return SimpleNamespace(
        set=AsyncMock(return_value=set_result),
        pttl=AsyncMock(return_value=ttl),
    )


async def test_first_request_reserves_slot() -> None:
    cache = fake_redis()

    await acquire_scraping_slot(
        "www.carrefour.com.ar",
        cache=cache,
    )

    cache.set.assert_awaited_once_with(
        KEY_PREFIX + "www.carrefour.com.ar",
        "1",
        nx=True,
        px=1000,
    )

    cache.pttl.assert_not_awaited()


async def test_second_request_waits() -> None:
    cache = fake_redis()
    cache.set.side_effect = [None, True]

    pause = AsyncMock()

    await acquire_scraping_slot(
        "www.carrefour.com.ar",
        cache=cache,
        pause=pause,
    )

    assert cache.set.await_count == 2
    cache.pttl.assert_awaited_once()
    pause.assert_awaited_once_with(1.0)


async def test_stores_use_different_keys() -> None:
    cache = fake_redis()

    await acquire_scraping_slot(
        "www.carrefour.com.ar",
        cache=cache,
    )

    await acquire_scraping_slot(
        "www.jumbo.com.ar",
        cache=cache,
    )

    first_key = cache.set.await_args_list[0].args[0]
    second_key = cache.set.await_args_list[1].args[0]

    assert first_key != second_key


async def test_redis_failure_blocks_request() -> None:
    cache = fake_redis()
    cache.set.side_effect = RedisConnectionError("Redis unavailable")

    with pytest.raises(
        ScrapingRateLimitError,
        match="Redis no está disponible",
    ):
        await acquire_scraping_slot(
            "www.carrefour.com.ar",
            cache=cache,
        )


async def test_httpx_hook_runs_before_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cache = fake_redis()
    requests = []

    monkeypatch.setattr(
        scraping_rate_limit,
        "redis_client",
        cache,
    )

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond),
        event_hooks={
            "request": [throttle_scraping_request],
        },
    ) as client:
        response = await client.get(
            "https://www.carrefour.com.ar/api/catalog_system/pub/products/search",
            params={"ft": "leche"},
        )

    assert response.status_code == 200
    assert len(requests) == 1
    assert cache.set.await_count == 1
