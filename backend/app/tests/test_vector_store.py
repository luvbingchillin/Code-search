"""Unit and integration tests for Vector Store, Embedding, and Ingestion Pipeline."""

import os
from pathlib import Path
from typing import List
import numpy as np
import pytest

from app.core.embedding import (
    BaseEmbeddingModel,
    MockEmbeddingModel,
    SentenceTransformerEmbedder,
)
from app.models.chunk import AstCodeChunk
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


# ============================================================================
# 1. Embedding Model Tests
# ============================================================================

def test_mock_embedding_model_shape_and_norm():
    """Verify MockEmbeddingModel produces correct dimension and unit-norm vectors."""
    model = MockEmbeddingModel(dimension=384)
    assert model.dimension == 384

    vec = model.embed_query("def foo(): pass")
    assert isinstance(vec, np.ndarray)
    assert vec.shape == (384,)
    assert vec.dtype == np.float32
    assert np.linalg.norm(vec) == pytest.approx(1.0, abs=1e-4)


def test_mock_embedding_model_determinism():
    """Verify identical text produces identical vectors, different text produces different vectors."""
    model = MockEmbeddingModel(dimension=384)

    vec1 = model.embed_query("hello world")
    vec2 = model.embed_query("hello world")
    vec3 = model.embed_query("different text")

    np.testing.assert_allclose(vec1, vec2)
    assert not np.allclose(vec1, vec3)


def test_mock_embedding_model_batch_documents():
    """Verify batch embedding on multiple texts and empty list handling."""
    model = MockEmbeddingModel(dimension=384)

    texts = ["chunk one", "chunk two", "chunk three"]
    embeddings = model.embed_documents(texts)
    assert embeddings.shape == (3, 384)
    assert embeddings.dtype == np.float32

    for row in embeddings:
        assert np.linalg.norm(row) == pytest.approx(1.0, abs=1e-4)

    # Empty list edge case
    empty_emb = model.embed_documents([])
    assert empty_emb.shape == (0, 384)


def test_sentence_transformer_embedder_lazy_load():
    """Verify SentenceTransformerEmbedder does not instantiate network until requested."""
    embedder = SentenceTransformerEmbedder(model_name="all-MiniLM-L6-v2")
    assert embedder._model is None
    assert embedder.dimension == 384


def test_sentence_transformer_embedder_mocked_execution(monkeypatch):
    """Verify SentenceTransformerEmbedder delegates correctly to underlying encode method."""
    class FakeSTModel:
        def get_sentence_embedding_dimension(self):
            return 384

        def encode(self, texts, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False):
            if isinstance(texts, str):
                v = np.ones(384, dtype=np.float32)
                return v / np.linalg.norm(v)
            matrix = np.ones((len(texts), 384), dtype=np.float32)
            return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)

    embedder = SentenceTransformerEmbedder(model_name="test-model")
    monkeypatch.setattr(embedder, "_get_model", lambda: FakeSTModel())

    assert embedder.dimension == 384
    q_vec = embedder.embed_query("sample query")
    assert q_vec.shape == (384,)
    assert np.linalg.norm(q_vec) == pytest.approx(1.0, abs=1e-4)

    docs_vec = embedder.embed_documents(["doc1", "doc2"])
    assert docs_vec.shape == (2, 384)
    assert docs_vec.dtype == np.float32


# ============================================================================
# 2. LanceDBVectorStore Tests
# ============================================================================

def test_lance_store_empty_operations(lance_store: LanceDBVectorStore):
    """Verify operations on an empty LanceDB store return graceful empty results."""
    assert lance_store.count() == 0
    assert lance_store.search_exact("missing_func") == []
    assert lance_store.search_semantic(np.zeros(384, dtype=np.float32), top_k=5) == []
    assert lance_store.get_by_id("missing_id") is None


def test_lance_store_crud_and_exact_match(
    lance_store: LanceDBVectorStore,
    sample_chunks: List[AstCodeChunk],
    mock_embedder: MockEmbeddingModel,
):
    """Verify chunk addition, exact-match retrieval, and get_by_id in LanceDB."""
    texts = [c.code for c in sample_chunks]
    embeddings = mock_embedder.embed_documents(texts)

    lance_store.add_chunks(sample_chunks, embeddings)
    assert lance_store.count() == len(sample_chunks)

    # Exact search for Calculator
    calc_results = lance_store.search_exact("Calculator")
    assert len(calc_results) == 1
    assert calc_results[0].identifier == "Calculator"
    assert calc_results[0].astNodeType == "ClassDef"
    assert calc_results[0].relevanceScore == 1.0

    # Exact search for method Calculator.multiply
    method_results = lance_store.search_exact("Calculator.multiply")
    assert len(method_results) == 1
    assert method_results[0].identifier == "Calculator.multiply"
    assert "multiply" in method_results[0].code
    assert method_results[0].parameters == ["self", "x: float", "y: float"]

    # get_by_id
    target_id = sample_chunks[0].id
    retrieved = lance_store.get_by_id(target_id)
    assert retrieved is not None
    assert retrieved.id == target_id
    assert retrieved.identifier == sample_chunks[0].identifier

    # Nonexistent ID
    assert lance_store.get_by_id("does:not:exist") is None


