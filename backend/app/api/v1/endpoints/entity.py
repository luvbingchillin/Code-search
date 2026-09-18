"""Exact-match entity lookup endpoint for multi-hop dependency resolution."""

from fastapi import APIRouter, Depends, Path

from app.api.dependencies import get_retrieval_service
from app.schemas.ast_chunk import EntityLookupResponse
from app.services.retrieval import RetrievalService

router = APIRouter()


@router.get("/entity/{name:path}", response_model=EntityLookupResponse, summary="Exact Entity Name Lookup")
def lookup_entity(
    name: str = Path(..., min_length=1, description="Function name, class name, or qualified method name"),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> EntityLookupResponse:
    """Perform exact-match search by entity identifier to support multi-hop dependency resolution."""
    return retrieval_service.search_exact(identifier=name)
