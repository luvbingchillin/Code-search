"""Retrieval orchestration service coordinating hybrid vector + lexical search and entity lookup."""

import re
import time
from pathlib import Path
from typing import List, Optional, Set

from app.core.embedding import BaseEmbeddingModel
from app.models.chunk import AstCodeChunk, AstNodeType
from app.schemas.ast_chunk import EntityLookupResponse, HealthResponse, SearchResponse
from app.vector_store.base import BaseVectorStore

_STOPWORDS: Set[str] = {
    "a", "an", "and", "are", "as", "at", "be", "by", "class", "code", "def",
    "define", "defined", "do", "does", "explain", "file", "find", "for", "from",
    "function", "how", "in", "into", "is", "it", "method", "of", "on", "or",
    "show", "that", "the", "this", "to", "what", "where", "which", "with", "work",
}

_SYMBOL_CANDIDATE_RE = re.compile(r"\b(?:[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*|[A-Z][a-zA-Z0-9]{2,}|[a-z]+_[a-z0-9_]+)\b")


def _split_identifier_tokens(text: str) -> Set[str]:
    """Split camelCase, snake_case, and dotted identifiers into normalized lowercase tokens."""
    # Insert space before camelCase transitions
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    raw_tokens = re.findall(r"[A-Za-z0-9_]+", spaced.lower())
    out: Set[str] = set()
    for tok in raw_tokens:
        if len(tok) >= 2 and tok not in _STOPWORDS:
            out.add(tok)
        if "_" in tok:
            for sub in tok.split("_"):
                if len(sub) >= 2 and sub not in _STOPWORDS:
                    out.add(sub)
    return out


def _compute_lexical_boost(query: str, chunk: AstCodeChunk) -> float:
    """Compute bounded lexical/identifier relevance boost in [0.0, 0.45]."""
    q_lower = query.strip().lower()
    if not q_lower:
        return 0.0

    ident = (chunk.identifier or "").strip()
    ident_lower = ident.lower()
    base_ident = ident_lower.split(".")[-1]

    boost = 0.0

    # 1. Exact or qualified symbol mention in query
    if ident_lower and (q_lower == ident_lower or re.search(rf"(?<![a-z0-9_]){re.escape(ident_lower)}(?![a-z0-9_])", q_lower)):
        boost += 0.35
    elif base_ident and len(base_ident) >= 3 and re.search(rf"(?<![a-z0-9_]){re.escape(base_ident)}(?![a-z0-9_])", q_lower):
        boost += 0.22

    # 2. Token overlap across identifier, filePath, and docstring
    q_tokens = _split_identifier_tokens(query)
    if q_tokens:
        ident_tokens = _split_identifier_tokens(ident)
        file_tokens = _split_identifier_tokens(chunk.filePath or "")
        doc_tokens = _split_identifier_tokens((chunk.docstring or "")[:300])

        if ident_tokens:
            ident_overlap = len(q_tokens & ident_tokens) / len(q_tokens)
            boost += 0.12 * ident_overlap
        if file_tokens:
            file_overlap = len(q_tokens & file_tokens) / len(q_tokens)
            boost += 0.05 * file_overlap
        if doc_tokens:
            doc_overlap = len(q_tokens & doc_tokens) / len(q_tokens)
            boost += 0.05 * doc_overlap

    return min(0.45, boost)


def _matches_file_or_repo(chunk: AstCodeChunk, file_path: str) -> bool:
    """Check whether a chunk belongs to the requested file path or repository scope."""
    norm_target = file_path.replace("\\", "/").strip().lower().rstrip("/")
    target_path = Path(file_path)
    target_basename = norm_target.split("/")[-1]
    c_norm = (chunk.filePath or "").replace("\\", "/").lower()
    c_repo = (chunk.repoFullName or "").strip().lower()

    if c_repo and c_repo != "local" and (c_repo == norm_target or c_repo == target_basename):
        return True
    if norm_target == c_norm or norm_target in c_norm or c_norm.endswith(norm_target):
        return True
    if target_path.exists() and target_path.is_dir() and (target_path / chunk.filePath).exists():
        return True
    if c_norm == target_basename or c_norm.endswith(f"/{target_basename}"):
        return True
    return False


