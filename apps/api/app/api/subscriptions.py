from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import SubscriptionCreate, SubscriptionUpdateRead
from app.api.shared import remote
from app.container import services


router = APIRouter(prefix="/subscriptions")


@router.get("")
def subscriptions():
    return services.subscriptions.list()


@router.post("", status_code=201)
def subscribe(payload: SubscriptionCreate):
    try:
        return remote(lambda: services.subscriptions.subscribe(**payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/updates")
def updates(page: int = Query(default=1, ge=1), unread_only: bool = False):
    return services.subscriptions.updates(page, unread_only)


@router.post("/updates/read")
def mark_read(payload: SubscriptionUpdateRead):
    return services.subscriptions.mark_read(payload.update_id)


@router.patch("/{subscription_id}")
def update_subscription(subscription_id: int, payload: dict):
    try:
        return services.subscriptions.update(subscription_id, payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.delete("/{subscription_id}")
def remove_subscription(subscription_id: int):
    try:
        return services.subscriptions.remove(subscription_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/{subscription_id}/check")
def check_subscription(subscription_id: int):
    try:
        return services.subscriptions.check_now(subscription_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
