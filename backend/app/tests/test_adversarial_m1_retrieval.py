"""Adversarial stress test suite for LanceDB retrieval (Milestone 1).

Tests LanceDBVectorStore against the persistent requests fixture database
at backend/data/lancedb:
1. Extreme semantic queries: empty query, long query (1000+ chars), unicode, punctuation.
2. Exact match lookups: qualified names (Session.send), non-existent entities, casing sensitivity, SQLi.
3. Filtering: ClassDef, FunctionDef, invalid node types, SQLi filters.
4. Boundaries: top_k <= 0, top_k > 284, score monotonicity, get_by_id.
"""

from pathlib import Path
import numpy as np
import pytest

from app.core.embedding import MockEmbeddingModel
from app.vector_store.lance_store import LanceDBVectorStore


@pytest.fixture(scope="module")
def persistent_store():
    backend_dir = Path(__file__).resolve().parent.parent.parent
    db_path = str(backend_dir / "data" / "lancedb")
    store = LanceDBVectorStore(db_path=db_path, table_name="ast_chunks")
    store.initialize()
    yield store
    store.close()


@pytest.fixture(scope="module")
def embedder():
    return MockEmbeddingModel(dimension=384)


class TestAdversarialSemanticQueries:
    def test_semantic_empty_query(self, persistent_store, embedder):
        vec = embedder.embed_query("")
        chunks = persistent_store.search_semantic(vec, top_k=5)
        assert len(chunks) == 5
        for c in chunks:
            assert 0.0 <= c.relevanceScore <= 1.0
            assert c.code and c.identifier

    def test_semantic_whitespace_query(self, persistent_store, embedder):
        for ws in ["   ", "\t\t\n\n\r\n   ", " \u00a0\u2000\u3000 "]:
            vec = embedder.embed_query(ws)
            chunks = persistent_store.search_semantic(vec, top_k=3)
            assert len(chunks) == 3
            for c in chunks:
                assert 0.0 <= c.relevanceScore <= 1.0

    def test_semantic_very_long_queries(self, persistent_store, embedder):
        long_nl = "send an HTTP GET request with authorization headers and connection pooling " * 20
        assert len(long_nl) >= 1400

        long_code = (
            "class CustomAdapter(HTTPAdapter):\n"
            "    def send(self, request, stream=False, timeout=None, verify=True, cert=None, proxies=None):\n"
            + "        x = 1 + 2\n" * 250
        )
        assert len(long_code) >= 2000

        for q in [long_nl, long_code]:
            vec = embedder.embed_query(q)
            chunks = persistent_store.search_semantic(vec, top_k=5)
            assert len(chunks) == 5
            for c in chunks:
                assert 0.0 <= c.relevanceScore <= 1.0

    def test_semantic_unicode_and_non_ascii(self, persistent_store, embedder):
        queries = [
            "def 查找HTTP请求(): 返回响应对象Session.send",
            "セッションを作成してHTTPリクエストを送信する",
            "def отправить_запрос(url, headers): вернуть ответ",
            "دالة لإرسال طلب بروتوكول نقل النص الفائق",
            "συνάρτηση για αποστολή αιτήματος HTTP",
            "🚀✨🔥 Session.send() -> 💻 200 OK 🐍🎉",
            "d̷e̶f̷ ̶s̸e̷n̷d̸(̶r̷e̸q̸u̴e̸s̶t̸)̶",
            "\u200b\u200c\u200d\u200e\u202e\ufeffSession.send",
        ]
        for q in queries:
            vec = embedder.embed_query(q)
            chunks = persistent_store.search_semantic(vec, top_k=5)
            assert len(chunks) == 5
            for c in chunks:
                assert 0.0 <= c.relevanceScore <= 1.0

    def test_semantic_punctuation_only(self, persistent_store, embedder):
        queries = [
            "!@#$%^&*()_+-=[]{}|;':\",./<>?",
            "''''''''\"\"\"\"\"\"``````",
            "'; DROP TABLE ast_chunks; -- ' OR '1'='1",
        ]
        for q in queries:
            vec = embedder.embed_query(q)
            chunks = persistent_store.search_semantic(vec, top_k=5)
            assert len(chunks) == 5
            for c in chunks:
                assert 0.0 <= c.relevanceScore <= 1.0


