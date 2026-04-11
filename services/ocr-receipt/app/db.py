import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
    return _pool


async def fetchrow(query: str, *args):
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def execute(query: str, *args):
    pool = await get_pool()
    return await pool.execute(query, *args)
