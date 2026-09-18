"""Empirical adversarial stress testing for FastAPI retrieval endpoints.

Tests edge cases, boundary conditions, malformed inputs, SQL injection payloads,
path traversals, HTTP method mismatches, and stress scenarios to ensure
the application never raises unhandled 500 Internal Server Errors.
"""

from pathlib import Path
import tempfile
from typing import List
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.embedding import MockEmbeddingModel
from app.main import create_app
from app.models.chunk import AstCodeChunk
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


# ============================================================================
# Fixtures for LanceDB & SQLite Test Applications
# ============================================================================

@pytest.fixture
def lance_app_client(tmp_path: Path, sample_chunks: List[AstCodeChunk]):
    """Provides a TestClient backed by LanceDB vector store pre-seeded with chunks."""
    lance_dir = tmp_path / "lance_adversarial_test"
    store = LanceDBVectorStore(db_path=str(lance_dir))
    store.initialize()

    mock_emb = MockEmbeddingModel(dimension=384)
    ingest = VectorIngestionService(embedder=mock_emb, vector_store=store)
    ingest.ingest_chunks(sample_chunks)

    settings = Settings(
        vector_db_type="lancedb",
        db_path=str(lance_dir),
        use_mock_embedder=True,
    )
    app = create_app(settings=settings, vector_store=store, embedder=mock_emb)

    with TestClient(app) as client:
        yield client

    store.close()


@pytest.fixture
def sqlite_app_client(memory_sqlite_store: SQLiteVectorStore, mock_embedder: MockEmbeddingModel, sample_chunks: List[AstCodeChunk]):
    """Provides a TestClient backed by SQLite vector store pre-seeded with chunks."""
    ingest = VectorIngestionService(embedder=mock_embedder, vector_store=memory_sqlite_store)
    ingest.ingest_chunks(sample_chunks)

    settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=":memory:",
        use_mock_embedder=True,
    )
    app = create_app(settings=settings, vector_store=memory_sqlite_store, embedder=mock_embedder)

    with TestClient(app) as client:
        yield client


# ============================================================================
# 1. Malformed JSON & Body Validation Tests
# ============================================================================

class TestMalformedJsonAndBodyValidation:
    """Tests that malformed or unexpected request bodies are rejected with 4xx, never 500."""

    @pytest.mark.parametrize(
        "bad_body",
        [
            b'{"query": ',               # Truncated JSON
            b'{"query": "hello",}',       # Trailing comma
            b'{not json at all}',         # Garbage text
            b'null',                      # JSON null primitive
            b'[1, 2, 3]',                 # JSON array
            b'12345',                     # JSON integer primitive
            b'"just a string"',           # JSON string primitive
            b'true',                      # JSON boolean primitive
            b'',                          # Empty byte string
            b'\x80\xFF\xFE\x00\x01',      # Raw binary non-UTF8 bytes
        ],
    )
    def test_search_post_malformed_json_syntax(self, sqlite_app_client: TestClient, bad_body: bytes):
        """Malformed JSON bodies in POST /api/v1/search must be rejected with 422, never 500."""
        response = sqlite_app_client.post(
            "/api/v1/search",
            content=bad_body,
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in (400, 422), f"Expected 400 or 422 for body {bad_body!r}, got {response.status_code}"
        assert response.status_code < 500

    @pytest.mark.parametrize(
        "bad_body",
        [
            b'{"source_dir": ',
            b'null',
            b'[]',
            b'12345',
            b'',
        ],
    )
    def test_index_post_malformed_json(self, sqlite_app_client: TestClient, bad_body: bytes):
        """Malformed JSON bodies in POST /api/v1/index must return 422, never 500."""
        response = sqlite_app_client.post(
            "/api/v1/index",
            content=bad_body,
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422, f"Expected 422 for bad index body, got {response.status_code}"


# ============================================================================
# 2. Search top_k Boundary and Type Validation
# ============================================================================

class TestSearchTopKBoundaries:
    """Stress-tests boundary conditions, negative values, and type mismatch for top_k."""

    @pytest.mark.parametrize("invalid_top_k", [0, -1, -5, -9999])
    def test_search_post_top_k_non_positive(self, sqlite_app_client: TestClient, invalid_top_k: int):
        """POST /api/v1/search rejects non-positive top_k with 422."""
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "calculator", "top_k": invalid_top_k},
        )
        assert response.status_code == 422
        errors = response.json().get("detail", [])
        assert any("top_k" in str(err) for err in errors)

    @pytest.mark.parametrize("overflow_top_k", [101, 500, 99999])
    def test_search_post_top_k_overflow(self, sqlite_app_client: TestClient, overflow_top_k: int):
        """POST /api/v1/search rejects top_k exceeding maximum limit (100) with 422."""
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "calculator", "top_k": overflow_top_k},
        )
        assert response.status_code == 422
        errors = response.json().get("detail", [])
        assert any("top_k" in str(err) for err in errors)

    @pytest.mark.parametrize("invalid_type_top_k", ["five", [5], {"k": 5}, None, 3.5])
    def test_search_post_top_k_invalid_types(self, sqlite_app_client: TestClient, invalid_type_top_k):
        """POST /api/v1/search rejects invalid types for top_k with 422."""
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "calculator", "top_k": invalid_type_top_k},
        )
        assert response.status_code == 422

    def test_search_post_top_k_boolean_handling(self, sqlite_app_client: TestClient):
        """Boolean top_k: False coerces to 0 (rejected by ge=1 with 422), True coerces to 1 (safe 200)."""
        resp_false = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "calculator", "top_k": False},
        )
        assert resp_false.status_code == 422

        resp_true = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "calculator", "top_k": True},
        )
        assert resp_true.status_code == 200
        assert len(resp_true.json()["chunks"]) <= 1

    @pytest.mark.parametrize("invalid_top_k", [0, -1, -100, 101, 9999, "abc"])
    def test_search_get_top_k_boundary_and_types(self, sqlite_app_client: TestClient, invalid_top_k):
        """GET /api/v1/search rejects out-of-bounds or non-integer top_k with 422."""
        response = sqlite_app_client.get(f"/api/v1/search?query=calc&top_k={invalid_top_k}")
        assert response.status_code == 422

    def test_search_valid_boundary_top_k(self, sqlite_app_client: TestClient):
        """POST /api/v1/search accepts boundary limits top_k=1 and top_k=100."""
        resp_min = sqlite_app_client.post("/api/v1/search", json={"query": "calc", "top_k": 1})
        assert resp_min.status_code == 200
        assert len(resp_min.json()["chunks"]) <= 1

        resp_max = sqlite_app_client.post("/api/v1/search", json={"query": "calc", "top_k": 100})
        assert resp_max.status_code == 200
        assert len(resp_max.json()["chunks"]) <= 100


