"""Empirical Multi-Hop Retrieval & Acceptance Challenge Test Suite.

Author: M3 Challenger 2 (Multi-Hop Retrieval & Acceptance Verifier)
Mission:
1. Seed FastAPI server with backend/sample_codebase/sample_service.py.
2. Emulate Agentic ReAct loop for multi-hop dependency resolution.
3. Verify chunk docstrings, line coordinates, parameters, and code body fidelity for the viewer pane.
4. Stress-test edge cases, SQL injection resilience, and caller-resolution gaps.
"""

from pathlib import Path
from typing import List, Optional
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.embedding import BaseEmbeddingModel, MockEmbeddingModel
from app.main import create_app
from app.models.chunk import AstCodeChunk
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


class SemanticAwareMockEmbedder(BaseEmbeddingModel):
    """Mock embedder with deterministic semantic awareness for testing query matching.

    Maps semantic queries containing key tokens ('transform', 'batch') to align
    vectors with matching chunks, simulating SentenceTransformers without cloud or torch overhead.
    """

    def __init__(self, dimension: int = 384) -> None:
        self._dimension = dimension
        self._fallback = MockEmbeddingModel(dimension=dimension)

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_query(self, text: str) -> "np.ndarray":
        import numpy as np
        vec = np.zeros(self._dimension, dtype=np.float32)
        lower = text.lower()
        if "transform" in lower and "batch" in lower:
            vec[0] = 1.0
            vec[1] = 0.5
        elif "calculate" in lower and "statistic" in lower:
            vec[2] = 1.0
        else:
            return self._fallback.embed_query(text)
        return (vec / np.linalg.norm(vec)).astype(np.float32)

    def embed_documents(self, texts: List[str]) -> "np.ndarray":
        import numpy as np
        vecs = []
        for text in texts:
            vec = np.zeros(self._dimension, dtype=np.float32)
            lower = text.lower()
            if "entity: dataprocessingservice.transform_batch" in lower:
                # Specific method chunk has highest similarity for transform batch
                vec[0] = 1.0
                vec[1] = 0.5
            elif "entity: dataprocessingservice" in lower:
                # Parent class container contains the method text but has lower specific similarity
                vec[0] = 0.7
                vec[1] = 0.3
            elif "calculate_statistics" in lower:
                vec[2] = 1.0
            else:
                vec = self._fallback.embed_query(text)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            vecs.append(vec)
        return np.stack(vecs).astype(np.float32)


@pytest.fixture
def sample_service_path() -> Path:
    """Return path to sample_service.py."""
    p = Path(__file__).resolve().parent.parent.parent / "sample_codebase" / "sample_service.py"
    assert p.exists(), f"sample_service.py not found at {p}"
    return p


@pytest.fixture
def seeded_multihop_app(sample_service_path: Path):
    """Fixture providing a seeded FastAPI application with sample_service.py ingested."""
    store = SQLiteVectorStore(db_path=":memory:", dimension=384)
    store.initialize()
    embedder = SemanticAwareMockEmbedder(dimension=384)

    ingest = VectorIngestionService(embedder=embedder, vector_store=store)
    ingest.ingest_file(sample_service_path)

    settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=":memory:",
        use_mock_embedder=True,
    )
    app = create_app(settings=settings, vector_store=store, embedder=embedder)
    return app


