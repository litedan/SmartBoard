from fastapi import APIRouter

from app.api.v1.endpoints import ads, auth, events, profile, recommendations, search

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(ads.router)
api_router.include_router(profile.router)
api_router.include_router(recommendations.router)
api_router.include_router(events.router)
api_router.include_router(search.router)
