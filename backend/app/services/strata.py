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


def _classify_chunk_tier_with_confidence(chunk: AstCodeChunk) -> tuple[int, bool]:
    """Classify an AST code chunk into an architectural tier (0 to 3) with signal confidence.

    Returns (tier, is_strong_signal) where is_strong_signal is False only when
    classification fell through to the generic Tier 2 fallback.
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
            return 3, True

    if base_name in ("main", "cli", "app", "server", "entrypoint", "wsgi", "asgi", "router"):
        return 3, True

    if ident_lower in ("main", "cli", "run_server", "create_app", "get_app", "lifespan"):
        return 3, True

    # 2. Tier 0: Foundation / Primitives (models, types, config)
    foundation_path_tokens = {
        "models", "model", "schemas", "schema", "types", "type",
        "config", "settings", "constants", "consts", "exceptions",
        "structures", "compat", "certs", "status_codes", "primitives",
    }
    if any(token in path_parts or base_name == token for token in foundation_path_tokens):
        return 0, True

    if any(ident_lower.endswith(suffix) for suffix in (
        "model", "schema", "config", "settings", "type", "types",
        "exception", "error", "entity", "enum", "dto", "state",
    )):
        return 0, True

    if ast_type == "Assign":
        return 0, True

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
            return 2, True
        return 1, True

    if any(ident_lower.endswith(suffix) for suffix in (
        "adapter", "store", "database", "service", "client",
        "connection", "pool", "embedder", "repository", "registry",
    )):
        return 1, True

    if any(term in ident_lower for term in (
        "fetch", "remote", "client", "adapter", "store", "send", "download",
    )):
        return 1, True

    # 4. Tier 2: Core Logic (parser, processing)
    core_path_tokens = {
        "parser", "parsers", "extractor", "scanner", "processing", "processor",
        "calculator", "calc", "core", "engine", "workflow", "compiler",
        "algorithms", "algorithm", "transform", "transformer", "utils", "util",
        "helpers", "helper", "sessions", "session", "cookies", "auth", "hooks",
    }
    if any(token in path_parts or base_name == token for token in core_path_tokens):
        return 2, True

    if any(term in ident_lower for term in (
        "parse", "extract", "scan", "process", "calculate", "compute",
        "transform", "compile", "workflow", "session", "cookie", "auth",
        "validate", "format", "helper", "util",
    )):
        return 2, True

    # Default fallback: Tier 2 (Core Logic), low confidence so call topology may refine
    return 2, False


def classify_chunk_tier(chunk: AstCodeChunk) -> int:
    """Classify an AST code chunk into an architectural tier (0 to 3).

    Tier 0: Foundation / Primitives (models, types, config)
    Tier 1: Adapters / Transport (services, vector store, db)
    Tier 2: Core Logic (parser, processing)
    Tier 3: Entrypoints (api, main, cli)
    """
    tier, _ = _classify_chunk_tier_with_confidence(chunk)
    return tier


def _import_tokens(imports: Optional[List[str]]) -> Set[str]:
    """Extract normalized module/symbol tokens from a chunk's import list."""
    tokens: Set[str] = set()
    for raw in imports or []:
        cleaned = raw.strip().lstrip(".")
        if not cleaned:
            continue
        for part in cleaned.split("."):
            if part:
                tokens.add(part.lower())
    return tokens


def _candidate_matches_imports(cand: AstCodeChunk, caller_import_tokens: Set[str]) -> bool:
    """Check whether a candidate chunk belongs to a module or symbol imported by caller."""
    cand_stem = Path((cand.filePath or "").replace("\\", "/")).stem.lower()
    cand_ident = cand.identifier.lower()
    cand_owner = cand_ident.split(".", 1)[0]
    if cand_stem and cand_stem in caller_import_tokens:
        return True
    if cand_owner in caller_import_tokens or cand_ident.split(".")[-1] in caller_import_tokens:
        return True
    return False


