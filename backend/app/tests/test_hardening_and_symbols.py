"""Tests for multi-repo vector isolation, ghost-free re-indexing, CORS/file security,
inheritance extraction, and browser folder upload indexing.
"""

from pathlib import Path
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.embedding import MockEmbeddingModel
from app.main import create_app
from app.parser.extractor import PythonAstExtractor
from app.services.ingestion import VectorIngestionService
from app.services.repo_registry import RepoRegistry
from app.services.retrieval import RetrievalService
from app.services.strata import build_strata_graph
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


def test_cors_blocks_untrusted_external_origin(tmp_path: Path):
    """Default CORS policy allows localhost Vite origins and omits Access-Control-Allow-Origin for evil sites."""
    settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=":memory:",
        use_mock_embedder=True,
    )
    app = create_app(settings=settings, embedder=MockEmbeddingModel(dimension=384))
    with TestClient(app) as client:
        ok_resp = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
        assert ok_resp.status_code == 200
        assert ok_resp.headers.get("access-control-allow-origin") == "http://localhost:5173"

        evil_resp = client.get("/api/v1/health", headers={"Origin": "https://evil-attacker.example"})
        assert evil_resp.status_code == 200
        assert evil_resp.headers.get("access-control-allow-origin") is None


def test_file_endpoint_blocks_hidden_dotfiles_and_non_python_files(tmp_path: Path):
    """GET /api/v1/repos/{id}/file blocks .env and non-Python files inside a repo root."""
    repo_dir = tmp_path / "sec_repo"
    repo_dir.mkdir()
    (repo_dir / "main.py").write_text("def run():\n    return 1\n", encoding="utf-8")
    (repo_dir / ".env").write_text("API_SECRET=supersecret\n", encoding="utf-8")
    (repo_dir / "notes.txt").write_text("internal notes\n", encoding="utf-8")

    registry_file = tmp_path / "registry.json"
    settings = Settings(vector_db_type="sqlite", sqlite_db_path=":memory:", use_mock_embedder=True)
    app = create_app(settings=settings, embedder=MockEmbeddingModel(dimension=384))

    from app.api.v1.endpoints import index as index_ep, repos as repos_ep

    isolated_registry = RepoRegistry(registry_file=registry_file)
    index_ep.repo_registry = isolated_registry
    repos_ep.repo_registry = isolated_registry

    with TestClient(app) as client:
        idx = client.post("/api/v1/index", json={"source_dir": str(repo_dir)})
        assert idx.status_code == 200

        py_ok = client.get("/api/v1/repos/sec_repo/file", params={"path": "main.py"})
        assert py_ok.status_code == 200
        assert "def run" in py_ok.json()["content"]

        env_blocked = client.get("/api/v1/repos/sec_repo/file", params={"path": ".env"})
        assert env_blocked.status_code == 400

        txt_blocked = client.get("/api/v1/repos/sec_repo/file", params={"path": "notes.txt"})
        assert txt_blocked.status_code == 400


def test_reindexing_shifted_lines_leaves_zero_ghost_chunks(tmp_path: Path):
    """Re-indexing after adding header lines or deleting functions purges stale rows in LanceDB and SQLite."""
    repo_dir = tmp_path / "evolving_repo"
    repo_dir.mkdir()
    mod_file = repo_dir / "worker.py"
    mod_file.write_text(
        "def alpha():\n    return 1\n\ndef obsolete():\n    return 2\n",
        encoding="utf-8",
    )

    registry_file = tmp_path / "registry.json"
    lance_dir = tmp_path / "lance_ghost"
    settings = Settings(vector_db_type="lancedb", db_path=str(lance_dir), use_mock_embedder=True)
    app = create_app(settings=settings, embedder=MockEmbeddingModel(dimension=384))

    from app.api.v1.endpoints import index as index_ep, repos as repos_ep

    isolated_registry = RepoRegistry(registry_file=registry_file)
    index_ep.repo_registry = isolated_registry
    repos_ep.repo_registry = isolated_registry

    with TestClient(app) as client:
        first = client.post("/api/v1/index", json={"source_dir": str(repo_dir)})
        assert first.status_code == 200
        assert first.json()["extracted_chunks"] == 2

        # Modify file: prepend 3 blank lines (shifting startLine of alpha) and remove obsolete()
        mod_file.write_text(
            "\n\n\ndef alpha():\n    return 1\n",
            encoding="utf-8",
        )
        second = client.post("/api/v1/index", json={"source_dir": str(repo_dir)})
        assert second.status_code == 200
        assert second.json()["extracted_chunks"] == 1

        health = client.get("/api/v1/health").json()
        assert health["total_chunks"] == 1

        obsolete_lookup = client.get("/api/v1/entity/obsolete", params={"repo_id": "evolving_repo"}).json()
        assert obsolete_lookup["count"] == 0

        alpha_lookup = client.get("/api/v1/entity/alpha", params={"repo_id": "evolving_repo"}).json()
        assert alpha_lookup["count"] == 1
        assert alpha_lookup["chunks"][0]["startLine"] == 4


