from arq.connections import RedisSettings
from redis.asyncio import Redis

from app.core.config import settings

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)

# Connection used by the API (to enqueue) and by the worker (to run jobs)
arq_settings = RedisSettings.from_dsn(settings.redis_url)
