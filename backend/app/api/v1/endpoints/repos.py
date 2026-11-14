"""Repository registry and metadata endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_retrieval_service
from app.models.chunk import AstCodeChunk
from app.schemas.ast_chunk import (
    RepositoriesResponse,
    RepositoryItem,
    FileSymbolNode,
    FileTreeNode,
    RepositoryTreeResponse,
    RepositoryManifestResponse,
)
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


@router.get("/repos/{repo_id}/manifest", response_model=RepositoryManifestResponse, summary="Get Repository Architectural Manifest")
def get_repository_manifest(repo_id: str) -> RepositoryManifestResponse:
    """Retrieve pre-computed architectural manifest and core symbols for instant overview synthesis."""
    manifest = repo_registry.get_repository_manifest(repo_id)
    if not manifest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found in registry",
        )
    return manifest


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


@router.get("/repos/{repo_id}/tree", response_model=RepositoryTreeResponse, summary="Get Repository AST Symbol Tree")
def get_repository_tree(
    repo_id: str,
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> RepositoryTreeResponse:
    """Retrieve full hierarchical file and AST symbol tree for repository exploration."""
    repo = repo_registry.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found in registry",
        )

    vs = retrieval_service.vector_store
    all_chunks = []

    if hasattr(vs, "_table") and vs._table is not None:
        try:
            records = vs._table.search().limit(2000).to_list()
            for r in records:
                all_chunks.append(dict(r))
        except Exception:
            pass
    elif hasattr(vs, "_conn") and vs._conn is not None:
        try:
            cursor = vs._conn.cursor()
            cursor.execute("SELECT id, file_path, file_name, ast_node_type, identifier, start_line, end_line, parameters FROM chunks")
            for row in cursor.fetchall():
                all_chunks.append({
                    "id": row[0],
                    "filePath": row[1],
                    "fileName": row[2],
                    "astNodeType": row[3],
                    "identifier": row[4],
                    "startLine": row[5],
                    "endLine": row[6],
                    "parameters": row[7].split(",") if row[7] else [],
                })
        except Exception:
            pass

    # Deduplicate chunks by id
    seen_ids = set()
    unique_chunks = []
    for c in all_chunks:
        cid = c.get("id")
        if cid and cid not in seen_ids:
            seen_ids.add(cid)
            unique_chunks.append(c)

    # Group by filePath
    files_map = {}
    for c in unique_chunks:
        f_path = c.get("filePath") or c.get("file_path") or "unknown.py"
        # If repo is sample_codebase, scope to sample_codebase
        if repo.id == "sample_codebase" and "sample_codebase" not in f_path.lower():
            continue
        elif repo.id == "requests" and "sample_codebase" in f_path.lower():
            continue

        f_name = c.get("fileName") or c.get("file_name") or f_path.split("/")[-1].split("\\")[-1]

        if f_path not in files_map:
            files_map[f_path] = {
                "filePath": f_path,
                "fileName": f_name,
                "symbols": [],
            }

        param_list = c.get("parameters") or []
        if isinstance(param_list, str):
            param_list = [p.strip() for p in param_list.split(",") if p.strip()]

        files_map[f_path]["symbols"].append(
            FileSymbolNode(
                id=str(c.get("id")),
                identifier=str(c.get("identifier")),
                astNodeType=str(c.get("astNodeType") or c.get("ast_node_type") or "FunctionDef"),
                startLine=int(c.get("startLine") or c.get("start_line") or 0),
                endLine=int(c.get("endLine") or c.get("end_line") or 0),
                parameters=list(param_list) if hasattr(param_list, "__iter__") else [],
            )
        )

    tree_nodes = []
    for f_path, data in sorted(files_map.items()):
        data["symbols"].sort(key=lambda s: s.start_line)
        tree_nodes.append(
            FileTreeNode(
                filePath=data["filePath"],
                fileName=data["fileName"],
                symbolsCount=len(data["symbols"]),
                symbols=data["symbols"],
            )
        )

    total_symbols = sum(node.symbols_count for node in tree_nodes)

    return RepositoryTreeResponse(
        repo_id=repo.id,
        repo_name=repo.name,
        total_files=len(tree_nodes),
        total_symbols=total_symbols,
        tree=tree_nodes,
    )
