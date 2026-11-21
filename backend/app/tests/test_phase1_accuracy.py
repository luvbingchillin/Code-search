"""Targeted verification tests for Phase 1: Hybrid Search, Idempotent Re-indexing,
Suffix-Aware Method Lookup, Auto-Manifests, and SQLite Tree Multi-Repo Isolation.
"""

from pathlib import Path
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.embedding import MockEmbeddingModel
from app.main import create_app
from app.models.chunk import AstCodeChunk
from app.services.ingestion import VectorIngestionService
from app.services.repo_registry import RepoRegistry, generate_structural_manifest
from app.services.retrieval import RetrievalService
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


def _make_chunk(
    cid: str,
    identifier: str,
    file_path: str = "sessions.py",
    node_type: str = "FunctionDef",
    docstring: str = "",
    repo_name: str = "local",
) -> AstCodeChunk:
    return AstCodeChunk(
        id=cid,
        filePath=file_path,
        fileName=Path(file_path).name,
        astNodeType=node_type,  # type: ignore[arg-type]
        identifier=identifier,
        startLine=10,
        endLine=30,
        code=f"def {identifier.split('.')[-1]}(self):\n    pass",
        docstring=docstring or None,
        parameters=["self"],
        decorators=[],
        repoFullName=repo_name,
        imports=[],
        calls=[],
    )


def test_suffix_aware_method_lookup_sqlite_and_lancedb(tmp_path: Path):
    """search_exact('prepare_request') resolves 'Session.prepare_request' on both stores."""
    embedder = MockEmbeddingModel(dimension=384)
    chunks = [
        _make_chunk("sessions.py:Session.prepare_request:10", "Session.prepare_request", "sessions.py"),
        _make_chunk("utils.py:prepare_request:5", "prepare_request", "utils.py"),
        _make_chunk("adapters.py:HTTPAdapter.send:20", "HTTPAdapter.send", "adapters.py"),
    ]
    embs = embedder.embed_documents([c.code for c in chunks])

    # SQLite
    sqlite_store = SQLiteVectorStore(db_path=":memory:")
    sqlite_store.initialize()
    sqlite_store.add_chunks(chunks, embs)
    sql_hits = sqlite_store.search_exact("prepare_request")
    assert [c.identifier for c in sql_hits] == ["prepare_request", "Session.prepare_request"]
    sql_send = sqlite_store.search_exact("send")
    assert [c.identifier for c in sql_send] == ["HTTPAdapter.send"]
    sqlite_store.close()

    # LanceDB
    lance_store = LanceDBVectorStore(db_path=str(tmp_path / "lance_suffix"))
    lance_store.initialize()
    lance_store.add_chunks(chunks, embs)
    lance_hits = lance_store.search_exact("prepare_request")
    assert [c.identifier for c in lance_hits] == ["prepare_request", "Session.prepare_request"]
    lance_send = lance_store.search_exact("send")
    assert [c.identifier for c in lance_send] == ["HTTPAdapter.send"]
    lance_store.close()


def test_idempotent_reindexing_in_lancedb(tmp_path: Path):
    """Re-ingesting the same chunks twice must not duplicate rows in LanceDB."""
    embedder = MockEmbeddingModel(dimension=384)
    store = LanceDBVectorStore(db_path=str(tmp_path / "lance_idem"))
    store.initialize()
    ingestion = VectorIngestionService(embedder=embedder, vector_store=store)

    chunks = [
        _make_chunk("a.py:alpha:1", "alpha", "a.py"),
        _make_chunk("b.py:beta:1", "beta", "b.py"),
    ]
    ingestion.ingest_chunks(chunks)
    assert store.count() == 2

    # Re-ingest identical chunks
    ingestion.ingest_chunks(chunks)
    assert store.count() == 2
    store.close()


def test_hybrid_search_boosts_exact_symbol_to_rank_1():
    """Hybrid dense + lexical reranking puts Session.send at Rank #1 even with MockEmbeddingModel."""
    embedder = MockEmbeddingModel(dimension=384)
    store = SQLiteVectorStore(db_path=":memory:")
    store.initialize()
    ingestion = VectorIngestionService(embedder=embedder, vector_store=store)
    retrieval = RetrievalService(vector_store=store, embedder=embedder)

    chunks = [
        _make_chunk("sessions.py:Session.send:100", "Session.send", "sessions.py", docstring="Send a PreparedRequest."),
        _make_chunk("models.py:Response.json:50", "Response.json", "models.py", docstring="Decode JSON payload."),
        _make_chunk("utils.py:format_header:10", "format_header", "utils.py", docstring="Format HTTP header."),
    ]
    ingestion.ingest_chunks(chunks)

    resp = retrieval.search_semantic("Where is Session.send defined?", top_k=3)
    assert len(resp.chunks) >= 1
    assert resp.chunks[0].identifier == "Session.send"
    store.close()


def test_auto_generated_manifest_and_sqlite_tree_isolation(tmp_path: Path):
    """Indexing a custom repo generates a rich manifest and isolates its SQLite file tree."""
    custom_repo = tmp_path / "billing_engine"
    custom_repo.mkdir()
    (custom_repo / "ledger.py").write_text(
        'class InvoiceLedger:\n    """Tracks customer invoices and balances."""\n    def record_charge(self, amount: float):\n        return amount\n',
        encoding="utf-8",
    )

    db_file = tmp_path / "test_phase1.db"
    registry_file = tmp_path / "registry.json"
    settings = Settings(vector_db_type="sqlite", sqlite_db_path=str(db_file), use_mock_embedder=True)
    app = create_app(settings=settings)

    from app.api.v1.endpoints import index as index_ep
    from app.api.v1.endpoints import repos as repos_ep

    isolated_registry = RepoRegistry(registry_file=registry_file)
    repos_ep.repo_registry = isolated_registry
    index_ep.repo_registry = isolated_registry

    with TestClient(app) as client:
        idx_resp = client.post("/api/v1/index", json={"source_dir": str(custom_repo)})
        assert idx_resp.status_code == 200
        assert idx_resp.json()["extracted_chunks"] == 2

        manifest_resp = client.get("/api/v1/repos/billing_engine/manifest")
        assert manifest_resp.status_code == 200
        m_data = manifest_resp.json()
        assert "InvoiceLedger" in m_data["manifest"]
        assert "InvoiceLedger" in m_data["core_components"]

        tree_resp = client.get("/api/v1/repos/billing_engine/tree")
        assert tree_resp.status_code == 200
        t_data = tree_resp.json()
        assert t_data["total_files"] == 1
        assert t_data["total_symbols"] == 2
        assert t_data["tree"][0]["fileName"] == "ledger.py"
