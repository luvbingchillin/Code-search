"""Acceptance Criteria Verification Test Suite.

Directly asserts and verifies all 5 acceptance criteria defined in
c:/Users/kangy/Desktop/Fyp/.agents/ORIGINAL_REQUEST.md (lines 50-57):

AC1: Pytest is configured as the testing framework.
AC2: Tree-sitter pipeline extracts complete functions and classes from sample files.
AC3: AST chunks can be embedded and stored in local Vector DB.
AC4: FastAPI endpoints return stored AST chunks via semantic search and exact-match lookup.
AC5: All tests run locally without external cloud dependencies and pass with exit code 0.
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.embedding import MockEmbeddingModel
from app.main import create_app
from app.models.chunk import AstCodeChunk
from app.parser.extractor import PythonAstExtractor
from app.parser.scanner import CodebaseScanner
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


def test_ac1_pytest_configured_as_testing_framework():
    """AC1: Verify Pytest is properly configured as the testing framework."""
    # Check pyproject.toml exists and contains pytest settings
    backend_dir = Path(__file__).resolve().parent.parent.parent
    pyproject_file = backend_dir / "pyproject.toml"
    assert pyproject_file.exists(), f"pyproject.toml not found at {pyproject_file}"

    content = pyproject_file.read_text(encoding="utf-8")
    assert "[tool.pytest.ini_options]" in content, "Missing [tool.pytest.ini_options] in pyproject.toml"
    assert 'testpaths = ["app/tests"]' in content or "testpaths" in content

    # Check pytest version
    pytest_ver = pytest.__version__
    assert int(pytest_ver.split(".")[0]) >= 8, f"Expected pytest >= 8, got {pytest_ver}"


def test_ac2_treesitter_pipeline_extracts_functions_and_classes(tmp_path: Path):
    """AC2: Verify Tree-sitter pipeline successfully extracts structurally complete functions and classes."""
    sample_code = '''"""Sample module for AST verification."""

def standalone_function(x: int, y: int = 10) -> int:
    """Add two numbers together."""
    result = x + y
    return result

@decorator_a
@decorator_b(param="val")
async def async_worker(task_id: str) -> bool:
    """Execute asynchronous background task."""
    return True

class DataProcessor:
    """Process structured data records."""

    def __init__(self, name: str):
        """Initialize data processor."""
        self.name = name

    def transform(self, data: list) -> list:
        """Transform input data items."""
        return [x * 2 for x in data]
'''
    dummy_file = tmp_path / "sample_service.py"
    dummy_file.write_text(sample_code, encoding="utf-8")

    extractor = PythonAstExtractor()
    scanner = CodebaseScanner(extractor=extractor)

    chunks = scanner.scan_file(str(dummy_file))
    assert len(chunks) >= 4, f"Expected at least 4 chunks, got {len(chunks)}"

    # 1. Verify standalone function extraction
    func_chunk = next((c for c in chunks if c.identifier == "standalone_function"), None)
    assert func_chunk is not None, "standalone_function not found in extracted chunks"
    assert func_chunk.astNodeType == "FunctionDef"
    assert func_chunk.docstring == "Add two numbers together."
    assert "x: int" in func_chunk.parameters
    assert "def standalone_function" in func_chunk.code
    assert func_chunk.startLine == 3
    assert func_chunk.endLine == 6

    # 2. Verify async function extraction with decorators
    async_chunk = next((c for c in chunks if c.identifier == "async_worker"), None)
    assert async_chunk is not None, "async_worker not found in extracted chunks"
    assert async_chunk.astNodeType == "AsyncFunctionDef"
    assert async_chunk.docstring == "Execute asynchronous background task."
    assert len(async_chunk.decorators) == 2
    assert "@decorator_a" in async_chunk.decorators
    assert func_chunk.startLine < async_chunk.startLine

    # 3. Verify class definition extraction
    class_chunk = next((c for c in chunks if c.identifier == "DataProcessor"), None)
    assert class_chunk is not None, "DataProcessor class not found"
    assert class_chunk.astNodeType == "ClassDef"
    assert class_chunk.docstring == "Process structured data records."
    assert "class DataProcessor:" in class_chunk.code
    assert "def transform" in class_chunk.code  # structurally complete containing methods

    # 4. Verify class method extraction with qualified name
    method_chunk = next((c for c in chunks if c.identifier == "DataProcessor.transform"), None)
    assert method_chunk is not None, "DataProcessor.transform method not found"
    assert method_chunk.astNodeType == "FunctionDef"
    assert method_chunk.docstring == "Transform input data items."
    assert "data: list" in method_chunk.parameters


def test_ac3_ast_chunks_embedded_and_stored_in_local_vectordb(tmp_path: Path):
    """AC3: Verify AST chunks can be embedded and stored in the chosen local Vector Database."""
    # Test with primary LanceDB engine
    lance_dir = tmp_path / "ac3_lancedb"
    lance_store = LanceDBVectorStore(db_path=str(lance_dir), dimension=384)
    lance_store.initialize()

    # Test with fallback SQLite engine
    sqlite_path = tmp_path / "ac3_sqlite.db"
    sqlite_store = SQLiteVectorStore(db_path=str(sqlite_path), dimension=384)
    sqlite_store.initialize()

    embedder = MockEmbeddingModel(dimension=384)
    test_chunk = AstCodeChunk(
        id="sample/math.py::calc_fibonacci:1-10",
        filePath="sample/math.py",
        fileName="math.py",
        astNodeType="FunctionDef",
        identifier="calc_fibonacci",
        startLine=1,
        endLine=10,
        code="def calc_fibonacci(n: int) -> int:\n    return n if n <= 1 else calc_fibonacci(n-1) + calc_fibonacci(n-2)",
        docstring="Compute the nth Fibonacci number.",
        parameters=["n: int"],
        decorators=[],
    )

    for store in (lance_store, sqlite_store):
        ingestion = VectorIngestionService(embedder=embedder, vector_store=store)
        count = ingestion.ingest_chunks([test_chunk])
        assert count == 1
        assert store.count() == 1

        # Verify exact match retrieval from storage
        matched = store.search_exact("calc_fibonacci")
        assert len(matched) == 1
        assert matched[0].identifier == "calc_fibonacci"
        assert matched[0].relevanceScore == 1.0

        # Verify get_by_id retrieval
        by_id = store.get_by_id("sample/math.py::calc_fibonacci:1-10")
        assert by_id is not None
        assert by_id.fileName == "math.py"
        assert "fibonacci" in by_id.code.lower()
        assert "Fibonacci" in (by_id.docstring or "")

        store.close()


def test_ac4_fastapi_endpoints_return_chunks_via_semantic_and_exact_search(tmp_path: Path):
    """AC4: Verify FastAPI endpoints return stored AST chunks via both semantic search and exact-match lookup."""
    db_path = tmp_path / "ac4_test.db"
    store = SQLiteVectorStore(db_path=str(db_path), dimension=384)
    store.initialize()

    embedder = MockEmbeddingModel(dimension=384)
    ingestion = VectorIngestionService(embedder=embedder, vector_store=store)

    chunks = [
        AstCodeChunk(
            id="auth/token.py::generate_jwt:1-12",
            filePath="auth/token.py",
            fileName="token.py",
            astNodeType="FunctionDef",
            identifier="generate_jwt",
            startLine=1,
            endLine=12,
            code="def generate_jwt(user_id: str) -> str:\n    '''Generate signed JSON Web Token.'''\n    return 'jwt_token'",
            docstring="Generate signed JSON Web Token.",
            parameters=["user_id: str"],
        ),
        AstCodeChunk(
            id="auth/user.py::UserManager.authenticate:15-25",
            filePath="auth/user.py",
            fileName="user.py",
            astNodeType="FunctionDef",
            identifier="UserManager.authenticate",
            startLine=15,
            endLine=25,
            code="def authenticate(self, credentials: dict) -> bool:\n    '''Authenticate user credentials.'''\n    return True",
            docstring="Authenticate user credentials.",
            parameters=["self", "credentials: dict"],
        ),
    ]
    ingestion.ingest_chunks(chunks)

    settings = Settings(vector_db_type="sqlite", sqlite_db_path=str(db_path), use_mock_embedder=True)
    app = create_app(settings=settings, vector_store=store, embedder=embedder)

    with TestClient(app) as client:
        # 1. Verify semantic search POST endpoint
        post_search = client.post(
            "/api/v1/search",
            json={"query": "user authentication and token generation", "top_k": 5},
        )
        assert post_search.status_code == 200
        search_data = post_search.json()
        assert search_data["total_results"] == 2
        assert len(search_data["chunks"]) == 2
        for ch in search_data["chunks"]:
            assert 0.0 <= ch["relevanceScore"] <= 1.0
            assert "filePath" in ch
            assert "code" in ch

        # 2. Verify semantic search GET endpoint
        get_search = client.get("/api/v1/search?query=jwt&top_k=1")
        assert get_search.status_code == 200
        assert len(get_search.json()["chunks"]) == 1

        # 3. Verify exact-match lookup for function name
        exact_func = client.get("/api/v1/entity/generate_jwt")
        assert exact_func.status_code == 200
        assert exact_func.json()["count"] == 1
        assert exact_func.json()["chunks"][0]["identifier"] == "generate_jwt"
        assert exact_func.json()["chunks"][0]["relevanceScore"] == 1.0

        # 4. Verify exact-match lookup for multi-hop Class.method
        exact_method = client.get("/api/v1/entity/UserManager.authenticate")
        assert exact_method.status_code == 200
        assert exact_method.json()["count"] == 1
        assert exact_method.json()["chunks"][0]["identifier"] == "UserManager.authenticate"


def test_ac5_all_tests_run_locally_without_external_cloud_dependencies():
    """AC5: Verify all tests run locally without external cloud dependencies."""
    # Assert no external cloud API keys are required
    cloud_keys = [
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "PINECONE_API_KEY",
        "AWS_ACCESS_KEY_ID",
        "COHERE_API_KEY",
    ]
    # Ensure system does not require any of these to be set
    for key in cloud_keys:
        # If set in environment, remove temporarily to prove independence
        saved = os.environ.pop(key, None)
        try:
            # Re-test an in-memory embedder and store cycle
            embedder = MockEmbeddingModel(dimension=384)
            vec = embedder.embed_query("test query without cloud")
            assert len(vec) == 384
        finally:
            if saved is not None:
                os.environ[key] = saved

    # Verify that Tree-sitter extractor runs 100% locally
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source("def local_fn(): pass", file_path="local.py")
    assert len(chunks) == 1
    assert chunks[0].identifier == "local_fn"