# ============================================================================
# 3. Search Query Validation & Payload Stress Tests
# ============================================================================

class TestSearchQueryValidationAndPayloadStress:
    """Stress-tests query parameters with extreme sizes, unicode, and injection patterns."""

    def test_search_post_empty_or_whitespace_query(self, sqlite_app_client: TestClient):
        """POST /api/v1/search with empty query string must return 422."""
        resp_empty = sqlite_app_client.post("/api/v1/search", json={"query": ""})
        assert resp_empty.status_code == 422

        # Missing query field entirely
        resp_missing = sqlite_app_client.post("/api/v1/search", json={"top_k": 5})
        assert resp_missing.status_code == 422

    def test_search_get_missing_or_empty_query(self, sqlite_app_client: TestClient):
        """GET /api/v1/search with missing or empty query parameter returns 422."""
        assert sqlite_app_client.get("/api/v1/search").status_code == 422
        assert sqlite_app_client.get("/api/v1/search?query=").status_code == 422

    @pytest.mark.parametrize(
        "invalid_node_type",
        [
            "NonExistentType",
            "SELECT * FROM chunks",
            "'; DROP TABLE ast_chunks; --",
            "ModuleDef",
            123,
        ],
    )
    def test_search_post_invalid_ast_node_type(self, sqlite_app_client: TestClient, invalid_node_type):
        """Invalid astNodeType values must be rejected by Pydantic literal schema with 422."""
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "test", "ast_node_type": invalid_node_type},
        )
        assert response.status_code == 422

    def test_search_post_massive_query_payload(self, sqlite_app_client: TestClient):
        """A massive query payload (50,000 characters) should be handled safely without 500 or crash."""
        massive_query = "calculate total summation of numbers " * 1500
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": massive_query, "top_k": 5},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_results"] >= 0
        assert data["latency_ms"] >= 0.0

    def test_search_post_unicode_and_special_characters(self, sqlite_app_client: TestClient):
        """Query containing unicode, emojis, control chars, and quote marks must process cleanly."""
        complex_query = "def 计算_sum(x: int) -> 🚀 \t\n '\"--!@#$%^&*()_+"
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": complex_query, "top_k": 5},
        )
        assert response.status_code == 200

    def test_search_file_path_traversal_filtering(self, sqlite_app_client: TestClient):
        """Attempting path traversal in file_path filter does not crash or expose filesystem."""
        response = sqlite_app_client.post(
            "/api/v1/search",
            json={"query": "calc", "file_path": "../../../../../windows/system32/cmd.exe"},
        )
        assert response.status_code == 200
        assert response.json()["total_results"] == 0


# ============================================================================
# 4. Entity Route SQL Injection & Path Robustness Tests
# ============================================================================

