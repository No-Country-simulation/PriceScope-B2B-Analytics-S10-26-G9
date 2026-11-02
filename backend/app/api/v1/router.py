from fastapi import APIRouter

from app.api.v1 import (
    account,
    admin_demo_requests,
    admin_rates,
    admin_scraping,
    admin_stores,
    admin_users,
    auth,
    demo,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(demo.router)
api_router.include_router(account.router)
api_router.include_router(admin_demo_requests.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_stores.router)
api_router.include_router(admin_rates.router)
api_router.include_router(admin_scraping.router)
