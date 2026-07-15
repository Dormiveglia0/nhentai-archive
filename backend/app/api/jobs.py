from fastapi import APIRouter, HTTPException

from app.container import services
from app.services.job_service import JobActive


router = APIRouter(prefix="/jobs")


def _dispatch(job_id: int):
    """Route a job control action to the service that owns its type."""
    job_type = services.jobs.get(job_id)["type"]
    if job_type == "bulk_export":
        return services.export_jobs
    if job_type == "library_scan":
        return services.library_scan_jobs
    return services.imports


@router.get("")
def list_jobs():
    services.export_jobs.sweep_exports()
    return {"result": services.jobs.list()}


@router.get("/{job_id}")
def get_job(job_id: int):
    try:
        return services.jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{job_id}/logs")
def get_logs(job_id: int):
    try:
        return services.jobs.logs(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{job_id}/pause")
def pause(job_id: int):
    try:
        return services.jobs.pause(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{job_id}/resume")
def resume(job_id: int):
    try:
        return _dispatch(job_id).resume_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{job_id}/cancel")
def cancel(job_id: int):
    try:
        return _dispatch(job_id).cancel_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{job_id}/retry")
def retry(job_id: int):
    try:
        return _dispatch(job_id).retry_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/clear")
def clear():
    return services.jobs.clear_finished()


@router.delete("/{job_id}")
def delete(job_id: int):
    try:
        return services.jobs.delete(job_id)
    except JobActive as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
