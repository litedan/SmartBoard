#!/bin/sh
set -e

echo "Waiting for database..."
until python -c "
import asyncio
from sqlalchemy import text
from app.db.session import engine

async def check():
    async with engine.begin() as conn:
        await conn.execute(text('SELECT 1'))

asyncio.run(check())
" 2>/dev/null; do
  sleep 1
done

echo "Running migrations..."
alembic upgrade head

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
