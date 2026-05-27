import logging
from contextlib import asynccontextmanager
from logging.config import dictConfig
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.redis import close_redis, ping_redis

dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            }
        },
        "root": {
            "handlers": ["console"],
            "level": "INFO",
        },
    }
)
logger = logging.getLogger("smartboard")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not await ping_redis():
        logger.warning("Redis is unavailable. Start Redis or docker compose up redis.")
    else:
        logger.info("Redis connection is healthy.")
    yield
    logger.info("Shutting down application.")
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(title="SmartBoard API", version="0.1.0", lifespan=lifespan)
    static_dir = Path(__file__).resolve().parent / "static"
    static_dir.mkdir(parents=True, exist_ok=True)

    app.mount("/media", StaticFiles(directory=static_dir), name="media")
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
