from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.stores import ClientStoreOutput
from app.services import stores

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get(
    "",
    response_model=list[ClientStoreOutput],
    summary="Stores visible to the current user",
    responses={401: {"description": "Not authenticated"}},
)
async def list_visible_stores(db: DbSession, user: CurrentUser) -> list[ClientStoreOutput]:
    return [
        ClientStoreOutput.model_validate(store) for store in await stores.visible_stores(db, user)
    ]
