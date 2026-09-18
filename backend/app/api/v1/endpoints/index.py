"""Codebase scanning and vector indexing trigger endpoint."""

import time
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_ingestion_service
from app.schemas.ast_chunk import IndexRequest, IndexResponse
from app.services.ingestion import VectorIngestionService

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

    start_time = time.perf_counter()
    files = ingestion_service.scanner.find_python_files(str(src_path))
    chunks_count = ingestion_service.ingest_directory(str(src_path))
    elapsed = time.perf_counter() - start_time

    return IndexResponse(
        indexed_files=len(files),
        extracted_chunks=chunks_count,
        elapsed_seconds=round(elapsed, 4),
    )
