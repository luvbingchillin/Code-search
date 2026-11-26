"""Repository registry and metadata endpoints."""

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

    # Search semantic chunks strictly scoped to repository
    resp = retrieval_service.search_semantic(
        query="def ",
        top_k=limit,
        repo_id=repo.id,
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
    repo_chunks: List[AstCodeChunk] = vs.list_by_repo(repo.id, limit=5000) if vs is not None else []

    # Deduplicate chunks by id
    seen_ids = set()
    unique_chunks: List[AstCodeChunk] = []
    for c in repo_chunks:
        if c.id and c.id not in seen_ids:
            seen_ids.add(c.id)
            unique_chunks.append(c)

    # Group by filePath
    files_map = {}
    for c in unique_chunks:
        f_path = c.filePath or "unknown.py"
        f_name = c.fileName or f_path.split("/")[-1].split("\\")[-1]

        if f_path not in files_map:
            files_map[f_path] = {
                "filePath": f_path,
                "fileName": f_name,
                "symbols": [],
            }

        files_map[f_path]["symbols"].append(
            FileSymbolNode(
                id=c.id,
                identifier=c.identifier,
                astNodeType=c.astNodeType,
                startLine=c.startLine,
                endLine=c.endLine,
                parameters=list(c.parameters or []),
            )
        )

    # Fallback to scanning repository files directly from disk if vector store had no matching chunks
    if not files_map:
        project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
        candidates = [
            Path(repo.path),
            project_root / repo.path,
            Path("backend") / repo.path,
            Path("..") / repo.path,
        ]
        repo_dir = next((cand for cand in candidates if cand.exists() and cand.is_dir()), None)
        if repo_dir is not None:
            scanner = CodebaseScanner()
            scanned_chunks = scanner.scan_directory(str(repo_dir), repo_root=str(repo_dir))
            for sc in scanned_chunks:
                if sc.id in seen_ids:
                    continue
                seen_ids.add(sc.id)
                f_path = sc.filePath or "unknown.py"
                f_name = sc.fileName or f_path.split("/")[-1].split("\\")[-1]
                if f_path not in files_map:
                    files_map[f_path] = {
                        "filePath": f_path,
                        "fileName": f_name,
                        "symbols": [],
                    }
                files_map[f_path]["symbols"].append(
                    FileSymbolNode(
                        id=sc.id,
                        identifier=sc.identifier,
                        astNodeType=sc.astNodeType,
                        startLine=sc.startLine,
                        endLine=sc.endLine,
                        parameters=list(sc.parameters or []),
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

    all_chunks: List[AstCodeChunk] = vs.list_by_repo(repo.id, limit=5000) if vs is not None else []

    # 2. Fallback to scanning repository files directly from disk if vector store has no chunks
    if not all_chunks:
        project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
        candidates = [
            Path(repo.path),
            project_root / repo.path,
            Path("backend") / repo.path,
            Path("..") / repo.path,
        ]
        repo_dir = next((cand for cand in candidates if cand.exists()), None)

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

    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    candidates = [
        Path(repo.path),
        project_root / repo.path,
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
        rel_inside = target_file.relative_to(repo_dir)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access denied: file path escapes repository root",
        )

    # Security hardening: restrict file viewer to Python source files and block hidden dotfiles (.env, .git, etc.)
    if target_file.suffix.lower() not in (".py", ".pyi") or any(part.startswith(".") for part in rel_inside.parts):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access denied: only visible Python source files (.py / .pyi) can be viewed",
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
