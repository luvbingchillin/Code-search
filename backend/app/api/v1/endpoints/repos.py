"""Repository registry and metadata endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_retrieval_service
from app.models.chunk import AstCodeChunk
from app.schemas.ast_chunk import RepositoriesResponse, RepositoryItem
from app.services.repo_registry import repo_registry
from app.services.retrieval import RetrievalService

router = APIRouter()


@router.get("/repos", response_model=RepositoriesResponse, summary="List Indexed & Available Repositories")
def list_repositories() -> RepositoriesResponse:
    """Return all tracked, indexed, and available repositories with chunk and file counts."""
    repos = repo_registry.list_repositories()
    return RepositoriesResponse(
        repositories=repos,
        total=len(repos),
    )


@router.get("/repos/{repo_id}", response_model=RepositoryItem, summary="Get Repository Metadata by ID")
def get_repository(repo_id: str) -> RepositoryItem:
    """Return metadata for a specific repository by ID or path."""
    repo = repo_registry.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found in registry",
        )
    return repo


@router.get("/repos/{repo_id}/chunks", response_model=List[AstCodeChunk], summary="Get Sample AST Chunks for Repository")
def get_repository_chunks(
    repo_id: str,
    limit: int = Query(default=10, ge=1, le=50, description="Max chunks to return"),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> List[AstCodeChunk]:
    """Retrieve sample AST code chunks belonging to the specified repository."""
    repo = repo_registry.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found in registry",
        )

    # Search semantic chunks with repo path filter or fallback general search
    resp = retrieval_service.search_semantic(
        query="def ",
        top_k=limit,
        file_path=repo.path,
    )

    if not resp.chunks:
        # Fallback without file_path if prefix was relative
        resp = retrieval_service.search_semantic(
            query="def ",
            top_k=limit,
        )

    return resp.chunks