def test_multihop_agentic_loop_on_sample_service(seeded_multihop_app: "FastAPI"):
    """Emulate full Agentic ReAct loop for multi-hop dependency resolution.

    Hop 1 (Semantic): Search 'transform data batch' -> retrieve DataProcessingService.transform_batch.
    Inspect chunk calls, coordinates, docstrings.
    Hop 2 (Exact): Look up calculate_statistics via GET /api/v1/entity/calculate_statistics.
    Hop 3 (Exact): Look up DataProcessingService class via GET /api/v1/entity/DataProcessingService.
    """
    with TestClient(seeded_multihop_app) as client:
        # Step 1: Query 1 (Semantic Vector Search)
        search_resp = client.post(
            "/api/v1/search",
            json={"query": "transform data batch", "top_k": 5},
        )
        assert search_resp.status_code == 200, f"Search failed: {search_resp.text}"
        data = search_resp.json()
        assert data["total_results"] > 0, "No results returned for semantic query"

        # Assert top retrieved chunk is DataProcessingService.transform_batch
        top_chunk = data["chunks"][0]
        assert top_chunk["identifier"] == "DataProcessingService.transform_batch", (
            f"Expected DataProcessingService.transform_batch, got {top_chunk['identifier']}"
        )
        assert top_chunk["astNodeType"] == "FunctionDef"
        assert top_chunk["startLine"] == 173
        assert top_chunk["endLine"] == 185
        assert "records: List[Dict[str, Any]]" in top_chunk["parameters"]
        assert "@validate_positive(arg_name=\"batch_size\")" in top_chunk["decorators"]
        assert "Transform a batch of records synchronously." in top_chunk["docstring"]
        assert "def transform_batch" in top_chunk["code"]
        assert 0.0 <= top_chunk["relevanceScore"] <= 1.0

        # Observe calls extracted from transform_batch AST
        observed_calls = top_chunk.get("calls", [])
        assert isinstance(observed_calls, list)
        assert "record.items" in observed_calls
        assert "k.lower" in observed_calls
        assert "results.append" in observed_calls

        # Step 2: Query 2 (Exact Entity Lookup for calculate_statistics)
        stat_resp = client.get("/api/v1/entity/calculate_statistics")
        assert stat_resp.status_code == 200
        stat_data = stat_resp.json()
        assert stat_data["identifier"] == "calculate_statistics"
        assert stat_data["count"] == 1
        assert len(stat_data["chunks"]) == 1

        stat_chunk = stat_data["chunks"][0]
        assert stat_chunk["identifier"] == "calculate_statistics"
        assert stat_chunk["astNodeType"] == "FunctionDef"
        assert stat_chunk["startLine"] == 35
        assert stat_chunk["endLine"] == 72
        assert "Calculate statistical summaries" in stat_chunk["docstring"]
        assert "values: List[float]" in stat_chunk["parameters"]
        assert "normalize: bool = False" in stat_chunk["parameters"]
        assert "math.sqrt" in stat_chunk["calls"]
        assert stat_chunk["relevanceScore"] == 1.0

        # Step 3: Query 3 (Exact Entity Lookup for DataProcessingService class)
        class_resp = client.get("/api/v1/entity/DataProcessingService")
        assert class_resp.status_code == 200
        class_data = class_resp.json()
        assert class_data["identifier"] == "DataProcessingService"
        assert class_data["count"] == 1

        class_chunk = class_data["chunks"][0]
        assert class_chunk["identifier"] == "DataProcessingService"
        assert class_chunk["astNodeType"] == "ClassDef"
        assert class_chunk["startLine"] == 134
        assert class_chunk["endLine"] == 207
        assert "High-throughput data processing service" in class_chunk["docstring"]
        assert "class DataProcessingService(BaseEntity):" in class_chunk["code"]
        assert "def transform_batch" in class_chunk["code"]
        assert "async def process_stream" in class_chunk["code"]


def test_multihop_call_resolution_gap_analysis(seeded_multihop_app: "FastAPI"):
    """Empirical investigation into call resolution behavior.

    Demonstrates that:
    1. Looking up 'DataProcessingService.process_stream' reveals a call to 'self.transform_batch'.
    2. Exact lookup of verbatim 'self.transform_batch' returns 0 chunks because identifiers
       are stored as qualified names ('DataProcessingService.transform_batch').
    3. Unqualified lookup of 'transform_batch' also returns 0 chunks.
    4. Qualified lookup of 'DataProcessingService.transform_batch' succeeds.
    """
    with TestClient(seeded_multihop_app) as client:
        # Step 1: Look up process_stream
        resp = client.get("/api/v1/entity/DataProcessingService.process_stream")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        stream_chunk = data["chunks"][0]

        # Extract calls
        calls = stream_chunk.get("calls", [])
        assert "self.transform_batch" in calls, f"Expected self.transform_batch in calls, got {calls}"

        # Step 2: Try looking up 'self.transform_batch' directly
        raw_call_resp = client.get("/api/v1/entity/self.transform_batch")
        assert raw_call_resp.status_code == 200
        assert raw_call_resp.json()["count"] == 0, (
            "Verbatim call 'self.transform_batch' returned unexpected match without receiver resolution"
        )

        # Step 3: Try looking up unqualified 'transform_batch'
        unqual_resp = client.get("/api/v1/entity/transform_batch")
        assert unqual_resp.status_code == 200
        assert unqual_resp.json()["count"] == 0, (
            "Unqualified 'transform_batch' returned unexpected match"
        )

        # Step 4: Qualified lookup succeeds
        qual_resp = client.get("/api/v1/entity/DataProcessingService.transform_batch")
        assert qual_resp.status_code == 200
        assert qual_resp.json()["count"] == 1