class RetrievalService:
    """Service coordinating hybrid vector + lexical embeddings and vector store queries."""

    def __init__(self, vector_store: BaseVectorStore, embedder: BaseEmbeddingModel):
        self.vector_store = vector_store
        self.embedder = embedder

    def search_semantic(
        self,
        query: str,
        top_k: int = 5,
        ast_node_type: Optional[AstNodeType] = None,
        file_path: Optional[str] = None,
    ) -> SearchResponse:
        """Embed search query and perform hybrid dense + lexical top-K retrieval."""
        start_time = time.perf_counter()

        # Defensive bounds check on top_k
        safe_top_k = max(1, min(top_k, 100))
        # Expand candidate pool for hybrid reranking and file_path post-filtering
        fetch_k = max(safe_top_k * 5, 50)

        # Generate query embedding vector
        query_vector = self.embedder.embed_query(query)

        # Retrieve semantic candidates from vector store
        candidates: List[AstCodeChunk] = self.vector_store.search_semantic(
            query_vector=query_vector,
            top_k=fetch_k,
            ast_node_type=ast_node_type,
        )

        # Deduplicate semantic candidates by chunk ID while preserving order
        deduped_candidates: List[AstCodeChunk] = []
        seen_ids: Set[str] = set()
        for cand in candidates:
            if cand.id not in seen_ids:
                seen_ids.add(cand.id)
                deduped_candidates.append(cand)
        candidates = deduped_candidates

        # Merge exact-symbol hits for explicit code identifiers mentioned in query
        for sym in _SYMBOL_CANDIDATE_RE.findall(query)[:4]:
            try:
                exact_hits = self.vector_store.search_exact(sym)
            except Exception:
                exact_hits = []
            for hit in exact_hits:
                if hit.id in seen_ids:
                    continue
                if ast_node_type and hit.astNodeType != ast_node_type:
                    continue
                # Give exact merged hit a strong baseline score before lexical boost
                hit.relevanceScore = max(0.65, min(0.85, hit.relevanceScore))
                candidates.append(hit)
                seen_ids.add(hit.id)

        # Optional file_path or repository filter
        if file_path:
            candidates = [c for c in candidates if _matches_file_or_repo(c, file_path)]

        # Hybrid rerank: blend dense semantic score with bounded lexical/identifier boost
        scored_candidates = []
        for c in candidates:
            lex_boost = _compute_lexical_boost(query, c)
            combined = min(1.0, max(0.0, float(c.relevanceScore) + lex_boost))
            c.relevanceScore = round(combined, 4)
            scored_candidates.append(c)

        scored_candidates.sort(key=lambda c: c.relevanceScore, reverse=True)
        chunks = scored_candidates[:safe_top_k]

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return SearchResponse(
            query=query,
            total_results=len(chunks),
            chunks=chunks,
            latency_ms=round(elapsed_ms, 2),
        )

    def search_exact(self, identifier: str) -> EntityLookupResponse:
        """Perform exact-match entity lookup for multi-hop dependency resolution."""
        clean_id = identifier.strip()
        chunks = self.vector_store.search_exact(clean_id)
        return EntityLookupResponse(
            identifier=identifier,
            count=len(chunks),
            chunks=chunks,
        )

    def get_chunk_by_id(self, chunk_id: str) -> Optional[AstCodeChunk]:
        """Fetch a specific AST code chunk by its unique ID."""
        return self.vector_store.get_by_id(chunk_id.strip())

    def get_health_stats(self) -> HealthResponse:
        """Return system health information and vector store metrics."""
        store_name = self.vector_store.__class__.__name__.replace("VectorStore", "")
        if not store_name:
            store_name = "VectorStore"
        total_chunks = self.vector_store.count()
        dim = getattr(self.embedder, "dimension", 384)
        model_name = getattr(self.embedder, "model_name", "all-MiniLM-L6-v2")
        return HealthResponse(
            status="healthy",
            vector_db=store_name,
            total_chunks=total_chunks,
            embedding_dimension=dim,
            embedding_model=model_name,
        )
