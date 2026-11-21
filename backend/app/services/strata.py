"""Service for 3D Layered Strata Code Dependency Model and Tier Classification."""

import logging
from typing import Dict, List, Optional, Set
from pathlib import Path

from app.models.chunk import AstCodeChunk
from app.schemas.strata import (
    StrataEdge,
    StrataGraphResponse,
    StrataNode,
    StrataTierInfo,
)

logger = logging.getLogger(__name__)

# Canonical Tier Metadata Definitions conforming to Precision Dark Slate IDE palette
# Note: Electric Sky (#38bdf8) is reserved exclusively for active AI citations.
TIER_DEFINITIONS = [
    {
        "tier": 0,
        "name": "Foundation / Primitives",
        "description": "Data structures, models, schemas, types, and configuration (models, types, config)",
        "color": "#818cf8",
    },
    {
        "tier": 1,
        "name": "Adapters / Transport",
        "description": "I/O adapters, network transport, database layers, vector stores, and external service clients (services, vector store, db)",
        "color": "#a855f7",
    },
    {
        "tier": 2,
        "name": "Core Logic",
        "description": "Domain logic, AST parsers, processing pipelines, algorithms, and session management (parser, processing)",
        "color": "#f59e0b",
    },
    {
        "tier": 3,
        "name": "Entrypoints",
        "description": "Public API routes, routers, CLI commands, and application bootstrap entrypoints (api, main, cli)",
        "color": "#34d399",
    },
]

# Ubiquitous Python stdlib / container method names that cause false-positive
# cross-file spiderweb edges when matched purely by unqualified base name.
_AMBIGUOUS_METHOD_NAMES: Set[str] = {
    "get", "set", "items", "keys", "values", "pop", "copy", "update", "clear",
    "close", "append", "extend", "insert", "remove", "sort", "reverse", "count",
    "index", "find", "replace", "strip", "lstrip", "rstrip", "split", "rsplit",
    "join", "format", "lower", "upper", "startswith", "endswith", "encode",
    "decode", "read", "write", "seek", "tell", "flush", "add", "discard",
}


def classify_chunk_tier(chunk: AstCodeChunk) -> int:
    """Classify an AST code chunk into an architectural tier (0 to 3).

    Tier 0: Foundation / Primitives (models, types, config)
    Tier 1: Adapters / Transport (services, vector store, db)
    Tier 2: Core Logic (parser, processing)
    Tier 3: Entrypoints (api, main, cli)
    """
    path_lower = (chunk.filePath or "").replace("\\", "/").lower()
    file_name = (chunk.fileName or "").lower()
    ident = chunk.identifier
    ident_lower = ident.lower()
    ast_type = chunk.astNodeType

    # Extract path tokens and base file name without extension
    path_parts = [p for p in path_lower.split("/") if p]
    base_name = file_name.rsplit(".", 1)[0] if "." in file_name else file_name

    # 1. Tier 3: Entrypoints (api, main, cli)
    entrypoint_path_tokens = {"api", "endpoints", "routes", "routers", "cli"}
    if any(token in path_parts for token in entrypoint_path_tokens):
        # Do not override if explicitly an isolated data model/schema/config inside api
        if not (any(k in ident_lower for k in ("model", "schema", "config")) and ast_type == "ClassDef"):
            return 3

    if base_name in ("main", "cli", "app", "server", "entrypoint", "wsgi", "asgi", "router"):
        return 3

    if ident_lower in ("main", "cli", "run_server", "create_app", "get_app", "lifespan"):
        return 3

    # 2. Tier 0: Foundation / Primitives (models, types, config)
    foundation_path_tokens = {
        "models", "model", "schemas", "schema", "types", "type",
        "config", "settings", "constants", "consts", "exceptions",
        "structures", "compat", "certs", "status_codes", "primitives",
    }
    if any(token in path_parts or base_name == token for token in foundation_path_tokens):
        return 0

    if any(ident_lower.endswith(suffix) for suffix in (
        "model", "schema", "config", "settings", "type", "types",
        "exception", "error", "entity", "enum", "dto", "state",
    )):
        return 0

    if ast_type == "Assign":
        return 0

    # 3. Tier 1: Adapters / Transport (services, vector store, db)
    adapter_path_tokens = {
        "adapters", "adapter", "transport", "transports", "services", "service",
        "vector_store", "vectorstore", "store", "stores", "db", "database",
        "storage", "client", "clients", "connection", "pool", "retrieval",
        "embedder", "lance", "sqlite",
    }
    if any(token in path_parts or base_name == token for token in adapter_path_tokens):
        # Check if more specific to core parser/logic
        if "parser" in ident_lower or "extractor" in ident_lower or "calc" in ident_lower:
            return 2
        return 1

    if any(ident_lower.endswith(suffix) for suffix in (
        "adapter", "store", "database", "service", "client",
        "connection", "pool", "embedder", "repository", "registry",
    )):
        return 1

    if any(term in ident_lower for term in (
        "fetch", "remote", "client", "adapter", "store", "send", "download",
    )):
        return 1

    # 4. Tier 2: Core Logic (parser, processing)
    core_path_tokens = {
        "parser", "parsers", "extractor", "scanner", "processing", "processor",
        "calculator", "calc", "core", "engine", "workflow", "compiler",
        "algorithms", "algorithm", "transform", "transformer", "utils", "util",
        "helpers", "helper", "sessions", "session", "cookies", "auth", "hooks",
    }
    if any(token in path_parts or base_name == token for token in core_path_tokens):
        return 2

    if any(term in ident_lower for term in (
        "parse", "extract", "scan", "process", "calculate", "compute",
        "transform", "compile", "workflow", "session", "cookie", "auth",
        "validate", "format", "helper", "util",
    )):
        return 2

    # Default fallback: Tier 2 (Core Logic)
    return 2


