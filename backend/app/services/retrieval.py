"""Retrieval orchestration service coordinating vector search and entity lookup."""

import time
from pathlib import Path
from typing import Optional

from app.core.embedding import BaseEmbeddingModel
from app.models.chunk import AstCodeChunk, AstNodeType
from app.schemas.ast_chunk import EntityLookupResponse, HealthResponse, SearchResponse
from app.vector_store.base import BaseVectorStore


class RetrievalService:
    """Service coordinating vector embeddings and vector store queries."""

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
        """Embed search query and perform top-K semantic similarity retrieval."""
        start_time = time.perf_counter()

        # Defensive bounds check on top_k
        safe_top_k = max(1, min(top_k, 100))
        # Expand candidate pool if file_path post-filtering is requested to avoid candidate starvation
        fetch_k = max(safe_top_k * 5, 50) if file_path else safe_top_k

        # Generate query embedding vector
        query_vector = self.embedder.embed_query(query)

        # Retrieve candidates from vector store
        chunks = self.vector_store.search_semantic(
            query_vector=query_vector,
            top_k=fetch_k,
            ast_node_type=ast_node_type,
        )

        # Optional file_path or repository filter if requested
        if file_path:
            norm_target = file_path.replace("\\", "/").strip().lower().rstrip("/")
            target_path = Path(file_path)
            target_basename = norm_target.split("/")[-1]

            filtered = []
            for c in chunks:
                c_norm = c.filePath.replace("\\", "/").lower()
                # 1. Exact or substring match in c.filePath
                if norm_target == c_norm or norm_target in c_norm or c_norm.endswith(norm_target):
                    filtered.append(c)
                # 2. If target is a directory, check if c.filePath resides within that directory
                elif target_path.exists() and target_path.is_dir() and (target_path / c.filePath).exists():
                    filtered.append(c)
                # 3. Match if c_norm ends with target or matches target basename
                elif c_norm == target_basename or c_norm.endswith(f"/{target_basename}"):
                    filtered.append(c)

            chunks = filtered[:safe_top_k]

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