def test_lance_store_semantic_search_and_filtering(
    lance_store: LanceDBVectorStore,
    sample_chunks: List[AstCodeChunk],
    mock_embedder: MockEmbeddingModel,
):
    """Verify semantic search returns top-k results with normalized scores and node type filtering."""
    texts = [c.code for c in sample_chunks]
    embeddings = mock_embedder.embed_documents(texts)
    lance_store.add_chunks(sample_chunks, embeddings)

    # Query with the exact embedding of Calculator.multiply (should rank #1)
    query_vec = embeddings[2]
    results = lance_store.search_semantic(query_vec, top_k=3)

    assert len(results) <= 3
    assert len(results) > 0
    # Top result should be Calculator.multiply with high relevance score
    assert results[0].identifier == "Calculator.multiply"
    for r in results:
        assert 0.0 <= r.relevanceScore <= 1.0

    # Test AST node type filtering
    class_results = lance_store.search_semantic(query_vec, top_k=5, ast_node_type="ClassDef")
    assert all(r.astNodeType == "ClassDef" for r in class_results)
    assert any(r.identifier == "Calculator" for r in class_results)

    async_results = lance_store.search_semantic(query_vec, top_k=5, ast_node_type="AsyncFunctionDef")
    assert all(r.astNodeType == "AsyncFunctionDef" for r in async_results)
    assert any(r.identifier == "fetch_async" for r in async_results)


# ============================================================================
# 3. SQLiteVectorStore Tests
# ============================================================================

def test_sqlite_store_empty_operations(memory_sqlite_store: SQLiteVectorStore):
    """Verify operations on an empty SQLite vector store."""
    assert memory_sqlite_store.count() == 0
    assert memory_sqlite_store.search_exact("none") == []
    assert memory_sqlite_store.search_semantic(np.ones(384, dtype=np.float32), top_k=5) == []
    assert memory_sqlite_store.get_by_id("none") is None


def test_sqlite_store_crud_and_retrieval(
    sqlite_store: SQLiteVectorStore,
    sample_chunks: List[AstCodeChunk],
    mock_embedder: MockEmbeddingModel,
):
    """Verify SQLite vector store insertion, exact search, get_by_id, and semantic search."""
    texts = [c.code for c in sample_chunks]
    embeddings = mock_embedder.embed_documents(texts)

    sqlite_store.add_chunks(sample_chunks, embeddings)
    assert sqlite_store.count() == len(sample_chunks)

    # Exact search
    exact = sqlite_store.search_exact("calculate_sum")
    assert len(exact) == 1
    assert exact[0].identifier == "calculate_sum"
    assert exact[0].relevanceScore == 1.0

    # get_by_id
    item = sqlite_store.get_by_id(sample_chunks[3].id)
    assert item is not None
    assert item.identifier == "fetch_async"
    assert item.astNodeType == "AsyncFunctionDef"
    assert item.decorators == ["@log_execution"]

    # Semantic search with query vector equal to fetch_async embedding
    q_vec = embeddings[3]
    sem_results = sqlite_store.search_semantic(q_vec, top_k=2)
    assert len(sem_results) == 2
    assert sem_results[0].identifier == "fetch_async"
    for r in sem_results:
        assert 0.0 <= r.relevanceScore <= 1.0

    # Node type filtering
    filtered = sqlite_store.search_semantic(q_vec, top_k=5, ast_node_type="ClassDef")
    assert all(r.astNodeType == "ClassDef" for r in filtered)


# ============================================================================
# 4. Vector Ingestion Service & End-to-End Codebase Tests
# ============================================================================

def test_ingestion_service_prepare_chunk_text(sample_chunks: List[AstCodeChunk]):
    """Verify prepare_chunk_text formats identifier, docstring, parameters, and code."""
    embedder = MockEmbeddingModel(dimension=384)
    store = SQLiteVectorStore(":memory:")
    service = VectorIngestionService(embedder=embedder, vector_store=store)

    text = service.prepare_chunk_text(sample_chunks[0])
    assert "Entity: calculate_sum" in text
    assert "Type: FunctionDef" in text
    assert "Docstring:" in text
    assert "Parameters: a: int, b: int" in text
    assert "def calculate_sum" in text


