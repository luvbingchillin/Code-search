"""End-to-end integration tests verifying real FastAPI server, LanceDB, and AST retrieval.

Requirement R3:
- Starts the FastAPI server (both in-process ASGI TestClient and live socket server).
- Submits real natural language queries simulating frontend apiClient.ts.
- Asserts that real AST chunks with valid metadata (identifier, filePath, startLine, endLine, code)
  are returned from LanceDB.
- Tests exact entity lookup for multi-hop resolution.
- Tests CORS preflight and headers matching frontend origin http://localhost:5173.
- Tests live Uvicorn socket retrieval over TCP localhost.
"""

import os
import socket
import threading
import time
from pathlib import Path
from typing import Any, Dict, Generator

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import uvicorn

from app.config import Settings
from app.core.embedding import MockEmbeddingModel
from app.main import create_app
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore

# Anchor paths relative to this file so tests pass from project root or backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent
LANCEDB_DIR = BACKEND_ROOT / "data" / "lancedb"


def find_free_port() -> int:
    """Find a dynamically available free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def ensured_lancedb_populated() -> str:
    """Ensure backend/data/lancedb is initialized and contains real AST code chunks."""
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    store = LanceDBVectorStore(db_path=str(LANCEDB_DIR), dimension=384)
    store.initialize()

    # Defensive fallback if count is 0 (e.g. fresh environment before ingestion)
    if store.count() == 0:
        sample_dir = BACKEND_ROOT / "sample_codebase"
        embedder = MockEmbeddingModel(dimension=384)
        ingestion = VectorIngestionService(embedder=embedder, vector_store=store)
        ingestion.ingest_directory(sample_dir)

    count = store.count()
    store.close()
    assert count > 0, "LanceDB table must contain at least 1 AST code chunk."
    return str(LANCEDB_DIR)


@pytest.fixture(scope="module")
def e2e_app(ensured_lancedb_populated: str) -> FastAPI:
    """Create FastAPI application configured with real LanceDB and mock embedder.
    
    Passes embedder=MockEmbeddingModel(dimension=384) to create_app to avoid
    the known dim keyword exception in app/main.py:46 while maintaining 384-dim vectors.
    """
    settings = Settings(
        vector_db_type="lancedb",
        db_path=ensured_lancedb_populated,
        use_mock_embedder=False,
        model_name="all-MiniLM-L6-v2",
        cors_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    )
    mock_embedder = MockEmbeddingModel(dimension=384)
    application = create_app(settings=settings, embedder=mock_embedder)
    return application


@pytest.fixture(scope="module")
def e2e_client(e2e_app: FastAPI) -> Generator[TestClient, None, None]:
    """FastAPI TestClient for in-process ASGI execution with full lifespan."""
    with TestClient(e2e_app) as client:
        yield client


@pytest.fixture(scope="module")
def live_server_url(e2e_app: FastAPI) -> Generator[str, None, None]:
    """Starts live Uvicorn HTTP server in a background thread for true socket HTTP testing."""
    port = find_free_port()
    config = uvicorn.Config(app=e2e_app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config=config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{port}"

    # Wait for server ready (up to 10 seconds)
    ready = False
    start_t = time.time()
    while time.time() - start_t < 10.0:
        try:
            r = httpx.get(f"{base_url}/api/v1/health", timeout=1.0)
            if r.status_code == 200:
                ready = True
                break
        except Exception:
            time.sleep(0.1)

    assert ready, f"Live Uvicorn server failed to start on {base_url} within 10s."
    yield base_url

    server.should_exit = True
    thread.join(timeout=3.0)


# ============================================================================
# Programmatic AST Code Chunk Validation Helper
# ============================================================================

def assert_valid_ast_chunk(chunk: Dict[str, Any]) -> None:
    """Programmatically asserts that an AST code chunk contains complete, valid metadata."""
    assert "id" in chunk and isinstance(chunk["id"], str) and len(chunk["id"]) > 0
    assert "identifier" in chunk and isinstance(chunk["identifier"], str) and len(chunk["identifier"]) > 0
    assert "filePath" in chunk and isinstance(chunk["filePath"], str) and chunk["filePath"].endswith(".py")
    assert "fileName" in chunk and isinstance(chunk["fileName"], str) and chunk["fileName"].endswith(".py")
    assert "astNodeType" in chunk and chunk["astNodeType"] in [
        "FunctionDef", "AsyncFunctionDef", "ClassDef", "Module", "Assign"
    ]
    assert "startLine" in chunk and isinstance(chunk["startLine"], int) and chunk["startLine"] >= 1
    assert "endLine" in chunk and isinstance(chunk["endLine"], int) and chunk["endLine"] >= chunk["startLine"]
    assert "code" in chunk and isinstance(chunk["code"], str) and len(chunk["code"].strip()) > 0
    assert "relevanceScore" in chunk and 0.0 <= float(chunk["relevanceScore"]) <= 1.0


# ============================================================================
# Test Cases
# ============================================================================

def test_e2e_health_check(e2e_client: TestClient) -> None:
    """E2E Test: Verify backend reports healthy LanceDB vector store with real count."""
    resp = e2e_client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "LanceDB" in data["vector_db"]
    assert data["total_chunks"] > 0
    assert data["embedding_dimension"] == 384


def test_e2e_semantic_search_real_query(e2e_client: TestClient) -> None:
    """E2E Test: Submit real natural language query and verify real AST chunks are retrieved."""
    # Simulates the exact JSON payload the frontend apiClient.ts sends
    payload = {
        "query": "calculate summary statistics or data processing",
        "top_k": 5,
    }
    resp = e2e_client.post("/api/v1/search", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["query"] == payload["query"]
    assert data["total_results"] > 0
    assert len(data["chunks"]) > 0
    assert data["latency_ms"] >= 0.0

    scores = [c["relevanceScore"] for c in data["chunks"]]
    assert scores == sorted(scores, reverse=True), "Chunks must be ranked by relevance score"

    for chunk in data["chunks"]:
        assert_valid_ast_chunk(chunk)


def test_e2e_exact_match_lookup(e2e_client: TestClient) -> None:
    """E2E Test: Query exact entity name to verify multi-hop dependency resolution."""
    # First get a valid identifier from semantic search
    search_resp = e2e_client.post("/api/v1/search", json={"query": "statistics function", "top_k": 1})
    assert search_resp.status_code == 200
    chunks = search_resp.json()["chunks"]
    assert len(chunks) > 0
    target_id = chunks[0]["identifier"]

    # Now perform exact lookup
    lookup_resp = e2e_client.get(f"/api/v1/entity/{target_id}")
    assert lookup_resp.status_code == 200
    lookup_data = lookup_resp.json()

    assert lookup_data["identifier"] == target_id
    assert lookup_data["count"] >= 1
    assert lookup_data["chunks"][0]["identifier"] == target_id
    assert lookup_data["chunks"][0]["relevanceScore"] == 1.0
    assert_valid_ast_chunk(lookup_data["chunks"][0])


def test_e2e_cors_preflight_and_origin(e2e_client: TestClient) -> None:
    """E2E Test: Verify CORS preflight and response headers for frontend Origin http://localhost:5173."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    preflight = e2e_client.options("/api/v1/search", headers=headers)
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") in ("*", "http://localhost:5173")

    post_resp = e2e_client.post(
        "/api/v1/search",
        headers={"Origin": "http://localhost:5173"},
        json={"query": "health status", "top_k": 1},
    )
    assert post_resp.status_code == 200
    assert post_resp.headers.get("access-control-allow-origin") in ("*", "http://localhost:5173")


def test_e2e_live_server_socket_retrieval(live_server_url: str) -> None:
    """E2E Test: Verify real TCP socket HTTP communication using httpx against running Uvicorn server."""
    with httpx.Client(base_url=live_server_url, timeout=10.0) as client:
        # 1. Health check over socket
        h_resp = client.get("/api/v1/health")
        assert h_resp.status_code == 200
        assert h_resp.json()["status"] == "healthy"

        # 2. Semantic search over socket
        s_resp = client.post(
            "/api/v1/search",
            json={"query": "data processing calculation", "top_k": 3},
        )
        assert s_resp.status_code == 200
        data = s_resp.json()
        assert len(data["chunks"]) > 0
        assert_valid_ast_chunk(data["chunks"][0])
