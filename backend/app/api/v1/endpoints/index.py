"""Codebase scanning and vector indexing trigger endpoint."""

import time
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_ingestion_service
from app.schemas.ast_chunk import IndexRequest, IndexResponse
from app.services.ingestion import VectorIngestionService
from app.services.repo_registry import SEED_MANIFESTS, generate_structural_manifest, repo_registry

router = APIRouter()


@router.post("/index", response_model=IndexResponse, summary="Trigger Codebase Ingestion and Indexing")
def trigger_indexing(
    request: IndexRequest,
    ingestion_service: VectorIngestionService = Depends(get_ingestion_service),
) -> IndexResponse:
    """Scan the given filesystem directory for Python files, extract AST chunks, and persist them into the vector database."""
    src_path = Path(request.source_dir).resolve()
    if not src_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source directory '{request.source_dir}' does not exist",
        )

    norm_path = request.source_dir.replace("\\", "/").strip().rstrip("/")
    repo_name = Path(norm_path).name or "codebase"
    repo_id = repo_name.lower().replace(" ", "-") or "repo"

    start_time = time.perf_counter()
    files = ingestion_service.scanner.find_python_files(str(src_path))
    extracted = ingestion_service.scanner.scan_directory(str(src_path))
    for chunk in extracted:
        chunk.repoFullName = repo_id
    chunks_count = ingestion_service.ingest_chunks(extracted)
    elapsed = time.perf_counter() - start_time

    # Auto-generate structural manifest for custom repositories (preserve curated manifests for seeds)
    manifest_text = SEED_MANIFESTS.get(repo_id) or generate_structural_manifest(repo_name, extracted)

    # Record indexed repository in registry
    repo_registry.record_indexed_repository(
        source_dir=request.source_dir,
        files_count=len(files),
        chunks_count=chunks_count,
        manifest=manifest_text,
    )

    # Invalidate cached 3D strata graph for this repository
    from app.api.v1.endpoints.repos import invalidate_strata_cache
    invalidate_strata_cache(repo_id)

    return IndexResponse(
        indexed_files=len(files),
        extracted_chunks=chunks_count,
        elapsed_seconds=round(elapsed, 4),
    )
