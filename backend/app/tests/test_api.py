"""Comprehensive unit and integration tests for FastAPI retrieval endpoints."""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.embedding import MockEmbeddingModel
from app.main import create_app
from app.models.chunk import AstCodeChunk
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore


def test_root_endpoint(test_client: TestClient):
    """Test root GET / returns application information."""
    response = test_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "Generative Code Retrieval Backend" in data["name"]
    assert data["api_v1"] == "/api/v1"


def test_cors_headers(test_client: TestClient):
    """Test CORS headers are returned for cross-origin requests from frontend."""
    headers = {"Origin": "http://localhost:5173"}
    response = test_client.get("/api/v1/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in ("*", "http://localhost:5173")
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_health_endpoint_empty(test_client: TestClient):
    """Test GET /api/v1/health on clean vector store."""
    response = test_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["total_chunks"] == 0
    assert data["embedding_dimension"] == 384
    assert "SQLite" in data["vector_db"]


def test_health_endpoint_seeded(seeded_client: TestClient):
    """Test GET /api/v1/health on populated store."""
    response = seeded_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["total_chunks"] == 4


def test_search_post_empty_database(test_client: TestClient):
    """Test POST /api/v1/search returns empty list on empty database."""
    response = test_client.post(
        "/api/v1/search",
        json={"query": "calculate total sum", "top_k": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "calculate total sum"
    assert data["total_results"] == 0
    assert data["chunks"] == []
    assert data["latency_ms"] >= 0.0


def test_search_post_semantic_retrieval(seeded_client: TestClient):
    """Test POST /api/v1/search retrieves semantically relevant AST chunks."""
    response = seeded_client.post(
        "/api/v1/search",
        json={"query": "calculate sum of two integers", "top_k": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "calculate sum of two integers"
    assert data["total_results"] == 3
    assert len(data["chunks"]) == 3

    # Verify score normalization [0.0, 1.0] and sorting
    scores = [c["relevanceScore"] for c in data["chunks"]]
    for s in scores:
        assert 0.0 <= s <= 1.0
    assert scores == sorted(scores, reverse=True)

    # Check first chunk structure
    first = data["chunks"][0]
    assert "id" in first
    assert "filePath" in first
    assert "code" in first
    assert first["startLine"] >= 1


def test_search_get_query_params(seeded_client: TestClient):
    """Test GET /api/v1/search retrieves chunks via query parameters."""
    response = seeded_client.get("/api/v1/search?query=multiply&top_k=2")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "multiply"
    assert len(data["chunks"]) <= 2


def test_search_with_node_type_filter(seeded_client: TestClient):
    """Test POST /api/v1/search filtered by ast_node_type."""
    response = seeded_client.post(
        "/api/v1/search",
        json={"query": "calculator", "top_k": 10, "ast_node_type": "ClassDef"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_results"] == 1
    assert data["chunks"][0]["astNodeType"] == "ClassDef"
    assert data["chunks"][0]["identifier"] == "Calculator"


def test_search_with_file_path_filter(seeded_client: TestClient):
    """Test POST /api/v1/search filtered by file_path."""
    response = seeded_client.post(
        "/api/v1/search",
        json={"query": "async", "top_k": 10, "file_path": "network/client.py"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_results"] == 1
    assert data["chunks"][0]["filePath"] == "network/client.py"


def test_search_validation_empty_query(test_client: TestClient):
    """Test POST /api/v1/search with empty query fails validation."""
    response = test_client.post("/api/v1/search", json={"query": ""})
    assert response.status_code == 422


def test_search_validation_non_positive_top_k(test_client: TestClient):
    """Test POST /api/v1/search with top_k <= 0 is rejected by schema validator."""
    response = test_client.post("/api/v1/search", json={"query": "test", "top_k": 0})
    assert response.status_code == 422

    response_neg = test_client.post("/api/v1/search", json={"query": "test", "top_k": -1})
    assert response_neg.status_code == 422


def test_search_get_validation_non_positive_top_k(test_client: TestClient):
    """Test GET /api/v1/search with top_k <= 0 is rejected."""
    response = test_client.get("/api/v1/search?query=test&top_k=0")
    assert response.status_code == 422


def test_entity_exact_lookup_function(seeded_client: TestClient):
    """Test GET /api/v1/entity/{name} for function name."""
    response = seeded_client.get("/api/v1/entity/calculate_sum")
    assert response.status_code == 200
    data = response.json()
    assert data["identifier"] == "calculate_sum"
    assert data["count"] == 1
    assert len(data["chunks"]) == 1
    assert data["chunks"][0]["identifier"] == "calculate_sum"
    assert data["chunks"][0]["relevanceScore"] == 1.0


def test_entity_exact_lookup_method(seeded_client: TestClient):
    """Test GET /api/v1/entity/{name} for Class.method multi-hop identifier."""
    response = seeded_client.get("/api/v1/entity/Calculator.multiply")
    assert response.status_code == 200
    data = response.json()
    assert data["identifier"] == "Calculator.multiply"
    assert data["count"] == 1
    assert data["chunks"][0]["astNodeType"] == "FunctionDef"


def test_entity_exact_lookup_nonexistent(seeded_client: TestClient):
    """Test GET /api/v1/entity/{name} returns count 0 for missing entity."""
    response = seeded_client.get("/api/v1/entity/nonexistent_symbol_foo")
    assert response.status_code == 200
    data = response.json()
    assert data["identifier"] == "nonexistent_symbol_foo"
    assert data["count"] == 0
    assert data["chunks"] == []


def test_chunks_get_by_id_found(seeded_client: TestClient):
    """Test GET /api/v1/chunks/{id} retrieves exact chunk by id."""
    target_id = "services/calc.py::calculate_sum:1-8"
    response = seeded_client.get(f"/api/v1/chunks/{target_id}")
    assert response.status_code == 200
    chunk = response.json()
    assert chunk["id"] == target_id
    assert chunk["identifier"] == "calculate_sum"
    assert chunk["fileName"] == "calc.py"


def test_chunks_get_by_id_not_found(seeded_client: TestClient):
    """Test GET /api/v1/chunks/{id} returns 404 for nonexistent chunk."""
    response = seeded_client.get("/api/v1/chunks/does/not/exist::func:1-10")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_index_post_invalid_directory(test_client: TestClient):
    """Test POST /api/v1/index with nonexistent directory returns 400."""
    response = test_client.post(
        "/api/v1/index",
        json={"source_dir": "path/to/nonexistent/directory/xyz123"},
    )
    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"].lower()


def test_index_post_sample_codebase(test_client: TestClient):
    """Test POST /api/v1/index on backend/sample_codebase indexes files into DB."""
    sample_dir = Path(__file__).resolve().parent.parent.parent / "sample_codebase"
    assert sample_dir.exists(), f"Sample codebase directory missing at {sample_dir}"

    response = test_client.post(
        "/api/v1/index",
        json={"source_dir": str(sample_dir)},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["indexed_files"] >= 1
    assert data["extracted_chunks"] >= 20
    assert data["elapsed_seconds"] >= 0.0

    # Verify indexed chunks can now be searched
    health_resp = test_client.get("/api/v1/health")
    assert health_resp.json()["total_chunks"] == data["extracted_chunks"]

    # Verify search finds chunks from sample codebase
    search_resp = test_client.post(
        "/api/v1/search",
        json={"query": "calculate statistics mean median", "top_k": 3},
    )
    assert search_resp.status_code == 200
    assert search_resp.json()["total_results"] >= 1


def test_lancedb_vector_store_integration(tmp_path: Path, sample_chunks: list[AstCodeChunk]):
    """Integration test verifying full FastAPI lifecycle with LanceDB backend."""
    lance_dir = tmp_path / "lance_api_test"
    store = LanceDBVectorStore(db_path=str(lance_dir))
    store.initialize()

    mock_emb = MockEmbeddingModel(dimension=384)
    ingest = VectorIngestionService(embedder=mock_emb, vector_store=store)
    ingest.ingest_chunks(sample_chunks)

    lance_settings = Settings(
        vector_db_type="lancedb",
        db_path=str(lance_dir),
        use_mock_embedder=True,
    )
    app = create_app(settings=lance_settings, vector_store=store, embedder=mock_emb)

    with TestClient(app) as client:
        # Health check
        h_resp = client.get("/api/v1/health")
        assert h_resp.status_code == 200
        assert "LanceDB" in h_resp.json()["vector_db"]
        assert h_resp.json()["total_chunks"] == 4

        # Semantic search
        s_resp = client.post("/api/v1/search", json={"query": "multiply calculator", "top_k": 2})
        assert s_resp.status_code == 200
        assert len(s_resp.json()["chunks"]) == 2

        # Exact match
        e_resp = client.get("/api/v1/entity/calculate_sum")
        assert e_resp.status_code == 200
        assert e_resp.json()["count"] == 1
        assert e_resp.json()["chunks"][0]["identifier"] == "calculate_sum"

        # Chunk retrieval
        c_resp = client.get("/api/v1/chunks/services/calc.py::calculate_sum:1-8")
        assert c_resp.status_code == 200
        assert c_resp.json()["identifier"] == "calculate_sum"
