from urllib.parse import quote
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.api.schemas import ExportBatchRequest, ExportBulkJobRequest, ExportItemRequest
from app.container import services
from app.services.export_job_service import _now, _parse_iso


router = APIRouter()


@router.get("/exports/queue")
def queue(work_ids: str = ""):
    try:
        if len(work_ids) > 4096:
            raise ValueError("作品选择过多")
        return services.exports.queue([int(value) for value in work_ids.split(",")] if work_ids else None)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/exports/summary")
def summary():
    return services.exports.summary()


@router.get("/works/{work_id}/export-preview")
def preview(work_id: int):
    try:
        return services.exports.preview(work_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/works/{work_id}/export-preview")
def preview_with_options(work_id: int, payload: ExportItemRequest):
    try:
        return services.exports.preview(work_id, payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _download_response(build, media_type: str) -> FileResponse:
    directory = services.settings.export_jobs_dir
    directory.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=directory, prefix="download-", suffix=".zip", delete=False) as temporary:
        path = Path(temporary.name)
    try:
        filename = build(path)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "download"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
    return FileResponse(
        path,
        filename=filename,
        media_type=media_type,
        headers={"Content-Disposition": disposition},
        background=BackgroundTask(path.unlink, missing_ok=True),
    )


@router.get("/works/{work_id}/export/download")
def download(
    work_id: int,
    output_name: str | None = None,
    write_comicinfo: bool = True,
    keep_json: bool = True,
    compress: bool = True,
):
    options = {
        "output_name": output_name,
        "write_comicinfo": write_comicinfo,
        "keep_json": keep_json,
        "compress": compress,
    }
    try:
        return _download_response(lambda path: services.exports.write_cbz(work_id, path, options), "application/vnd.comicbook+zip")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/exports/download")
def download_bundle(payload: ExportBatchRequest):
    items = [item.model_dump(exclude_none=True) for item in payload.items if item.work_id]
    options = {
        "write_comicinfo": payload.write_comicinfo,
        "keep_json": payload.keep_json,
        "compress": payload.compress,
    }
    try:
        return _download_response(lambda path: services.exports.write_bundle(items, path, options), "application/zip")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/exports/bulk-jobs")
def enqueue_bulk_export(payload: ExportBulkJobRequest):
    items = [item.model_dump(exclude_none=True) for item in payload.items if item.work_id]
    if not items:
        items = [{"work_id": work_id} for work_id in payload.work_ids if work_id]
    if not items:
        raise HTTPException(status_code=422, detail="未选择任何作品。")
    return services.export_jobs.enqueue_bulk_export(items, payload.options)


@router.get("/jobs/{job_id}/export/download")
def download_bulk_export(job_id: int):
    try:
        job = services.jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if job["type"] != "bulk_export":
        raise HTTPException(status_code=404, detail="该任务没有可下载的导出产物。")
    target = job["target"]
    if target.get("downloaded"):
        raise HTTPException(status_code=410, detail="导出产物已下载并清除。")
    if job["status"] != "completed":
        raise HTTPException(status_code=404, detail="导出产物尚未就绪。")
    if _artifact_expired(target):
        raise HTTPException(status_code=410, detail="导出产物已过期。")
    path = services.export_jobs.download_path(job_id, target.get("artifact_path"))
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="导出产物不存在。")
    output_name = target.get("output_name") or f"job-{job_id}.zip"
    ascii_name = output_name.encode("ascii", "ignore").decode("ascii") or "export.zip"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(output_name)}"
    return FileResponse(
        path,
        media_type="application/zip",
        filename=output_name,
        headers={"Content-Disposition": disposition},
        background=BackgroundTask(services.export_jobs.mark_downloaded, job_id),
    )


def _artifact_expired(target: dict) -> bool:
    expires_at = _parse_iso(target.get("expires_at"))
    return expires_at is not None and _now() >= expires_at