def test_code_viewer_coordinate_and_slice_fidelity(sample_service_path: Path):
    """Verify 100% slice accuracy of startLine and endLine coordinates against the raw file.

    Ensures the developer viewer pane in the frontend can faithfully display
    the exact slice of code using 1-indexed coordinates without truncation or off-by-one errors.
    """
    from app.parser.extractor import PythonAstExtractor

    raw_text = sample_service_path.read_text(encoding="utf-8")
    raw_lines = raw_text.splitlines()

    extractor = PythonAstExtractor()
    chunks = extractor.parse_file(str(sample_service_path))
    assert len(chunks) == 24, f"Expected 24 chunks, got {len(chunks)}"

    for chunk in chunks:
        assert 1 <= chunk.startLine <= chunk.endLine <= len(raw_lines), (
            f"Invalid line bounds for {chunk.identifier}: [{chunk.startLine}, {chunk.endLine}] vs total {len(raw_lines)}"
        )

        # Slice lines from raw file (converting 1-indexed to 0-indexed)
        sliced_lines = raw_lines[chunk.startLine - 1 : chunk.endLine]
        sliced_code = "\n".join(sliced_lines)

        # Assert verbatim match with chunk.code
        assert chunk.code == sliced_code, (
            f"Code mismatch in chunk {chunk.identifier} (lines {chunk.startLine}-{chunk.endLine}):\n"
            f"Expected:\n{sliced_code}\n\nActual:\n{chunk.code}"
        )

        # Verify docstring cleaning
        if chunk.docstring:
            assert not chunk.docstring.startswith('"""')
            assert not chunk.docstring.endswith('"""')
            assert not chunk.docstring.startswith("'''")
            assert not chunk.docstring.endswith("'''")


def test_duplicate_and_property_identifiers(seeded_multihop_app: "FastAPI"):
    """Test behavior when an identifier has multiple definitions (property getter and setter)."""
    with TestClient(seeded_multihop_app) as client:
        resp = client.get("/api/v1/entity/BaseEntity.name")
        assert resp.status_code == 200
        data = resp.json()
        assert data["identifier"] == "BaseEntity.name"
        # BaseEntity has both getter @property def name and setter @name.setter def name
        assert data["count"] == 2, f"Expected 2 chunks for getter/setter, got {data['count']}"
        chunks = data["chunks"]
        assert len(chunks) == 2

        # Check getter chunk
        getter = next((c for c in chunks if "Get the entity name." in (c.get("docstring") or "")), None)
        assert getter is not None
        assert getter["startLine"] == 117
        assert getter["endLine"] == 120

        # Check setter chunk
        setter = next((c for c in chunks if "Set a new name" in (c.get("docstring") or "")), None)
        assert setter is not None
        assert setter["startLine"] == 122
        assert setter["endLine"] == 127


