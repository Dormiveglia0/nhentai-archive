from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .auth import create_token, require_admin, verify_password
from .config import settings
from .db import Database, dumps, loads
from .schemas import (
    DictionaryEntry,
    DictionaryUpsert,
    ImportRequest,
    LoginRequest,
    LoginResponse,
    SearchResponse,
    SettingsUpdate,
    SuggestionRequest,
    SuggestionResponse,
    TaskResponse,
)
from .services.download_worker import DownloadWorker
from .services.nhentai_client import NhentaiClient
from .services.translation_service import TranslationService

settings.ensure_dirs()
db = Database(settings.database_path)
nhentai = NhentaiClient()
translations = TranslationService(db)
worker = DownloadWorker(db, nhentai, translations)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    db.init()
    translations.update_settings({"translation_provider": settings.translation_provider})
    worker.start()


@app.on_event("shutdown")
async def shutdown() -> None:
    await worker.stop()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    if not verify_password(body.username, body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return LoginResponse(token=create_token(body.username), username=body.username)


@app.get("/api/settings")
def get_settings(_: str = Depends(require_admin)) -> dict[str, Any]:
    return translations.settings()


@app.patch("/api/settings")
def patch_settings(body: SettingsUpdate, _: str = Depends(require_admin)) -> dict[str, Any]:
    return translations.update_settings(body.model_dump(exclude_none=True))


@app.get("/api/search", response_model=SearchResponse)
async def search(q: str = Query(min_length=1), _: str = Depends(require_admin)) -> SearchResponse:
    return SearchResponse(result=await nhentai.search(q))


@app.post("/api/tasks/import", response_model=list[TaskResponse])
def import_tasks(body: ImportRequest, _: str = Depends(require_admin)) -> list[dict[str, Any]]:
    if settings.require_authorized_use_ack and not body.authorized_use_ack:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must confirm these works are authorized for your personal archive.",
        )
    ids = sorted({gallery_id for gallery_id in body.ids if gallery_id > 0})
    for gallery_id in ids:
        db.execute(
            """
            INSERT INTO tasks(gallery_id, status)
            VALUES (?, 'queued')
            ON CONFLICT(gallery_id) DO UPDATE SET
                status=CASE WHEN tasks.status='failed' THEN 'queued' ELSE tasks.status END,
                error=NULL,
                updated_at=CURRENT_TIMESTAMP
            """,
            (gallery_id,),
        )
    placeholders = ",".join("?" for _ in ids) or "NULL"
    return db.query_all(f"SELECT * FROM tasks WHERE gallery_id IN ({placeholders}) ORDER BY created_at DESC", ids)


@app.get("/api/tasks", response_model=list[TaskResponse])
def list_tasks(_: str = Depends(require_admin)) -> list[dict[str, Any]]:
    return db.query_all("SELECT * FROM tasks ORDER BY created_at DESC")


@app.post("/api/tasks/{task_id}/retry", response_model=TaskResponse)
def retry_task(task_id: int, _: str = Depends(require_admin)) -> dict[str, Any]:
    row = db.query_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    db.execute(
        """
        UPDATE tasks SET status='queued', error=NULL, progress_current=0,
            updated_at=CURRENT_TIMESTAMP WHERE id=?
        """,
        (task_id,),
    )
    updated = db.query_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    assert updated is not None
    return updated


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, _: str = Depends(require_admin)) -> dict[str, str]:
    row = db.query_one("SELECT * FROM tasks WHERE id=?", (task_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    if row.get("cbz_path"):
        path = Path(row["cbz_path"])
        if path.exists() and path.is_file() and settings.library_dir in path.parents:
            path.unlink()
    db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    return {"status": "deleted"}


@app.get("/api/tasks/{task_id}/metadata")
def task_metadata(task_id: int, _: str = Depends(require_admin)) -> dict[str, Any]:
    row = db.query_one("SELECT raw_json, translated_json FROM tasks WHERE id=?", (task_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"raw": loads(row["raw_json"]), "translated": loads(row["translated_json"])}


@app.get("/api/tasks/{task_id}/download")
def download_task(task_id: int, _: str = Depends(require_admin)) -> FileResponse:
    row = db.query_one("SELECT cbz_path FROM tasks WHERE id=?", (task_id,))
    if not row or not row.get("cbz_path"):
        raise HTTPException(status_code=404, detail="File not found")
    path = Path(row["cbz_path"])
    if not path.exists() or settings.library_dir not in path.parents:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name, media_type="application/vnd.comicbook+zip")


@app.get("/api/dictionary", response_model=list[DictionaryEntry])
def dictionary(_: str = Depends(require_admin)) -> list[dict[str, Any]]:
    return translations.dictionary()


@app.post("/api/dictionary", response_model=DictionaryEntry)
def upsert_dictionary(body: DictionaryUpsert, _: str = Depends(require_admin)) -> dict[str, Any]:
    return translations.upsert_dictionary(body.model_dump())


@app.delete("/api/dictionary/{entry_id}")
def delete_dictionary(entry_id: int, _: str = Depends(require_admin)) -> dict[str, str]:
    translations.delete_dictionary(entry_id)
    return {"status": "deleted"}


@app.get("/api/suggestions", response_model=list[SuggestionResponse])
def suggestions(_: str = Depends(require_admin)) -> list[dict[str, Any]]:
    return translations.suggestions()


@app.post("/api/suggestions", response_model=list[SuggestionResponse])
async def create_suggestions(body: SuggestionRequest, _: str = Depends(require_admin)) -> list[dict[str, Any]]:
    try:
        return await translations.suggest(body.items, body.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/suggestions/{suggestion_id}/accept", response_model=DictionaryEntry)
def accept_suggestion(suggestion_id: int, _: str = Depends(require_admin)) -> dict[str, Any]:
    try:
        return translations.accept_suggestion(suggestion_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
