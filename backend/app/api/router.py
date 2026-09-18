"""Unified API router assembling v1 endpoints."""

from fastapi import APIRouter

from app.api.v1.endpoints import chunks, entity, health, index, search

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(entity.router, tags=["entity"])
api_router.include_router(chunks.router, tags=["chunks"])
api_router.include_router(index.router, tags=["index"])