def test_adversarial_entity_lookups_and_injection(seeded_multihop_app: "FastAPI"):
    """Stress-test exact entity lookup endpoint with malicious, empty, and unusual inputs."""
    with TestClient(seeded_multihop_app) as client:
        # 1. SQL Injection attempts in path parameter
        sqli_payloads = [
            "calculate_statistics' OR '1'='1",
            "DataProcessingService'; DROP TABLE ast_chunks; --",
            "'; SELECT * FROM ast_chunks WHERE '1'='1",
            "' UNION SELECT * FROM ast_chunks --",
        ]
        for payload in sqli_payloads:
            resp = client.get(f"/api/v1/entity/{payload}")
            assert resp.status_code == 200, f"Failed on SQLi payload {payload}: {resp.status_code}"
            assert resp.json()["count"] == 0, f"SQLi payload {payload} leaked chunks!"

        # 2. Nested qualified identifier with dots
        resp = client.get("/api/v1/entity/DataProcessingService.ProcessingConfig.__init__")
        assert resp.status_code == 200
        assert resp.json()["count"] == 1
        assert resp.json()["chunks"][0]["identifier"] == "DataProcessingService.ProcessingConfig.__init__"

        # 3. Nonexistent identifier
        resp = client.get("/api/v1/entity/completely_nonexistent_identifier")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0
        assert resp.json()["chunks"] == []

        # 4. Extremely long identifier string (1000 characters)
        long_id = "A" * 1000
        resp = client.get(f"/api/v1/entity/{long_id}")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

        # 5. Unicode and special characters
        unicode_id = "calc_µ_variance_Ω_🔥"
        resp = client.get(f"/api/v1/entity/{unicode_id}")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0


def test_lancedb_multihop_retrieval_and_exact_match(tmp_path: Path, sample_service_path: Path):
    """Verify that multi-hop retrieval and exact matching work identically with LanceDB."""
    lance_dir = tmp_path / "lance_multihop"
    store = LanceDBVectorStore(db_path=str(lance_dir), dimension=384)
    store.initialize()
    embedder = SemanticAwareMockEmbedder(dimension=384)

    ingest = VectorIngestionService(embedder=embedder, vector_store=store)
    ingest.ingest_file(sample_service_path)
    assert store.count() == 24

    settings = Settings(
        vector_db_type="lancedb",
        db_path=str(lance_dir),
        use_mock_embedder=True,
    )
    app = create_app(settings=settings, vector_store=store, embedder=embedder)

    with TestClient(app) as client:
        # Hop 1: Semantic search
        s_resp = client.post("/api/v1/search", json={"query": "transform data batch", "top_k": 3})
        assert s_resp.status_code == 200
        assert s_resp.json()["chunks"][0]["identifier"] == "DataProcessingService.transform_batch"

        # Hop 2: Exact lookup function
        f_resp = client.get("/api/v1/entity/calculate_statistics")
        assert f_resp.status_code == 200
        assert f_resp.json()["count"] == 1
        assert f_resp.json()["chunks"][0]["identifier"] == "calculate_statistics"

        # Hop 3: Exact lookup class
        c_resp = client.get("/api/v1/entity/DataProcessingService")
        assert c_resp.status_code == 200
        assert c_resp.json()["count"] == 1
        assert c_resp.json()["chunks"][0]["identifier"] == "DataProcessingService"
        assert c_resp.json()["chunks"][0]["astNodeType"] == "ClassDef"

        # Hop 4: SQL injection resilience in LanceDB
        sqli_resp = client.get("/api/v1/entity/DataProcessingService' OR '1'='1")
        assert sqli_resp.status_code == 200
        assert sqli_resp.json()["count"] == 0


def test_lifespan_use_mock_embedder_bug():
    """Reproduce the bug in app/main.py:46 where MockEmbeddingModel is initialized with 'dim' instead of 'dimension'.

    When create_app() is called without an explicit embedder and use_mock_embedder=True,
    the lifespan context manager fails on startup with:
    TypeError: MockEmbeddingModel.__init__() got an unexpected keyword argument 'dim'
    """
    settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=":memory:",
        use_mock_embedder=True,
    )
    # Do NOT pass embedder, forcing lifespan to execute line 46
    app = create_app(settings=settings, vector_store=None, embedder=None)

    # Calling TestClient with lifespan context manager will trigger the bug
    with pytest.raises(TypeError, match="unexpected keyword argument 'dim'"):
        with TestClient(app) as client:
            client.get("/api/v1/health")