class TestEntityRouteAdversarial:
    """Tests GET /api/v1/entity/{name} against SQL injection, path traversal, and special symbols."""

    SQLI_PAYLOADS = [
        "' OR 1=1 --",
        "' OR '1'='1",
        "admin'--",
        "'; DROP TABLE ast_chunks; --",
        "\" OR 1=1 --",
        "' UNION SELECT * FROM ast_chunks --",
        "'; DELETE FROM ast_chunks WHERE '1'='1",
        "\\'; DROP TABLE ast_chunks; --",
        "'' OR ''='' --",
        "nonexistent' OR 1=1 #",
        "1' AND SLEEP(5) --",
        "1' WAITFOR DELAY '0:0:5' --",
    ]

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_entity_sql_injection_sqlite(self, sqlite_app_client: TestClient, payload: str):
        """SQLite backend: SQL injection payloads in entity route must return count 0 without 500 error."""
        response = sqlite_app_client.get(f"/api/v1/entity/{payload}")
        assert response.status_code == 200, f"Failed on payload {payload!r}: {response.text}"
        data = response.json()
        assert data["count"] == 0, f"Data leak on payload {payload!r}: {data}"
        assert data["chunks"] == []

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_entity_sql_injection_lancedb(self, lance_app_client: TestClient, payload: str):
        """LanceDB backend: SQL injection payloads in entity route must return count 0 without 500 error."""
        response = lance_app_client.get(f"/api/v1/entity/{payload}")
        assert response.status_code == 200, f"LanceDB failed on payload {payload!r}: {response.text}"
        data = response.json()
        assert data["count"] == 0, f"LanceDB data leak on payload {payload!r}: {data}"
        assert data["chunks"] == []

    @pytest.mark.parametrize(
        "unusual_name",
        [
            "Calculator.multiply",              # Qualified method (normal)
            "nested.submodule.func_name",       # Multi-dot
            "path/to/virtual/class.method",     # Slashes
            "calculate_🧮",                     # Emoji
            "🐍_python_engine",                 # Emoji prefix
            "测试函数_calculate",               # Non-ASCII Chinese
            "λ_anonymous_expr",                 # Greek lambda
            "__dunder_init__",                  # Dunder name
            "func-with-dashes-and_underscores", # Mixed punctuation
            "special~!@$^&*()+=[]{}|:;<>?",     # Special characters
            "a" * 1000,                         # 1000-char identifier
        ],
    )
    def test_entity_unusual_identifiers_sqlite_and_lance(
        self,
        sqlite_app_client: TestClient,
        lance_app_client: TestClient,
        unusual_name: str,
    ):
        """Unusual, unicode, or deeply nested identifiers return 200 without crashes across stores."""
        res_sqlite = sqlite_app_client.get(f"/api/v1/entity/{unusual_name}")
        assert res_sqlite.status_code == 200
        assert "count" in res_sqlite.json()

        res_lance = lance_app_client.get(f"/api/v1/entity/{unusual_name}")
        assert res_lance.status_code == 200
        assert "count" in res_lance.json()

    def test_entity_path_traversal_payloads(self, sqlite_app_client: TestClient):
        """Directory traversal sequences in entity name do not trigger directory access or 500."""
        traversals = ["..", "../..", "../../etc/passwd", "..\\..\\windows\\system32"]
        for t in traversals:
            resp = sqlite_app_client.get(f"/api/v1/entity/{t}")
            assert resp.status_code in (200, 404), f"Traversal {t} returned unexpected status {resp.status_code}"
            assert resp.status_code < 500
            if resp.status_code == 200:
                assert resp.json()["count"] == 0


# ============================================================================
# 5. Chunks Endpoint Edge Cases & 404 Verification
# ============================================================================

class TestChunksEndpointEdgeCases:
    """Verifies GET /api/v1/chunks/{id} correctly returns 404 for nonexistent IDs."""

    @pytest.mark.parametrize(
        "missing_id",
        [
            "nonexistent_chunk_id",
            "missing/path.py::unknown_func:100-200",
            "' OR 1=1 --",
            "../../etc/shadow",
            "__not_found__",
            "id_with_emoji_🚀_test",
            "a" * 2000,
        ],
    )
    def test_chunks_get_nonexistent_returns_404(
        self,
        sqlite_app_client: TestClient,
        lance_app_client: TestClient,
        missing_id: str,
    ):
        """Nonexistent chunk IDs return 404 on both SQLite and LanceDB backends."""
        resp_sq = sqlite_app_client.get(f"/api/v1/chunks/{missing_id}")
        assert resp_sq.status_code == 404
        assert "not found" in resp_sq.json()["detail"].lower()

        resp_la = lance_app_client.get(f"/api/v1/chunks/{missing_id}")
        assert resp_la.status_code == 404
        assert "not found" in resp_la.json()["detail"].lower()


