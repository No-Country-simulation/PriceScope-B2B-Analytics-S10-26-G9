import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Role, Store, User, UserStore
from app.services.errors import BusinessError, ConflictError, NotFoundError
from app.services.users import get_user


async def list_catalog(db: AsyncSession) -> list[Store]:
    rows = await db.scalars(select(Store).where(Store.active.is_(True)).order_by(Store.name))
    return list(rows)


async def stores_of_user(db: AsyncSession, user_id: uuid.UUID) -> list[Store]:
    rows = await db.scalars(
        select(Store)
        .join(UserStore, UserStore.store_id == Store.id)
        .where(UserStore.user_id == user_id)
        .order_by(Store.name)
    )
    return list(rows)


async def visible_store_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    """Stores whose data the user can see. Dashboard, matrix and alerts will use this."""
    if user.role == Role.ADMIN:
        return list(await db.scalars(select(Store.id)))
    return list(await db.scalars(select(UserStore.store_id).where(UserStore.user_id == user.id)))


async def visible_stores(db: AsyncSession, user: User) -> list[Store]:
    """Active stores the user can see, for the client screens (matrix columns, filters)."""
    store_ids = await visible_store_ids(db, user)
    if not store_ids:
        return []
    rows = await db.scalars(
        select(Store).where(Store.id.in_(store_ids), Store.active.is_(True)).order_by(Store.name)
    )
    return list(rows)


async def assign_store(
    db: AsyncSession, user_id: uuid.UUID, store_id: uuid.UUID, admin_id: uuid.UUID
) -> None:
    user = await get_user(db, user_id)
    if user.role == Role.ADMIN:
        raise BusinessError("Las tiendas solo se asignan a clientes")
    store = await db.get(Store, store_id)
    if store is None or not store.active:
        raise NotFoundError("La tienda no existe")
    if await db.get(UserStore, (user_id, store_id)):
        raise ConflictError("La tienda ya está asignada a este usuario")
    db.add(UserStore(user_id=user_id, store_id=store_id, assigned_by=admin_id))
    await db.commit()


async def remove_store(db: AsyncSession, user_id: uuid.UUID, store_id: uuid.UUID) -> None:
    result = await db.execute(
        delete(UserStore).where(UserStore.user_id == user_id, UserStore.store_id == store_id)
    )
    if result.rowcount == 0:
        raise NotFoundError("La tienda no estaba asignada a este usuario")
    await db.commit()
