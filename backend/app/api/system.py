from fastapi import APIRouter

from app.container import services


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/workbench/overview")
def workbench_overview():
    return services.workbench.overview()
