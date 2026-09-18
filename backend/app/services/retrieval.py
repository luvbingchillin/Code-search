"""Retrieval orchestration service coordinating vector search and entity lookup."""

import time
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

        # Generate query embedding vector
        query_vector = self.embedder.embed_query(query)

        # Retrieve candidates from vector store
        chunks = self.vector_store.search_semantic(
            query_vector=query_vector,
            top_k=safe_top_k,
            ast_node_type=ast_node_type,
        )

        # Optional file_path filter if requested
        if file_path:
            norm_target = file_path.replace("\\", "/").strip().lower()
            chunks = [
                c for c in chunks
                if norm_target in c.filePath.lower() or c.filePath.lower() == norm_target
            ]

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
