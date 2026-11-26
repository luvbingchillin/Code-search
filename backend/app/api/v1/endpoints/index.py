"""Codebase scanning, browser folder upload, and vector indexing trigger endpoints."""

import re
import shutil
import time
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_ingestion_service
from app.models.chunk import AstCodeChunk
from app.schemas.ast_chunk import IndexRequest, IndexResponse, UploadIndexRequest
from app.services.ingestion import VectorIngestionService
from app.services.repo_registry import SEED_MANIFESTS, generate_structural_manifest, repo_registry

router = APIRouter()

UPLOAD_REPOS_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent / "data" / "uploaded_repos"
_MAX_UPLOAD_FILES = 500
_MAX_FILE_BYTES = 1_000_000


def _sanitize_repo_slug(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", name.strip()).strip("-.").lower()
    return slug or "uploaded-repo"


@router.post("/index", response_model=IndexResponse, summary="Trigger Codebase Ingestion and Indexing")
def trigger_indexing(
    request: IndexRequest,
    ingestion_service: VectorIngestionService = Depends(get_ingestion_service),
) -> IndexResponse:
    """Scan the given filesystem directory for Python files, extract AST chunks, and persist them idempotently."""
    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    raw_dir = request.source_dir.strip()
    candidates = [
        Path(raw_dir),
        project_root / raw_dir,
        Path("backend") / raw_dir,
        Path("..") / raw_dir,
    ]
    if raw_dir.replace("\\", "/").lower().startswith("backend/"):
        stripped = raw_dir.replace("\\", "/")[len("backend/") :]
        candidates.append(Path(stripped))
        candidates.append(project_root / "backend" / stripped)

    src_path = Path(raw_dir).resolve()
    for cand in candidates:
        if cand.exists():
            src_path = cand.resolve()
            break

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
    extracted: List[AstCodeChunk] = []
    for file_path in files:
        extracted.extend(ingestion_service.scanner.scan_file(file_path, repo_root=str(src_path)))

    chunks_count = ingestion_service.ingest_chunks(extracted, repo_id=repo_id, replace_repo=True)
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
        repo_id=repo_id,
        repo_path=request.source_dir,
    )


@router.post("/index/upload", response_model=IndexResponse, summary="Index Python Files Uploaded from Browser Folder Picker")
def trigger_upload_indexing(
    request: UploadIndexRequest,
    ingestion_service: VectorIngestionService = Depends(get_ingestion_service),
) -> IndexResponse:
    """Persist and AST-index Python files selected in the browser via webkitdirectory."""
    if len(request.files) > _MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files uploaded ({len(request.files)} > {_MAX_UPLOAD_FILES} max)",
        )

    repo_name = Path(request.repo_name.strip().replace("\\", "/")).name or "uploaded-repo"
    repo_id = _sanitize_repo_slug(repo_name)
    upload_dir = (UPLOAD_REPOS_ROOT / repo_id).resolve()

    if upload_dir.exists():
        shutil.rmtree(upload_dir, ignore_errors=True)
    upload_dir.mkdir(parents=True, exist_ok=True)

    valid_files: List[Path] = []
    for item in request.files:
        rel_norm = item.path.replace("\\", "/").lstrip("/")
        if not rel_norm:
            continue
        rel_path = Path(rel_norm)
        if rel_path.is_absolute() or ".." in rel_path.parts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid relative file path: '{item.path}'",
            )
        # Strip top-level folder prefix if webkitRelativePath repeats repo_name
        parts = list(rel_path.parts)
        if len(parts) > 1 and _sanitize_repo_slug(parts[0]) == repo_id:
            rel_path = Path(*parts[1:])
        if rel_path.suffix.lower() not in (".py", ".pyi") or any(p.startswith(".") for p in rel_path.parts):
            continue
        if len(item.content.encode("utf-8", errors="ignore")) > _MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{item.path}' exceeds 1MB limit",
            )

        dest = (upload_dir / rel_path).resolve()
        try:
            dest.relative_to(upload_dir)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File path escapes upload root: '{item.path}'",
            )
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(item.content, encoding="utf-8")
        valid_files.append(dest)

    if not valid_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid Python (.py / .pyi) source files found in uploaded folder",
        )

    start_time = time.perf_counter()
    extracted: List[AstCodeChunk] = []
    for file_path in sorted(valid_files):
        extracted.extend(ingestion_service.scanner.scan_file(str(file_path), repo_root=str(upload_dir)))

    chunks_count = ingestion_service.ingest_chunks(extracted, repo_id=repo_id, replace_repo=True)
    elapsed = time.perf_counter() - start_time

    manifest_text = generate_structural_manifest(repo_name, extracted)
    repo_path_str = f"data/uploaded_repos/{repo_id}"

    repo_registry.record_indexed_repository(
        source_dir=repo_path_str,
        files_count=len(valid_files),
        chunks_count=chunks_count,
        name=repo_name,
        manifest=manifest_text,
    )

    from app.api.v1.endpoints.repos import invalidate_strata_cache
    invalidate_strata_cache(repo_id)

    return IndexResponse(
        indexed_files=len(valid_files),
        extracted_chunks=chunks_count,
        elapsed_seconds=round(elapsed, 4),
        repo_id=repo_id,
        repo_path=repo_path_str,
    )
