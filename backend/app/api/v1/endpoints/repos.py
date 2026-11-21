"""Repository registry and metadata endpoints."""

import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_retrieval_service
from app.models.chunk import AstCodeChunk
from app.parser.scanner import CodebaseScanner
from app.schemas.ast_chunk import (
    RepositoriesResponse,
    RepositoryItem,
    FileSymbolNode,
    FileTreeNode,
    RepositoryTreeResponse,
    RepositoryManifestResponse,
    StrataGraphResponse,
)
from app.services.repo_registry import repo_registry
from app.services.retrieval import RetrievalService
from app.services.strata import build_strata_graph

router = APIRouter()

# In-memory cache for computed 3D strata graphs, keyed by (store_identity, store_count, repo_id)
_strata_graph_cache: dict[tuple[int, int, str], StrataGraphResponse] = {}


def invalidate_strata_cache(repo_id: Optional[str] = None) -> None:
    """Clear cached strata graphs (all or for a specific repository)."""
    if repo_id is None:
        _strata_graph_cache.clear()
        return
    clean_id = repo_id.strip().lower()
    keys_to_drop = [k for k in _strata_graph_cache if k[2].lower() == clean_id]
    for k in keys_to_drop:
        _strata_graph_cache.pop(k, None)


def _chunk_belongs_to_repo(f_path: str, repo_full_name: Optional[str], repo: RepositoryItem) -> bool:
    """Determine if a chunk belongs to the given repository using repoFullName or path fallback."""
    r_tag = (repo_full_name or "").strip().lower()
    if r_tag and r_tag != "local":
        return r_tag == repo.id.lower() or r_tag == repo.name.lower()

    path_lower = (f_path or "").replace("\\", "/").lower()
    if repo.id == "sample_codebase":
        return "sample_codebase" in path_lower or "sample_service" in path_lower
    if repo.id == "requests":
        return "sample_codebase" not in path_lower and "sample_service" not in path_lower

    repo_path_lower = (repo.path or "").replace("\\", "/").strip().lower().rstrip("/")
    repo_basename = repo_path_lower.split("/")[-1] if repo_path_lower else ""
    return (repo_path_lower and repo_path_lower in path_lower) or (
        repo_basename and repo_basename in path_lower
    )


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
    elif hasattr(vs, "conn") and vs.conn is not None:
        try:
            table_name = getattr(vs, "table_name", "ast_chunks")
            cursor = vs.conn.cursor()
            cursor.execute(
                f"SELECT id, filePath, fileName, astNodeType, identifier, startLine, endLine, parameters, repoFullName FROM {table_name}"
            )
            for row in cursor.fetchall():
                raw_params = row["parameters"] if "parameters" in row.keys() else None
                try:
                    parsed_params = json.loads(raw_params) if isinstance(raw_params, str) and raw_params else []
                except Exception:
                    parsed_params = [p.strip() for p in str(raw_params).split(",") if p.strip()]
                all_chunks.append({
                    "id": row["id"],
                    "filePath": row["filePath"],
                    "fileName": row["fileName"],
                    "astNodeType": row["astNodeType"],
                    "identifier": row["identifier"],
                    "startLine": row["startLine"],
                    "endLine": row["endLine"],
                    "parameters": parsed_params,
                    "repoFullName": row["repoFullName"] if "repoFullName" in row.keys() else "local",
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
        r_tag = c.get("repoFullName") or c.get("repo_full_name") or "local"
        if not _chunk_belongs_to_repo(str(f_path), str(r_tag), repo):
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


@router.get(
    "/repos/{repo_id}/strata-graph",
    response_model=StrataGraphResponse,
    summary="Get 3D Layered Strata Code Dependency Graph",
)
def get_repository_strata_graph(
    repo_id: str,
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
) -> StrataGraphResponse:
    """Retrieve 3D layered strata nodes, call dependency edges, and tier metadata for a repository."""
    repo = repo_registry.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found in registry",
        )

    vs = retrieval_service.vector_store
    try:
        store_count = vs.count() if vs is not None else 0
    except Exception:
        store_count = 0
    cache_key = (id(vs), store_count, repo.id.lower())
    if cache_key in _strata_graph_cache:
        return _strata_graph_cache[cache_key]

    all_chunks: List[AstCodeChunk] = []

    # 1. Attempt retrieval from vector store (LanceDB or SQLite)
    if vs is not None:
        if hasattr(vs, "_table") and vs._table is not None:
            try:
                records = vs._table.search().limit(5000).to_list()
                for r in records:
                    f_path = str(r.get("filePath") or r.get("file_path") or "")
                    r_tag = str(r.get("repoFullName") or r.get("repo_full_name") or "local")
                    if not _chunk_belongs_to_repo(f_path, r_tag, repo):
                        continue

                    data = dict(r)
                    data.pop("vector", None)
                    data.pop("_distance", None)
                    for k in ("parameters", "decorators", "imports", "calls"):
                        if data.get(k) is not None:
                            data[k] = list(data[k])
                        else:
                            data[k] = []
                    all_chunks.append(AstCodeChunk(**data))
            except Exception:
                pass
        elif hasattr(vs, "conn") and vs.conn is not None:
            try:
                cursor = vs.conn.cursor()
                cursor.execute(f"SELECT * FROM {getattr(vs, 'table_name', 'ast_chunks')}")
                for row in cursor.fetchall():
                    f_path = str(row["filePath"])
                    r_tag = str(row["repoFullName"]) if "repoFullName" in row.keys() else "local"
                    if not _chunk_belongs_to_repo(f_path, r_tag, repo):
                        continue

                    all_chunks.append(vs._row_to_chunk(row))
            except Exception:
                pass

    # 2. Fallback to scanning repository files directly from disk if vector store has no chunks
    if not all_chunks:
        candidates = [
            Path(repo.path),
            Path("backend") / repo.path,
            Path("..") / repo.path,
        ]
        repo_dir = None
        for cand in candidates:
            if cand.exists():
                repo_dir = cand
                break

        if repo_dir is not None:
            scanner = CodebaseScanner()
            scanned = scanner.scan_directory(str(repo_dir), repo_root=str(repo_dir))
            all_chunks.extend(scanned)

    # Deduplicate chunks by ID
    seen_ids = set()
    unique_chunks = []
    for c in all_chunks:
        if c.id not in seen_ids:
            seen_ids.add(c.id)
            unique_chunks.append(c)

    graph_response = build_strata_graph(unique_chunks, repo_id=repo.id)
    _strata_graph_cache[cache_key] = graph_response
    return graph_response


@router.get(
    "/repos/{repo_id}/file",
    summary="Get Full Source File Content for Context Viewing",
)
def get_repository_file_content(
    repo_id: str,
    path: str = Query(..., min_length=1, description="Relative file path inside the repository"),
):
    """Safely read a full Python source file belonging to an indexed repository."""
    repo = repo_registry.get_repository(repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found in registry",
        )

    candidates = [
        Path(repo.path),
        Path("backend") / repo.path,
        Path("..") / repo.path,
    ]
    repo_dir: Optional[Path] = None
    for cand in candidates:
        if cand.exists() and cand.is_dir():
            repo_dir = cand.resolve()
            break

    if repo_dir is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository directory for '{repo_id}' is not accessible on disk",
        )

    norm_rel = path.replace("\\", "/").lstrip("/")
    # Strip redundant repo path prefix if chunk.filePath already includes it
    repo_prefix = repo.path.replace("\\", "/").strip("/")
    if repo_prefix and norm_rel.lower().startswith(repo_prefix.lower() + "/"):
        norm_rel = norm_rel[len(repo_prefix) + 1 :]

    try:
        target_file = (repo_dir / norm_rel).resolve()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path",
        )

    # Strict path traversal protection: target must reside inside repo_dir
    try:
        target_file.relative_to(repo_dir)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access denied: file path escapes repository root",
        )

    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{path}' not found in repository '{repo_id}'",
        )

    content = target_file.read_text(encoding="utf-8", errors="replace")
    total_lines = len(content.splitlines())
    return {
        "repo_id": repo.id,
        "file_path": norm_rel,
        "content": content,
        "total_lines": total_lines,
    }
