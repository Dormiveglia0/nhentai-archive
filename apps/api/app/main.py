from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import router
from app.container import services


@asynccontextmanager
async def lifespan(_app: FastAPI):
    services.jobs.recover_interrupted()
    services.export_jobs.sweep_exports()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="NH Archive", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")
    web_dist = os.environ.get("NH_ARCHIVE_WEB_DIST")
    if web_dist:
        web_root = Path(web_dist)
        if not (web_root / "index.html").is_file():
            raise RuntimeError(f"Web build not found: {web_root}")
        app.add_api_route(
            "/demo",
            lambda: FileResponse(web_root / "index.html"),
            include_in_schema=False,
        )
        app.mount("/", StaticFiles(directory=web_root, html=True), name="web")
    return app


app = create_app()
