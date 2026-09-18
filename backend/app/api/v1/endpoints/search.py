"""Semantic vector search endpoints for AST code chunks."""

from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_retrieval_service
from app.models.chunk import AstNodeType
from app.schemas.ast_chunk import SearchRequest, SearchResponse
from app.services.retrieval import RetrievalService

router = APIRouter()


@router.post("/search", response_model=SearchResponse, summary="Semantic Vector Search (POST)")
def search_chunks_post(
    request: SearchRequest,
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> SearchResponse:
    """Retrieve top-K most semantically similar AST code chunks for a given query."""
    return retrieval_service.search_semantic(
        query=request.query,
        top_k=request.top_k,
        ast_node_type=request.ast_node_type,
        file_path=request.file_path,
    )


@router.get("/search", response_model=SearchResponse, summary="Semantic Vector Search (GET)")
def search_chunks_get(
    query: str = Query(..., min_length=1, description="Natural language search query"),
    top_k: int = Query(default=5, ge=1, le=100, description="Max results to return (>= 1)"),
    ast_node_type: Optional[AstNodeType] = Query(default=None, description="Filter by node type"),
    file_path: Optional[str] = Query(default=None, description="Filter by file path"),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> SearchResponse:
    """Retrieve top-K most semantically similar AST code chunks via GET query parameters."""
    return retrieval_service.search_semantic(
        query=query,
        top_k=top_k,
        ast_node_type=ast_node_type,
        file_path=file_path,
    )