def test_multi_repo_search_and_entity_isolation(tmp_path: Path):
    """One large repository cannot starve or leak identically named symbols into another repo."""
    embedder = MockEmbeddingModel(dimension=384)
    lance_store = LanceDBVectorStore(db_path=str(tmp_path / "lance_multi"))
    lance_store.initialize()
    sqlite_store = SQLiteVectorStore(db_path=":memory:")
    sqlite_store.initialize()

    repo_a = tmp_path / "repo_a"
    repo_b = tmp_path / "repo_b"
    repo_a.mkdir()
    repo_b.mkdir()

    # Large repo A with 60 functions + Config class
    a_lines = ["class Config:\n    mode = 'alpha'\n"]
    for i in range(60):
        a_lines.append(f"def worker_a_{i}():\n    return {i}\n")
    (repo_a / "app.py").write_text("\n".join(a_lines), encoding="utf-8")

    # Tiny repo B with Config class
    (repo_b / "app.py").write_text("class Config:\n    mode = 'beta'\n", encoding="utf-8")

    for store in (lance_store, sqlite_store):
        ingest = VectorIngestionService(embedder=embedder, vector_store=store)
        retrieval = RetrievalService(vector_store=store, embedder=embedder)

        ingest.ingest_directory(repo_a, repo_root=repo_a, repo_id="repo_a", replace_repo=True)
        ingest.ingest_directory(repo_b, repo_root=repo_b, repo_id="repo_b", replace_repo=True)

        # Even though repo_a > 50 chunks, scoped semantic search on repo_b MUST find repo_b's Config
        sem_b = retrieval.search_semantic("Config", top_k=5, repo_id="repo_b")
        assert len(sem_b.chunks) == 1
        assert sem_b.chunks[0].repoFullName == "repo_b"
        assert "beta" in sem_b.chunks[0].code

        # Scoped exact lookup on repo_a only returns repo_a's Config
        exact_a = retrieval.search_exact("Config", repo_id="repo_a")
        assert exact_a.count == 1
        assert exact_a.chunks[0].repoFullName == "repo_a"
        assert "alpha" in exact_a.chunks[0].code

        store.close()


def test_upload_folder_indexing_endpoint_and_traversal_guard(tmp_path: Path, monkeypatch):
    """POST /api/v1/index/upload indexes browser-selected .py files and rejects ../ traversal."""
    registry_file = tmp_path / "registry.json"
    upload_root = tmp_path / "uploaded_repos"
    settings = Settings(vector_db_type="sqlite", sqlite_db_path=":memory:", use_mock_embedder=True)
    app = create_app(settings=settings, embedder=MockEmbeddingModel(dimension=384))

    from app.api.v1.endpoints import index as index_ep, repos as repos_ep

    isolated_registry = RepoRegistry(registry_file=registry_file)
    monkeypatch.setattr(index_ep, "UPLOAD_REPOS_ROOT", upload_root)
    monkeypatch.setattr(index_ep, "repo_registry", isolated_registry)
    monkeypatch.setattr(repos_ep, "repo_registry", isolated_registry)

    with TestClient(app) as client:
        bad = client.post(
            "/api/v1/index/upload",
            json={
                "repo_name": "my-upload",
                "files": [{"path": "../../etc/passwd.py", "content": "def hack(): pass"}],
            },
        )
        assert bad.status_code == 400

        ok = client.post(
            "/api/v1/index/upload",
            json={
                "repo_name": "my-local-lib",
                "files": [
                    {
                        "path": "my-local-lib/models.py",
                        "content": "class BaseItem:\n    pass\n",
                    },
                    {
                        "path": "my-local-lib/service.py",
                        "content": (
                            "from models import BaseItem\n"
                            "class OrderItem(BaseItem):\n"
                            "    def total(self):\n"
                            "        return 10\n"
                        ),
                    },
                ],
            },
        )
        assert ok.status_code == 200
        body = ok.json()
        assert body["indexed_files"] == 2
        assert body["extracted_chunks"] == 3
        assert body["repo_id"] == "my-local-lib"

        repos = client.get("/api/v1/repos").json()["repositories"]
        assert any(r["id"] == "my-local-lib" for r in repos)


def test_extractor_extracts_bases_and_scopes_class_calls_for_strata():
    """ClassDef extracts superclass bases without duplicating nested method calls, and Strata links inheritance."""
    extractor = PythonAstExtractor()
    base_src = "class BaseHandler:\n    def helper(self):\n        return 1\n"
    child_src = (
        "from base import BaseHandler\n"
        "import ext_lib\n\n"
        "class OrderHandler(BaseHandler):\n"
        "    def handle(self):\n"
        "        return ext_lib.validate()\n"
    )
    ext_src = "def validate():\n    return True\n"

    base_chunks = extractor.parse_source(base_src, file_path="base.py")
    child_chunks = extractor.parse_source(child_src, file_path="order.py")
    ext_chunks = extractor.parse_source(ext_src, file_path="other_module.py")

    order_cls = next(c for c in child_chunks if c.identifier == "OrderHandler")
    order_method = next(c for c in child_chunks if c.identifier == "OrderHandler.handle")

    assert order_cls.bases == ["BaseHandler"]
    assert "ext_lib.validate" in order_method.calls
    assert "ext_lib.validate" not in order_cls.calls

    graph = build_strata_graph(base_chunks + child_chunks + ext_chunks, repo_id="test")
    edge_pairs = {(e.source, e.target, e.edgeType) for e in graph.edges}
    base_cls = next(c for c in base_chunks if c.identifier == "BaseHandler")

    # Structural inheritance edge must link OrderHandler -> BaseHandler
    assert (order_cls.id, base_cls.id, "inherits") in edge_pairs
    # External package call ext_lib.validate must NOT falsely link to unrelated other_module.validate
    ext_fn = ext_chunks[0]
    assert not any(e.source == order_method.id and e.target == ext_fn.id for e in graph.edges)
