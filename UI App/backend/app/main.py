"""FastAPI application entrypoint.

Run locally:
    cd "UI App/backend"
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import canvas, catalog, generate, health, images, rhino, train, uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.ensure_dirs()
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=f"{settings.app_name} API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(catalog.router)
    app.include_router(images.router)
    app.include_router(uploads.router)
    app.include_router(generate.router)
    app.include_router(canvas.router)
    app.include_router(train.router)
    app.include_router(rhino.router)

    return app


app = create_app()
