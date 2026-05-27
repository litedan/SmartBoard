from fastapi import APIRouter

from app.api.v1.endpoints import admin, ads, auth, chat, events, health, profile, recommendations, reports, search

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(ads.router)
api_router.include_router(chat.router)
api_router.include_router(profile.router)
api_router.include_router(recommendations.router)
api_router.include_router(events.router)
api_router.include_router(search.router)