def build_strata_graph(chunks: List[AstCodeChunk], repo_id: str) -> StrataGraphResponse:
    """Build a 3D Layered Strata dependency graph from extracted AST code chunks.

    Args:
        chunks: List of AstCodeChunk instances belonging to the repository.
        repo_id: Unique identifier of the repository.

    Returns:
        StrataGraphResponse containing nodes, edges, and tier metadata.
    """
    nodes: List[StrataNode] = []
    tier_counts: Dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0}

    # 1. Generate Nodes and track tier distribution
    for chunk in chunks:
        tier = classify_chunk_tier(chunk)
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        nodes.append(
            StrataNode(
                id=chunk.id,
                identifier=chunk.identifier,
                filePath=chunk.filePath,
                astNodeType=chunk.astNodeType,
                tier=tier,
                startLine=chunk.startLine,
                endLine=chunk.endLine,
            )
        )

    # 2. Build callee candidate lookup tables for fast edge matching
    by_exact_ident: Dict[str, List[AstCodeChunk]] = {}
    by_base_ident: Dict[str, List[AstCodeChunk]] = {}

    for c in chunks:
        by_exact_ident.setdefault(c.identifier, []).append(c)
        base = c.identifier.split(".")[-1]
        by_base_ident.setdefault(base, []).append(c)

    # 3. Generate Edges: link caller AST chunk ID to callee AST chunk ID
    edges: List[StrataEdge] = []
    seen_edges: Set[tuple] = set()

    for caller in chunks:
        caller_calls = caller.calls or []
        for raw_call in caller_calls:
            call_str = raw_call.strip()
            if not call_str:
                continue

            call_clean = call_str.rstrip("()")
            call_base = call_clean.split(".")[-1]
            is_self_call = call_clean.startswith("self.")
            caller_class = caller.identifier.split(".")[0] if "." in caller.identifier else None

            candidates: List[AstCodeChunk] = []
            if call_clean in by_exact_ident:
                candidates = by_exact_ident[call_clean]
            elif is_self_call and caller_class and f"{caller_class}.{call_base}" in by_exact_ident:
                candidates = by_exact_ident[f"{caller_class}.{call_base}"]
            elif call_base in by_base_ident:
                raw_cands = by_base_ident[call_base]
                # Guard against ambiguous container/stdlib method names (e.g. dict.get, resp.close)
                if call_base in _AMBIGUOUS_METHOD_NAMES:
                    same_file_only = [cand for cand in raw_cands if cand.filePath == caller.filePath]
                    candidates = same_file_only if same_file_only else []
                else:
                    candidates = raw_cands

            if not candidates:
                continue

            # Exclude self-loops
            valid_candidates = [cand for cand in candidates if cand.id != caller.id]
            if not valid_candidates:
                continue

            # Prioritize matching candidates in the same file / class
            same_file_cands = [cand for cand in valid_candidates if cand.filePath == caller.filePath]
            chosen = same_file_cands if same_file_cands else valid_candidates

            for target in chosen:
                edge_key = (caller.id, target.id, call_clean)
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    edge_id = f"{caller.id}->{target.id}:{call_clean}"
                    edges.append(
                        StrataEdge(
                            id=edge_id,
                            source=caller.id,
                            target=target.id,
                            callName=call_clean,
                        )
                    )

    # 4. Assemble tier metadata
    tiers_info = [
        StrataTierInfo(
            tier=t["tier"],
            name=t["name"],
            description=t["description"],
            color=t["color"],
            nodeCount=tier_counts.get(t["tier"], 0),
        )
        for t in TIER_DEFINITIONS
    ]

    return StrataGraphResponse(
        repo_id=repo_id,
        nodes=nodes,
        edges=edges,
        tiers=tiers_info,
        total_nodes=len(nodes),
        total_edges=len(edges),
    )