# ============================================================================
# 6. Index Endpoint Edge Cases & Validation
# ============================================================================

class TestIndexEndpointEdgeCases:
    """Verifies POST /api/v1/index input validation and error responses."""

    def test_index_nonexistent_directory_returns_400(self, sqlite_app_client: TestClient):
        """Pointing to a nonexistent directory returns 400 Bad Request."""
        response = sqlite_app_client.post(
            "/api/v1/index",
            json={"source_dir": "c:/path/does/not/exist_xyz987"},
        )
        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"].lower()

    def test_index_empty_source_dir_returns_422(self, sqlite_app_client: TestClient):
        """Empty source_dir string is rejected by Pydantic min_length=1 validator."""
        response = sqlite_app_client.post("/api/v1/index", json={"source_dir": ""})
        assert response.status_code == 422

    def test_index_empty_directory_returns_zero_chunks(self, sqlite_app_client: TestClient, tmp_path: Path):
        """Indexing an empty directory returns 200 with 0 files and 0 chunks."""
        empty_dir = tmp_path / "empty_codebase"
        empty_dir.mkdir()

        response = sqlite_app_client.post(
            "/api/v1/index",
            json={"source_dir": str(empty_dir)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["indexed_files"] == 0
        assert data["extracted_chunks"] == 0
        assert data["elapsed_seconds"] >= 0.0

    def test_index_directory_with_non_python_files_only(self, sqlite_app_client: TestClient, tmp_path: Path):
        """Indexing a directory containing only non-python files returns 0 files."""
        misc_dir = tmp_path / "misc_files"
        misc_dir.mkdir()
        (misc_dir / "readme.txt").write_text("hello world", encoding="utf-8")
        (misc_dir / "data.json").write_text("{}", encoding="utf-8")

        response = sqlite_app_client.post(
            "/api/v1/index",
            json={"source_dir": str(misc_dir)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["indexed_files"] == 0
        assert data["extracted_chunks"] == 0


# ============================================================================
# 7. HTTP Methods & Unsupported Routes
# ============================================================================

class TestHttpMethodAndRouteIntegrity:
    """Verifies FastAPI returns 405 for disallowed HTTP methods and 404 for unknown paths."""

    @pytest.mark.parametrize(
        "method,endpoint",
        [
            ("POST", "/api/v1/health"),
            ("PUT", "/api/v1/health"),
            ("DELETE", "/api/v1/health"),
            ("PUT", "/api/v1/search"),
            ("DELETE", "/api/v1/search"),
            ("POST", "/api/v1/entity/calculate_sum"),
            ("PUT", "/api/v1/entity/calculate_sum"),
            ("POST", "/api/v1/chunks/test_id"),
            ("PUT", "/api/v1/chunks/test_id"),
            ("GET", "/api/v1/index"),
            ("DELETE", "/api/v1/index"),
        ],
    )
    def test_unsupported_http_methods_return_405(self, sqlite_app_client: TestClient, method: str, endpoint: str):
        """Disallowed HTTP methods must return 405 Method Not Allowed."""
        response = sqlite_app_client.request(method, endpoint)
        assert response.status_code == 405, f"{method} {endpoint} returned {response.status_code}, expected 405"

    def test_unknown_routes_return_404(self, sqlite_app_client: TestClient):
        """Requests to nonexistent paths return 404."""
        assert sqlite_app_client.get("/api/v1/unknown_route").status_code == 404
        assert sqlite_app_client.post("/api/v2/search", json={"query": "test"}).status_code == 404


# ============================================================================
# 8. Rapid Sequential Requests Stability
# ============================================================================

class TestRapidRequestsStability:
    """Verifies that high-frequency sequential requests across all endpoints do not leak resources."""

    def test_rapid_request_burst(self, seeded_client: TestClient):
        """Sends 60 consecutive requests across endpoints and confirms 100% stability."""
        endpoints = [
            ("GET", "/api/v1/health", None),
            ("POST", "/api/v1/search", {"query": "sum", "top_k": 2}),
            ("GET", "/api/v1/search?query=multiply&top_k=1", None),
            ("GET", "/api/v1/entity/Calculator.multiply", None),
            ("GET", "/api/v1/chunks/services/calc.py::calculate_sum:1-8", None),
            ("GET", "/api/v1/chunks/nonexistent_id", None),
        ]

        for i in range(10):
            for method, path, payload in endpoints:
                if method == "GET":
                    resp = seeded_client.get(path)
                else:
                    resp = seeded_client.post(path, json=payload)

                # Each request must return either 200 or 404 (for nonexistent chunk), never 500
                assert resp.status_code in (200, 404), (
                    f"Burst iteration {i} on {method} {path} returned unexpected status {resp.status_code}: {resp.text}"
                )
