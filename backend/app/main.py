from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(title="SmartBoard API", version="0.1.0")
    static_dir = Path(__file__).resolve().parent / "static"
    static_dir.mkdir(parents=True, exist_ok=True)

    app.mount("/media", StaticFiles(directory=static_dir), name="media")
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
