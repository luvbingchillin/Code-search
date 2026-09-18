"""Health check endpoint reporting system status and vector DB metrics."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_retrieval_service
from app.schemas.ast_chunk import HealthResponse
from app.services.retrieval import RetrievalService

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="System Health & Index Metrics")
def get_health(
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> HealthResponse:
    """Return the health status of the backend, active vector store, and chunk count."""
    return retrieval_service.get_health_stats()
