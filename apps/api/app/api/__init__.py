from fastapi import APIRouter, Depends

from app.api import (
    auth,
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
from app.api.shared import require_authentication


router = APIRouter(dependencies=[Depends(require_authentication)])

for module in (
    auth,
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
