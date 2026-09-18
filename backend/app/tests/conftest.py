"""Shared Pytest fixtures for vector store, embedding, and ingestion tests."""

from pathlib import Path
from typing import List
import pytest

from app.core.embedding import MockEmbeddingModel
from app.models.chunk import AstCodeChunk
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


@pytest.fixture
def mock_embedder() -> MockEmbeddingModel:
    """Fixture providing an offline deterministic mock embedding model."""
    return MockEmbeddingModel(dimension=384)


@pytest.fixture
def sample_chunks() -> List[AstCodeChunk]:
    """Fixture providing a diverse set of AST code chunks for testing."""
    return [
        AstCodeChunk(
            id="services/calc.py::calculate_sum:1-8",
            filePath="services/calc.py",
            fileName="calc.py",
            astNodeType="FunctionDef",
            identifier="calculate_sum",
            startLine=1,
            endLine=8,
            code="def calculate_sum(a: int, b: int) -> int:\n    '''Calculate the sum of two integers.'''\n    return a + b",
            relevanceScore=1.0,
            docstring="Calculate the sum of two integers.",
            parameters=["a: int", "b: int"],
            decorators=[],
            language="python",
            repoFullName="local",
            summary="Calculate the sum of two integers.",
            imports=[],
            calls=[],
        ),
        AstCodeChunk(
            id="services/calc.py::Calculator:10-25",
            filePath="services/calc.py",
            fileName="calc.py",
            astNodeType="ClassDef",
            identifier="Calculator",
            startLine=10,
            endLine=25,
            code="class Calculator:\n    '''Advanced mathematical calculator service.'''\n    def multiply(self, x: float, y: float) -> float:\n        return x * y",
            relevanceScore=1.0,
            docstring="Advanced mathematical calculator service.",
            parameters=[],
            decorators=[],
            language="python",
            repoFullName="local",
            summary="Advanced mathematical calculator service.",
            imports=[],
            calls=[],
        ),
        AstCodeChunk(
            id="services/calc.py::Calculator.multiply:15-20",
            filePath="services/calc.py",
            fileName="calc.py",
            astNodeType="FunctionDef",
            identifier="Calculator.multiply",
            startLine=15,
            endLine=20,
            code="def multiply(self, x: float, y: float) -> float:\n    '''Multiply two floating point values.'''\n    return x * y",
            relevanceScore=1.0,
            docstring="Multiply two floating point values.",
            parameters=["self", "x: float", "y: float"],
            decorators=[],
            language="python",
            repoFullName="local",
            summary="Multiply two floating point values.",
            imports=[],
            calls=[],
        ),
        AstCodeChunk(
            id="network/client.py::fetch_async:1-12",
            filePath="network/client.py",
            fileName="client.py",
            astNodeType="AsyncFunctionDef",
            identifier="fetch_async",
            startLine=1,
            endLine=12,
            code="async def fetch_async(url: str) -> dict:\n    '''Fetch data from a remote endpoint asynchronously.'''\n    return {'status': 'ok'}",
            relevanceScore=1.0,
            docstring="Fetch data from a remote endpoint asynchronously.",
            parameters=["url: str"],
            decorators=["@log_execution"],
            language="python",
            repoFullName="local",
            summary="Fetch data from a remote endpoint asynchronously.",
            imports=["import aiohttp"],
            calls=["aiohttp.ClientSession"],
        ),
    ]


@pytest.fixture
def lance_store(tmp_path: Path):
    """Fixture providing an isolated LanceDB vector store cleaned up on teardown."""
    db_path = tmp_path / "lance_db"
    store = LanceDBVectorStore(db_path=str(db_path))
    store.initialize()
    yield store
    store.close()


@pytest.fixture
def sqlite_store(tmp_path: Path):
    """Fixture providing a file-backed SQLite vector store cleaned up on teardown."""
    db_path = tmp_path / "test_store.sqlite"
    store = SQLiteVectorStore(db_path=str(db_path))
    store.initialize()
    yield store
    store.close()


@pytest.fixture
def memory_sqlite_store():
    """Fixture providing an in-memory SQLite vector store."""
    store = SQLiteVectorStore(db_path=":memory:")
    store.initialize()
    yield store
    store.close()


@pytest.fixture
def test_app(mock_embedder, memory_sqlite_store):
    """Fixture providing a configured test FastAPI application with in-memory store."""
    from app.config import Settings
    from app.main import create_app

    test_settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=":memory:",
        use_mock_embedder=True,
    )
    application = create_app(
        settings=test_settings,
        vector_store=memory_sqlite_store,
        embedder=mock_embedder,
    )
    return application


@pytest.fixture
def test_client(test_app):
    """Fixture providing a TestClient for the test application."""
    from fastapi.testclient import TestClient

    with TestClient(test_app) as client:
        yield client


@pytest.fixture
def seeded_client(test_app, mock_embedder, memory_sqlite_store, sample_chunks):
    """Fixture providing a TestClient with sample_chunks pre-indexed."""
    from fastapi.testclient import TestClient
    from app.services.ingestion import VectorIngestionService

    ingest_svc = VectorIngestionService(embedder=mock_embedder, vector_store=memory_sqlite_store)
    ingest_svc.ingest_chunks(sample_chunks)
    with TestClient(test_app) as client:
        yield client