class TestAdversarialExactMatch:
    def test_exact_lookup_qualified_method_names(self, persistent_store):
        send_chunks = persistent_store.search_exact("Session.send")
        assert len(send_chunks) == 1
        chunk = send_chunks[0]
        assert chunk.identifier == "Session.send"
        assert chunk.astNodeType == "FunctionDef"
        assert chunk.filePath == "sessions.py"
        assert chunk.startLine > 0 and chunk.endLine >= chunk.startLine
        assert "def send(" in chunk.code

        for method, exp_type in [
            ("Session.request", "FunctionDef"),
            ("HTTPAdapter.send", "FunctionDef"),
            ("PreparedRequest.prepare", "FunctionDef"),
        ]:
            res = persistent_store.search_exact(method)
            assert len(res) >= 1
            assert res[0].astNodeType == exp_type

    def test_exact_lookup_non_existent_entity(self, persistent_store):
        for name in [
            "NonExistentEntity_12345",
            "Session.non_existent_method_xyz",
            "",
            "   ",
        ]:
            assert len(persistent_store.search_exact(name)) == 0

    def test_exact_lookup_casing_differences(self, persistent_store):
        # Case sensitivity on qualified methods
        for variant in ["session.send", "SESSION.SEND", "Session.Send"]:
            assert len(persistent_store.search_exact(variant)) == 0

        # Exact match distinguishes Session (ClassDef) from session (FunctionDef)
        class_res = persistent_store.search_exact("Session")
        assert len(class_res) == 1 and class_res[0].astNodeType == "ClassDef"

        func_res = persistent_store.search_exact("session")
        assert len(func_res) == 1 and func_res[0].astNodeType == "FunctionDef"

        # All-caps does not exist
        assert len(persistent_store.search_exact("SESSION")) == 0

    def test_exact_lookup_sqli_defense(self, persistent_store):
        payloads = [
            "Session.send' OR '1'='1",
            "' OR 1=1 --",
            "'; DROP TABLE ast_chunks; --",
        ]
        for payload in payloads:
            assert len(persistent_store.search_exact(payload)) == 0
        assert persistent_store.count() == 284


class TestAdversarialFiltering:
    def test_filtering_class_def(self, persistent_store, embedder):
        vec = embedder.embed_query("Session HTTP client")
        for top_k in [5, 20, 50]:
            chunks = persistent_store.search_semantic(vec, top_k=top_k, ast_node_type="ClassDef")
            assert len(chunks) > 0
            for c in chunks:
                assert c.astNodeType == "ClassDef"

        all_classes = persistent_store.search_semantic(vec, top_k=200, ast_node_type="ClassDef")
        assert len(all_classes) == 44
        assert all(c.astNodeType == "ClassDef" for c in all_classes)

    def test_filtering_function_def(self, persistent_store, embedder):
        vec = embedder.embed_query("send HTTP request")
        for top_k in [5, 20, 50]:
            chunks = persistent_store.search_semantic(vec, top_k=top_k, ast_node_type="FunctionDef")
            assert len(chunks) == top_k
            for c in chunks:
                assert c.astNodeType == "FunctionDef"

        all_funcs = persistent_store.search_semantic(vec, top_k=300, ast_node_type="FunctionDef")
        assert len(all_funcs) == 240
        assert all(c.astNodeType == "FunctionDef" for c in all_funcs)

    def test_filtering_invalid_and_injection(self, persistent_store, embedder):
        vec = embedder.embed_query("HTTP")
        for invalid in ["NonExistentDef", "ModuleDef", "InvalidType"]:
            assert len(persistent_store.search_semantic(vec, top_k=5, ast_node_type=invalid)) == 0

        # Empty string filter is falsy in LanceDBVectorStore and acts as no-filter
        assert len(persistent_store.search_semantic(vec, top_k=5, ast_node_type="")) == 5

        # SQL injection payloads in filter are escaped and return 0
        for sqli in ["ClassDef' OR '1'='1", "FunctionDef' OR 1=1 --"]:
            assert len(persistent_store.search_semantic(vec, top_k=5, ast_node_type=sqli)) == 0


class TestAdversarialBoundariesAndIntegrity:
    def test_top_k_boundaries(self, persistent_store, embedder):
        vec = embedder.embed_query("Session")
        assert len(persistent_store.search_semantic(vec, top_k=0)) == 0
        assert len(persistent_store.search_semantic(vec, top_k=-10)) == 0
        assert len(persistent_store.search_semantic(vec, top_k=1)) == 1
        all_chunks = persistent_store.search_semantic(vec, top_k=500)
        assert len(all_chunks) == 284

        scores = [c.relevanceScore for c in all_chunks]
        for i in range(len(scores) - 1):
            assert scores[i] >= scores[i + 1] - 1e-6

    def test_extreme_vectors(self, persistent_store):
        for vec in [
            np.zeros(384, dtype=np.float32),
            np.ones(384, dtype=np.float32),
            np.ones(384, dtype=np.float32) * 1e6,
            np.ones(384, dtype=np.float32) * 1e-8,
        ]:
            res = persistent_store.search_semantic(vec, top_k=5)
            assert len(res) == 5
            for c in res:
                assert 0.0 <= c.relevanceScore <= 1.0

    def test_get_by_id(self, persistent_store):
        sample = persistent_store.search_exact("Session.send")[0]
        found = persistent_store.get_by_id(sample.id)
        assert found is not None
        assert found.identifier == "Session.send"
        assert persistent_store.get_by_id("non-existent-id") is None
        assert persistent_store.get_by_id(f"{sample.id}' OR '1'='1") is None
