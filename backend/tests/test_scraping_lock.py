import uuid

import pytest

from app.services.scraping_lock import (
    ScrapeAlreadyRunningError,
    scrape_store_lock,
    store_lock_key,
)


def test_lock_key_is_stable() -> None:
    store_id = uuid.uuid4()

    first = store_lock_key(store_id)
    second = store_lock_key(store_id)

    assert first == second
    assert -(2**63) <= first < 2**63


async def test_same_store_cannot_acquire_lock_twice() -> None:
    store_id = uuid.uuid4()

    async with scrape_store_lock(store_id):
        with pytest.raises(ScrapeAlreadyRunningError):
            async with scrape_store_lock(store_id):
                pytest.fail("The second run must not enter")


async def test_different_stores_can_run_together() -> None:
    first_store = uuid.uuid4()
    second_store = uuid.uuid4()

    async with scrape_store_lock(first_store):
        async with scrape_store_lock(second_store):
            pass


async def test_lock_is_released_after_success() -> None:
    store_id = uuid.uuid4()

    async with scrape_store_lock(store_id):
        pass

    # A new run should be allowed.
    async with scrape_store_lock(store_id):
        pass


async def test_lock_is_released_after_failure() -> None:
    store_id = uuid.uuid4()

    with pytest.raises(
        RuntimeError,
        match="Simulated failure",
    ):
        async with scrape_store_lock(store_id):
            raise RuntimeError("Simulated failure")

    # PostgreSQL must release the lock after rollback.
    async with scrape_store_lock(store_id):
        pass
