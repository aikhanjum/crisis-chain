"""
Async database layer using asyncpg.
A single connection pool is created on first use and reused across requests.
"""

import os
import asyncpg
from typing import Any

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        # asyncpg expects postgresql:// not postgresql+asyncpg://
        dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
    return _pool


async def fetch(sql: str, *args: Any) -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch(sql, *args)
    return [dict(r) for r in rows]


async def fetchrow(sql: str, *args: Any) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(sql, *args)
    return dict(row) if row else None


async def fetchval(sql: str, *args: Any) -> Any:
    pool = await get_pool()
    return await pool.fetchval(sql, *args)


async def execute(sql: str, *args: Any) -> str:
    pool = await get_pool()
    return await pool.execute(sql, *args)


async def executemany(sql: str, args: list[tuple[Any, ...]]) -> None:
    pool = await get_pool()
    await pool.executemany(sql, args)
