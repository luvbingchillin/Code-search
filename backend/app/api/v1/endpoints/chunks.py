"""Single chunk retrieval endpoint by unique identifier."""

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.api.dependencies import get_retrieval_service
from app.schemas.ast_chunk import AstCodeChunk
from app.services.retrieval import RetrievalService

router = APIRouter()


@router.get("/chunks/{id:path}", response_model=AstCodeChunk, summary="Get AST Chunk by ID")
def get_chunk_by_id(
    id: str = Path(..., min_length=1, description="Unique chunk identifier"),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> AstCodeChunk:
    """Retrieve a specific AST code chunk by its unique ID. Returns 404 if not found."""
    chunk = retrieval_service.get_chunk_by_id(id)
    if chunk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AST code chunk with id '{id}' not found",
        )
    return chunk