def build_strata_graph(chunks: List[AstCodeChunk], repo_id: str) -> StrataGraphResponse:
    """Build a 3D Layered Strata dependency graph from extracted AST code chunks.

    Applies class-tier cohesion so methods remain co-located with their owning
    ClassDef tier, emits import-weighted call edges and inheritance edges, and
    refines unanchored fallback nodes using call topology.
    """
    raw_tiers: Dict[str, int] = {}
    strong_signal: Dict[str, bool] = {}
    class_tiers: Dict[tuple, int] = {}
    methods_by_class: Dict[tuple, List[AstCodeChunk]] = {}

    for chunk in chunks:
        tier, is_strong = _classify_chunk_tier_with_confidence(chunk)
        raw_tiers[chunk.id] = tier
        strong_signal[chunk.id] = is_strong
        norm_path = (chunk.filePath or "").replace("\\", "/")
        if chunk.astNodeType == "ClassDef":
            class_tiers[(norm_path, chunk.identifier)] = tier
        elif "." in chunk.identifier:
            owner_class = chunk.identifier.split(".", 1)[0]
            methods_by_class.setdefault((norm_path, owner_class), []).append(chunk)

    # Promote rich domain classes in models.py (e.g. PreparedRequest, Response) from Tier 0 to Tier 2
    passive_suffixes = ("error", "exception", "config", "settings", "schema", "enum", "dto", "status")
    for chunk in chunks:
        if chunk.astNodeType == "ClassDef":
            norm_path = (chunk.filePath or "").replace("\\", "/")
            key = (norm_path, chunk.identifier)
            if class_tiers.get(key) == 0 and not chunk.identifier.lower().endswith(passive_suffixes):
                cls_methods = methods_by_class.get(key, [])
                total_method_calls = sum(len(m.calls or []) for m in cls_methods)
                if len(cls_methods) >= 5 and total_method_calls >= 5:
                    raw_tiers[chunk.id] = 2
                    class_tiers[key] = 2
                    strong_signal[chunk.id] = True

    # Class-cohesion pass: keep Class.method on the same floor as its parent ClassDef
    anchored_to_class: Set[str] = set()
    for chunk in chunks:
        if "." in chunk.identifier:
            owner_class = chunk.identifier.split(".", 1)[0]
            norm_path = (chunk.filePath or "").replace("\\", "/")
            if (norm_path, owner_class) in class_tiers:
                raw_tiers[chunk.id] = class_tiers[(norm_path, owner_class)]
                anchored_to_class.add(chunk.id)

    # 2. Build callee candidate lookup tables for fast edge matching
    by_exact_ident: Dict[str, List[AstCodeChunk]] = {}
    by_base_ident: Dict[str, List[AstCodeChunk]] = {}
    local_module_stems: Set[str] = set()
    classes_by_ident: Dict[str, List[AstCodeChunk]] = {}

    for c in chunks:
        by_exact_ident.setdefault(c.identifier, []).append(c)
        base = c.identifier.split(".")[-1]
        by_base_ident.setdefault(base, []).append(c)
        stem = Path((c.filePath or "").replace("\\", "/")).stem.lower()
        if stem and stem != "__init__":
            local_module_stems.add(stem)
        if c.astNodeType == "ClassDef":
            classes_by_ident.setdefault(c.identifier, []).append(c)

    # 3. Generate Edges: link caller AST chunk ID to callee AST chunk ID & subclass -> base class
    edges: List[StrataEdge] = []
    seen_edges: Set[tuple] = set()
    in_degree: Dict[str, int] = {}
    out_degree: Dict[str, int] = {}

    for caller in chunks:
        caller_import_tokens = _import_tokens(caller.imports)
        caller_import_roots = {
            raw.strip().lstrip(".").split(".")[0].lower()
            for raw in (caller.imports or [])
            if raw.strip().lstrip(".")
        }

        # 3a. Inheritance edges from ClassDef bases
        if caller.astNodeType == "ClassDef" and caller.bases:
            for base_expr in caller.bases:
                base_name = base_expr.split("[", 1)[0].strip().split(".")[-1]
                if not base_name or base_name == caller.identifier:
                    continue
                base_cands = [
                    b for b in classes_by_ident.get(base_name, [])
                    if b.id != caller.id
                ]
                if not base_cands:
                    continue
                same_file_bases = [b for b in base_cands if b.filePath == caller.filePath]
                chosen_bases = same_file_bases
                if not chosen_bases and caller_import_tokens:
                    chosen_bases = [b for b in base_cands if _candidate_matches_imports(b, caller_import_tokens)]
                if not chosen_bases:
                    chosen_bases = base_cands
                for target_cls in chosen_bases:
                    edge_key = (caller.id, target_cls.id, f"extends:{base_name}")
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)
                        out_degree[caller.id] = out_degree.get(caller.id, 0) + 1
                        in_degree[target_cls.id] = in_degree.get(target_cls.id, 0) + 1
                        edges.append(
                            StrataEdge(
                                id=f"{caller.id}-inherits->{target_cls.id}",
                                source=caller.id,
                                target=target_cls.id,
                                callName=f"extends {target_cls.identifier}",
                                edgeType="inherits",
                            )
                        )

        # 3b. Call reference edges
        caller_calls = caller.calls or []
        for raw_call in caller_calls:
            call_str = raw_call.strip()
            if not call_str:
                continue

            call_clean = call_str.rstrip("()")
            call_base = call_clean.split(".")[-1]
            is_self_call = call_clean.startswith("self.")
            caller_class = caller.identifier.split(".")[0] if "." in caller.identifier else None

            # Skip explicit calls on imported external/stdlib modules (e.g. external_pkg.validate())
            if "." in call_clean and not is_self_call:
                receiver_root = call_clean.split(".", 1)[0].lower()
                if (
                    receiver_root in caller_import_roots
                    and receiver_root not in local_module_stems
                    and receiver_root not in {k.lower() for k in by_exact_ident}
                ):
                    continue

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

            # Prioritize matching candidates in the same file, then import-matched files across repo
            same_file_cands = [cand for cand in valid_candidates if cand.filePath == caller.filePath]
            if same_file_cands:
                chosen = same_file_cands
            elif caller_import_tokens:
                import_matched = [cand for cand in valid_candidates if _candidate_matches_imports(cand, caller_import_tokens)]
                chosen = import_matched if import_matched else (valid_candidates if len(valid_candidates) == 1 else [])
            else:
                chosen = valid_candidates

            for target in chosen:
                edge_key = (caller.id, target.id, call_clean)
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    out_degree[caller.id] = out_degree.get(caller.id, 0) + 1
                    in_degree[target.id] = in_degree.get(target.id, 0) + 1
                    edge_id = f"{caller.id}->{target.id}:{call_clean}"
                    edges.append(
                        StrataEdge(
                            id=edge_id,
                            source=caller.id,
                            target=target.id,
                            callName=call_clean,
                            edgeType="call",
                        )
                    )

    # Topology refinement for ambiguous unanchored fallback symbols only
    for chunk in chunks:
        if strong_signal.get(chunk.id, False) or chunk.id in anchored_to_class:
            continue
        inc = in_degree.get(chunk.id, 0)
        out = out_degree.get(chunk.id, 0)
        if out == 0 and inc > 0:
            raw_tiers[chunk.id] = 0
        elif inc == 0 and out >= 2:
            raw_tiers[chunk.id] = 3

    # Build final nodes and tier counts after cohesion & topology refinement
    nodes: List[StrataNode] = []
    tier_counts: Dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0}
    for chunk in chunks:
        tier = raw_tiers[chunk.id]
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
                bases=list(chunk.bases or []),
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
