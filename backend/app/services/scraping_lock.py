"""Prevent simultaneous scraping runs for the same store."""

import hashlib
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text

from app.core.database import engine


class ScrapeAlreadyRunningError(Exception):
    """A scraping run for this store is already in progress."""


def store_lock_key(store_id: uuid.UUID) -> int:
    """Create a stable PostgreSQL bigint key for a store."""

    content = b"pricescope:scraping:v1:" + store_id.bytes
    digest = hashlib.sha256(content).digest()

    return int.from_bytes(
        digest[:8],
        byteorder="big",
        signed=True,
    )


@asynccontextmanager
async def scrape_store_lock(
    store_id: uuid.UUID,
) -> AsyncIterator[None]:
    """Hold an advisory lock until the scraping run finishes."""

    key = store_lock_key(store_id)

    # Dedicated connection: record_observation commits on
    # another connection and must not release this lock.
    async with engine.begin() as connection:
        acquired = await connection.scalar(
            text("SELECT pg_try_advisory_xact_lock(:key)"),
            {"key": key},
        )

        if acquired is not True:
            raise ScrapeAlreadyRunningError("Scraping already running for this store")

        yield