def test_ingestion_service_e2e_sample_codebase(tmp_path: Path):
    """End-to-end test ingesting sample_codebase into LanceDB and SQLite stores."""
    codebase_dir = Path("backend/sample_codebase").resolve()
    if not codebase_dir.exists():
        # Fallback if executing from root vs backend
        codebase_dir = Path("sample_codebase").resolve()

    assert codebase_dir.exists(), f"sample_codebase dir not found at {codebase_dir}"

    embedder = MockEmbeddingModel(dimension=384)

    # Test 1: Ingest into LanceDB
    lance_path = tmp_path / "lance_e2e"
    lance_store = LanceDBVectorStore(db_path=str(lance_path))
    lance_store.initialize()

    lance_service = VectorIngestionService(
        embedder=embedder,
        vector_store=lance_store,
        batch_size=8,
    )
    count_ingested = lance_service.ingest_directory(str(codebase_dir))

    # All 24 entities from sample_service.py must be indexed
    assert count_ingested == 24
    assert lance_store.count() == 24

    # Verify exact match for key entities
    stats_exact = lance_store.search_exact("calculate_statistics")
    assert len(stats_exact) == 1
    assert stats_exact[0].astNodeType == "FunctionDef"
    assert any("precision" in p for p in stats_exact[0].parameters)

    entity_exact = lance_store.search_exact("BaseEntity")
    assert len(entity_exact) == 1
    assert entity_exact[0].astNodeType == "ClassDef"

    method_exact = lance_store.search_exact("BaseEntity.entity_id")
    assert len(method_exact) == 1

    # Verify semantic search with query
    query_vec = embedder.embed_query("calculate statistics and standard deviation")
    sem_matches = lance_store.search_semantic(query_vec, top_k=5)
    assert len(sem_matches) == 5
    for m in sem_matches:
        assert 0.0 <= m.relevanceScore <= 1.0

    lance_store.close()

    # Test 2: Ingest into SQLiteVectorStore
    sqlite_store = SQLiteVectorStore(":memory:")
    sqlite_store.initialize()
    sqlite_service = VectorIngestionService(
        embedder=embedder,
        vector_store=sqlite_store,
        batch_size=16,
    )
    sqlite_count = sqlite_service.ingest_directory(str(codebase_dir))

    assert sqlite_count == 24
    assert sqlite_store.count() == 24

    # Exact search in SQLite
    res = sqlite_store.search_exact("fetch_remote_resource")
    assert len(res) == 1
    assert res[0].astNodeType == "AsyncFunctionDef"
    assert "@log_execution" in res[0].decorators

    # Semantic search in SQLite
    sqlite_matches = sqlite_store.search_semantic(query_vec, top_k=5)
    assert len(sqlite_matches) == 5
    for m in sqlite_matches:
        assert 0.0 <= m.relevanceScore <= 1.0

    sqlite_store.close()


def test_special_characters_and_quote_escaping(
    lance_store: LanceDBVectorStore,
    memory_sqlite_store: SQLiteVectorStore,
    mock_embedder: MockEmbeddingModel,
):
    """Verify resilience against single quotes, SQL injections, and multiline code."""
    chunk = AstCodeChunk(
        id="edge/case.py::O'Connor.test'\"quote:1-10",
        filePath="edge/case.py",
        fileName="case.py",
        astNodeType="FunctionDef",
        identifier="O'Connor.test'\"quote",
        startLine=1,
        endLine=10,
        code="def test():\n    '''It's an edge case with 'single' and \"double\" quotes.'''\n    pass",
        relevanceScore=1.0,
        docstring="It's an edge case with 'single' and \"double\" quotes.",
        parameters=["arg='default'"],
        decorators=["@escape('val')"],
    )

    emb = mock_embedder.embed_documents([chunk.code])

    # LanceDB test
    lance_store.add_chunks([chunk], emb)
    assert lance_store.count() == 1
    exact_lance = lance_store.search_exact("O'Connor.test'\"quote")
    assert len(exact_lance) == 1
    assert exact_lance[0].identifier == "O'Connor.test'\"quote"
    by_id_lance = lance_store.get_by_id("edge/case.py::O'Connor.test'\"quote:1-10")
    assert by_id_lance is not None

    # SQLite test
    memory_sqlite_store.add_chunks([chunk], emb)
    assert memory_sqlite_store.count() == 1
    exact_sqlite = memory_sqlite_store.search_exact("O'Connor.test'\"quote")
    assert len(exact_sqlite) == 1
    assert exact_sqlite[0].identifier == "O'Connor.test'\"quote"
    by_id_sqlite = memory_sqlite_store.get_by_id("edge/case.py::O'Connor.test'\"quote:1-10")
    assert by_id_sqlite is not None
