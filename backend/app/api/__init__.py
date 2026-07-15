from fastapi import APIRouter

from app.api import (
    dictionary,
    discover,
    exports,
    files,
    governance,
    jobs,
    library,
    settings,
    system,
    works,
)


router = APIRouter()

for module in (
    system,
    discover,
    dictionary,
    library,
    governance,
    exports,
    files,
    works,
    jobs,
    settings,
):
    router.include_router(module.router)
