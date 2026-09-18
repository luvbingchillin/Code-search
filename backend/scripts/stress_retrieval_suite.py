"""Empirical adversarial stress test suite for LanceDBVectorStore retrieval.

Validates:
1. Extreme semantic queries: empty, whitespace, 1000+ chars, non-ASCII/Unicode, punctuation.
2. Exact match lookups: qualified names (Session.send), non-existent, casing, SQLi.
3. Filtering: ClassDef (only classes), FunctionDef (only functions), invalid types, filter SQLi.
4. Bounds & stability: top_k boundaries, zero/extreme vectors, get_by_id, latency, repeated load.
"""

import math
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
from app.core.embedding import MockEmbeddingModel
from app.models.chunk import AstCodeChunk
from app.services.retrieval import RetrievalService
from app.vector_store.lance_store import LanceDBVectorStore


class StressTestRunner:
    def __init__(self, db_path: str = "data/lancedb", table_name: str = "ast_chunks"):
        self.db_path = str(Path(BACKEND_DIR) / db_path)
        self.table_name = table_name
        self.store = LanceDBVectorStore(db_path=self.db_path, table_name=self.table_name)
        self.store.initialize()
        self.embedder = MockEmbeddingModel(dimension=384)
        self.service = RetrievalService(vector_store=self.store, embedder=self.embedder)

        self.passed = 0
        self.failed = 0
        self.results: List[Dict[str, Any]] = []

    def record_test(self, test_name: str, passed: bool, details: str, latency_ms: float = 0.0):
        import traceback
        if passed:
            self.passed += 1
            status = "PASS"
            print(f"[{status}] {test_name} ({latency_ms:.2f}ms): {details}")
        else:
            self.failed += 1
            status = "FAIL"
            print(f"[{status}] {test_name} ({latency_ms:.2f}ms): {details}")
            print(traceback.format_exc())
        self.results.append({
            "test": test_name,
            "status": status,
            "details": details,
            "latency_ms": round(latency_ms, 3),
        })

    # =========================================================================
    # Test Group 1: Extreme Semantic Search Queries
    # =========================================================================
    def test_semantic_empty_query(self):
        t0 = time.perf_counter()
        try:
            vec = self.embedder.embed_query("")
            chunks = self.store.search_semantic(vec, top_k=5)
            dt = (time.perf_counter() - t0) * 1000
            assert len(chunks) == 5, f"Expected 5 chunks, got {len(chunks)}"
            for c in chunks:
                assert 0.0 <= c.relevanceScore <= 1.0
                assert c.code and c.identifier
            self.record_test("semantic_empty_string", True, f"Returned {len(chunks)} chunks, scores valid", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_empty_string", False, f"Exception: {e}", dt)

    def test_semantic_whitespace_query(self):
        t0 = time.perf_counter()
        try:
            whitespaces = ["   ", "\t\t\n\n\r\n   ", " \u00a0\u2000\u3000 "]
            for ws in whitespaces:
                vec = self.embedder.embed_query(ws)
                chunks = self.store.search_semantic(vec, top_k=3)
                assert len(chunks) == 3, f"Expected 3 chunks for whitespace, got {len(chunks)}"
                for c in chunks:
                    assert 0.0 <= c.relevanceScore <= 1.0
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_whitespace_query", True, f"Tested {len(whitespaces)} whitespace variants, all returned 3 valid chunks", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_whitespace_query", False, f"Exception: {e}", dt)

    def test_semantic_very_long_query(self):
        t0 = time.perf_counter()
        try:
            # 1500 chars repeated NL text
            long_nl = "send an HTTP GET request with authorization headers and connection pooling " * 20
            assert len(long_nl) >= 1400

            # 5000 chars simulated python code snippet
            long_code = (
                "class CustomAdapter(HTTPAdapter):\n"
                "    def send(self, request, stream=False, timeout=None, verify=True, cert=None, proxies=None):\n"
                "        # custom implementation\n"
                + "        x = 1 + 2\n" * 250
            )
            assert len(long_code) >= 2000

            # 15000 chars massive query
            massive_query = "requests.Session " * 1000
            assert len(massive_query) >= 15000

            for q, label in [(long_nl, "1500_char_nl"), (long_code, "5000_char_code"), (massive_query, "15000_char_massive")]:
                vec = self.embedder.embed_query(q)
                chunks = self.store.search_semantic(vec, top_k=5)
                assert len(chunks) == 5, f"Expected 5 chunks for {label}, got {len(chunks)}"
                for c in chunks:
                    assert 0.0 <= c.relevanceScore <= 1.0

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_very_long_queries", True, f"Tested 1500, 5000, 15000 char queries successfully", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_very_long_queries", False, f"Exception: {e}", dt)

    def test_semantic_unicode_and_non_ascii(self):
        t0 = time.perf_counter()
        try:
            queries = [
                ("CJK_Chinese", "def 查找HTTP请求(): 返回响应对象Session.send"),
                ("CJK_Japanese", "セッションを作成してHTTPリクエストを送信する"),
                ("Cyrillic_Russian", "def отправить_запрос(url, headers): вернуть ответ"),
                ("Arabic_RTL", "دالة لإرسال طلب بروتوكول نقل النص الفائق"),
                ("Greek", "συνάρτηση για αποστολή αιτήματος HTTP"),
                ("Emoji_Symbols", "🚀✨🔥 Session.send() -> 💻 200 OK 🐍🎉"),
                ("Zalgo_Combining", "d̷e̶f̷ ̶s̸e̷n̷d̸(̶r̷e̸q̸u̴e̸s̶t̸)̶"),
                ("ZeroWidth_Control", "\u200b\u200c\u200d\u200e\u202e\ufeffSession.send"),
            ]

            for label, q in queries:
                vec = self.embedder.embed_query(q)
                chunks = self.store.search_semantic(vec, top_k=5)
                assert len(chunks) == 5, f"Failed for {label}: expected 5 chunks, got {len(chunks)}"
                for c in chunks:
                    assert 0.0 <= c.relevanceScore <= 1.0
                    assert c.identifier

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_unicode_and_non_ascii", True, f"Tested {len(queries)} exotic unicode queries successfully", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_unicode_and_non_ascii", False, f"Exception: {e}", dt)

    def test_semantic_punctuation_only(self):
        t0 = time.perf_counter()
        try:
            punct_queries = [
                ("standard_punct", "!@#$%^&*()_+-=[]{}|;':\",./<>?"),
                ("repeated_quotes", "''''''''\"\"\"\"\"\"``````"),
                ("slashes_and_brackets", "///\\\\\\\\[[[[{}]]]](((())))"),
                ("sqli_tokens", "'; DROP TABLE ast_chunks; -- ' OR '1'='1"),
                ("code_operators", ">>= <<= += -= *= /= //= %= **= @="),
            ]

            for label, q in punct_queries:
                vec = self.embedder.embed_query(q)
                chunks = self.store.search_semantic(vec, top_k=5)
                assert len(chunks) == 5, f"Expected 5 chunks for {label}, got {len(chunks)}"
                for c in chunks:
                    assert 0.0 <= c.relevanceScore <= 1.0

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_punctuation_only", True, f"Tested {len(punct_queries)} punctuation-only queries successfully", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("semantic_punctuation_only", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 2: Exact Match Lookups
    # =========================================================================
    def test_exact_lookup_qualified_method_names(self):
        t0 = time.perf_counter()
        try:
            # Session.send is explicitly required in user prompt
            send_chunks = self.store.search_exact("Session.send")
            assert len(send_chunks) == 1, f"Expected 1 chunk for Session.send, got {len(send_chunks)}"
            chunk = send_chunks[0]
            assert chunk.identifier == "Session.send"
            assert chunk.astNodeType == "FunctionDef"
            assert chunk.filePath == "sessions.py"
            assert chunk.startLine > 0 and chunk.endLine >= chunk.startLine
            assert "def send(" in chunk.code
            assert chunk.relevanceScore == 1.0

            # Test other known qualified methods in requests
            other_methods = [
                ("Session.request", "FunctionDef", "sessions.py"),
                ("Session.get", "FunctionDef", "sessions.py"),
                ("HTTPAdapter.send", "FunctionDef", "adapters.py"),
                ("PreparedRequest.prepare", "FunctionDef", "models.py"),
            ]
            for method_name, exp_type, exp_file in other_methods:
                res = self.store.search_exact(method_name)
                assert len(res) >= 1, f"Expected >=1 hit for {method_name}, got {len(res)}"
                assert res[0].identifier == method_name
                assert res[0].astNodeType == exp_type
                assert res[0].filePath == exp_file

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_qualified_methods", True, f"Session.send and {len(other_methods)} other qualified methods resolved with 100% precision", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_qualified_methods", False, f"Exception: {e}", dt)

    def test_exact_lookup_non_existent_entity(self):
        t0 = time.perf_counter()
        try:
            non_existent = [
                "NonExistentEntity_12345",
                "Session.non_existent_method_xyz",
                "definitely_not_in_requests",
                "",
                "   ",
                "HTTPAdapter.quantum_tunneling",
            ]
            for name in non_existent:
                res = self.store.search_exact(name)
                assert len(res) == 0, f"Expected 0 hits for '{name}', got {len(res)}"

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_non_existent_entities", True, f"Tested {len(non_existent)} non-existent queries, all cleanly returned empty list", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_non_existent_entities", False, f"Exception: {e}", dt)

    def test_exact_lookup_casing_differences(self):
        t0 = time.perf_counter()
        try:
            # Session.send vs lowercase / uppercase / mixed case
            casing_variants = [
                "session.send",
                "SESSION.SEND",
                "Session.Send",
                "sEsSiOn.sEnD",
                "SESSION.send",
            ]
            for variant in casing_variants:
                res = self.store.search_exact(variant)
                # Exact match in LanceDB is case-sensitive: none of these match Session.send
                assert len(res) == 0, f"Expected 0 hits for case variant '{variant}', got {len(res)}"

            # Canonical case must return exactly 1 hit
            canonical = self.store.search_exact("Session.send")
            assert len(canonical) == 1, "Canonical 'Session.send' must return 1 hit"

            # Case sensitivity distinction between Session (ClassDef) and session (FunctionDef):
            # Both exist in requests (sessions.py), but as distinct entities!
            class_res = self.store.search_exact("Session")
            assert len(class_res) == 1 and class_res[0].astNodeType == "ClassDef"
            func_res = self.store.search_exact("session")
            assert len(func_res) == 1 and func_res[0].astNodeType == "FunctionDef"

            # All uppercase SESSION does not exist
            upper_res = self.store.search_exact("SESSION")
            assert len(upper_res) == 0

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_casing_differences", True, f"Verified exact match is strictly case-sensitive; distinguishes Session (ClassDef) from session (FunctionDef)", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_casing_differences", False, f"Exception: {e}", dt)

    def test_exact_lookup_sql_injection_defense(self):
        t0 = time.perf_counter()
        try:
            sqli_payloads = [
                "Session.send' OR '1'='1",
                "' OR 1=1 --",
                "'; DROP TABLE ast_chunks; --",
                "Session.send' UNION SELECT * FROM ast_chunks --",
                "' OR ''='",
                "admin' --",
            ]
            for payload in sqli_payloads:
                res = self.store.search_exact(payload)
                assert len(res) == 0, f"SQL injection vulnerability: payload '{payload}' returned {len(res)} chunks!"

            # Verify table was not dropped or corrupted
            count_after = self.store.count()
            assert count_after == 284, f"Table count corrupted! Expected 284, got {count_after}"

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_sqli_defense", True, f"Tested {len(sqli_payloads)} SQLi payloads, zero leak or corruption", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("exact_sqli_defense", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 3: AST Node Type Filtering
    # =========================================================================
    def test_filtering_class_def(self):
        t0 = time.perf_counter()
        try:
            vec = self.embedder.embed_query("Session HTTP client connection adapter")

            # Test various top_k values
            for top_k in [5, 20, 50, 100]:
                chunks = self.store.search_semantic(vec, top_k=top_k, ast_node_type="ClassDef")
                assert len(chunks) > 0, f"Expected >0 ClassDef chunks for top_k={top_k}"
                assert len(chunks) <= min(top_k, 44), f"Got {len(chunks)} chunks, exceeds available 44 ClassDef"
                for c in chunks:
                    assert c.astNodeType == "ClassDef", f"Filter breach! Expected ClassDef, got {c.astNodeType} for {c.identifier}"

            # Verify maximum retrieval returns all 44 classes
            all_classes = self.store.search_semantic(vec, top_k=200, ast_node_type="ClassDef")
            assert len(all_classes) == 44, f"Expected all 44 ClassDef chunks, got {len(all_classes)}"
            assert all(c.astNodeType == "ClassDef" for c in all_classes)

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("filtering_class_def", True, f"100% purity: all returned chunks are ClassDef (total {len(all_classes)} in DB)", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("filtering_class_def", False, f"Exception: {e}", dt)

    def test_filtering_function_def(self):
        t0 = time.perf_counter()
        try:
            vec = self.embedder.embed_query("send an HTTP request and parse headers")

            for top_k in [5, 20, 50, 100]:
                chunks = self.store.search_semantic(vec, top_k=top_k, ast_node_type="FunctionDef")
                assert len(chunks) == top_k, f"Expected {top_k} FunctionDef chunks, got {len(chunks)}"
                for c in chunks:
                    assert c.astNodeType == "FunctionDef", f"Filter breach! Expected FunctionDef, got {c.astNodeType} for {c.identifier}"

            # Verify maximum retrieval returns all 240 functions
            all_funcs = self.store.search_semantic(vec, top_k=300, ast_node_type="FunctionDef")
            assert len(all_funcs) == 240, f"Expected 240 FunctionDef chunks, got {len(all_funcs)}"
            assert all(c.astNodeType == "FunctionDef" for c in all_funcs)

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("filtering_function_def", True, f"100% purity: all returned chunks are FunctionDef (total {len(all_funcs)} in DB)", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("filtering_function_def", False, f"Exception: {e}", dt)

    def test_filtering_invalid_node_types_and_injection(self):
        t0 = time.perf_counter()
        try:
            vec = self.embedder.embed_query("HTTP")

            # Non-existent node types evaluate truthy and filter WHERE astNodeType = '...', returning 0
            for invalid_type in ["NonExistentDef", "ModuleDef", "AsyncFunctionDef", "InvalidType123"]:
                chunks = self.store.search_semantic(vec, top_k=5, ast_node_type=invalid_type)
                assert len(chunks) == 0, f"Expected 0 chunks for invalid type '{invalid_type}', got {len(chunks)}"

            # Empty string ast_node_type="" is falsy (if ast_node_type:), so it behaves like None (no filter)
            empty_filter_chunks = self.store.search_semantic(vec, top_k=5, ast_node_type="")
            assert len(empty_filter_chunks) == 5, f"Expected 5 unfiltered chunks for empty string filter, got {len(empty_filter_chunks)}"

            # SQL injection via filter parameter
            sqli_filters = [
                "ClassDef' OR '1'='1",
                "FunctionDef' OR 1=1 --",
                "ClassDef' UNION SELECT * FROM ast_chunks --",
            ]
            for sqli in sqli_filters:
                chunks = self.store.search_semantic(vec, top_k=5, ast_node_type=sqli)
                assert len(chunks) == 0, f"SQL injection bypass via filter '{sqli}' returned {len(chunks)} chunks!"

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("filtering_invalid_and_injection", True, f"Tested invalid types (0 hits), empty string (unfiltered fallback), and SQLi filter payloads cleanly neutralized", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("filtering_invalid_and_injection", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 4: Top-K Boundary & Parameter Stress
    # =========================================================================
    def test_top_k_boundaries(self):
        t0 = time.perf_counter()
        try:
            vec = self.embedder.embed_query("Session")

            # top_k <= 0
            assert len(self.store.search_semantic(vec, top_k=0)) == 0
            assert len(self.store.search_semantic(vec, top_k=-1)) == 0
            assert len(self.store.search_semantic(vec, top_k=-100)) == 0

            # top_k = 1
            res1 = self.store.search_semantic(vec, top_k=1)
            assert len(res1) == 1

            # top_k = total_count (284)
            res_all = self.store.search_semantic(vec, top_k=284)
            assert len(res_all) == 284

            # top_k > total_count (1000)
            res_over = self.store.search_semantic(vec, top_k=1000)
            assert len(res_over) == 284

            # Verify relevanceScore monotonicity (descending order)
            scores = [c.relevanceScore for c in res_all]
            for i in range(len(scores) - 1):
                assert scores[i] >= scores[i + 1] - 1e-6, f"Scores not monotonically decreasing at {i}: {scores[i]} < {scores[i+1]}"

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("top_k_boundaries", True, f"Boundary top_k (0, -1, 1, 284, 1000) and monotonic score order verified", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("top_k_boundaries", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 5: Extreme Embedding Vector Space Stress
    # =========================================================================
    def test_extreme_vector_inputs(self):
        t0 = time.perf_counter()
        try:
            dim = 384
            # 1. All zeros vector
            vec_zeros = np.zeros(dim, dtype=np.float32)
            res_zeros = self.store.search_semantic(vec_zeros, top_k=5)
            assert len(res_zeros) == 5
            for c in res_zeros:
                assert not math.isnan(c.relevanceScore)
                assert 0.0 <= c.relevanceScore <= 1.0

            # 2. All ones vector
            vec_ones = np.ones(dim, dtype=np.float32)
            res_ones = self.store.search_semantic(vec_ones, top_k=5)
            assert len(res_ones) == 5

            # 3. Very large magnitude vector
            vec_huge = np.ones(dim, dtype=np.float32) * 1e6
            res_huge = self.store.search_semantic(vec_huge, top_k=5)
            assert len(res_huge) == 5
            for c in res_huge:
                assert not math.isnan(c.relevanceScore)

            # 4. Very small magnitude vector
            vec_tiny = np.ones(dim, dtype=np.float32) * 1e-8
            res_tiny = self.store.search_semantic(vec_tiny, top_k=5)
            assert len(res_tiny) == 5

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("extreme_vector_inputs", True, f"Zero, huge, and tiny vectors handled gracefully without NaN or crash", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("extreme_vector_inputs", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 6: get_by_id Integrity
    # =========================================================================
    def test_get_by_id_integrity(self):
        t0 = time.perf_counter()
        try:
            # Sample an existing chunk to get its ID
            sample = self.store.search_exact("Session.send")[0]
            chunk_id = sample.id

            # Exact ID retrieval
            retrieved = self.store.get_by_id(chunk_id)
            assert retrieved is not None
            assert retrieved.id == chunk_id
            assert retrieved.identifier == "Session.send"
            assert retrieved.filePath == "sessions.py"

            # Non-existent ID
            assert self.store.get_by_id("non-existent-chunk-id-xyz-999") is None

            # SQL injection ID
            assert self.store.get_by_id(f"{chunk_id}' OR '1'='1") is None
            assert self.store.get_by_id("'; DROP TABLE ast_chunks; --") is None

            # Empty string ID
            assert self.store.get_by_id("") is None

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("get_by_id_integrity", True, f"Valid ID, non-existent ID, and SQLi IDs verified", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("get_by_id_integrity", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 7: Service Layer & Stability Under Repeated Load
    # =========================================================================
    def test_repeated_load_and_service_stability(self):
        t0 = time.perf_counter()
        try:
            latencies = []
            queries = [
                "Session.send",
                "HTTPAdapter.send",
                "send an HTTP request",
                "CookieJar handling",
                "prepare_request",
                "def request(",
                "Response status code",
                "reconnection pool",
                "SSL certificate verification",
                "JSON decode error",
            ]

            for i in range(50):
                q = queries[i % len(queries)]
                t_sub = time.perf_counter()
                if i % 2 == 0:
                    resp = self.service.search_semantic(query=q, top_k=5)
                    assert resp.total_results == 5
                else:
                    resp = self.service.search_exact(identifier="Session.send")
                    assert resp.count == 1
                latencies.append((time.perf_counter() - t_sub) * 1000)

            avg_lat = sum(latencies) / len(latencies)
            max_lat = max(latencies)
            p95_lat = sorted(latencies)[int(len(latencies) * 0.95)]

            dt = (time.perf_counter() - t0) * 1000
            self.record_test(
                "repeated_load_50_queries",
                True,
                f"50 requests completed: avg={avg_lat:.2f}ms, p95={p95_lat:.2f}ms, max={max_lat:.2f}ms",
                dt,
            )
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("repeated_load_50_queries", False, f"Exception: {e}", dt)

    # =========================================================================
    # Test Group 8: FastAPI HTTP Endpoints Adversarial Stress
    # =========================================================================
    def test_fastapi_http_endpoints(self):
        t0 = time.perf_counter()
        try:
            from fastapi.testclient import TestClient
            from app.main import create_app

            app = create_app(vector_store=self.store, embedder=self.embedder)
            client = TestClient(app)

            # 1. Health check verifies 284 chunks
            resp_health = client.get("/api/v1/health")
            assert resp_health.status_code == 200
            data_health = resp_health.json()
            assert data_health["status"] == "healthy"
            assert data_health["total_chunks"] == 284

            # 2. Empty query rejection (HTTP 422)
            resp_empty_get = client.get("/api/v1/search?query=")
            assert resp_empty_get.status_code == 422, f"Expected 422 for empty query GET, got {resp_empty_get.status_code}"

            resp_empty_post = client.post("/api/v1/search", json={"query": "", "top_k": 5})
            assert resp_empty_post.status_code == 422, f"Expected 422 for empty query POST, got {resp_empty_post.status_code}"

            # 3. Very long query (1500+ chars) over HTTP
            long_q = "send an HTTP request with authentication tokens and proxy configuration " * 25
            resp_long = client.post("/api/v1/search", json={"query": long_q, "top_k": 5})
            assert resp_long.status_code == 200
            assert resp_long.json()["total_results"] == 5

            # 4. Unicode & Punctuation queries over HTTP
            resp_uni = client.post("/api/v1/search", json={"query": "🚀✨ Session.send() 💻 查找HTTP请求", "top_k": 3})
            assert resp_uni.status_code == 200
            assert resp_uni.json()["total_results"] == 3

            resp_punct = client.post("/api/v1/search", json={"query": "!@#$%^&*()_+-=[]{}|;':\",./<>?", "top_k": 3})
            assert resp_punct.status_code == 200
            assert resp_punct.json()["total_results"] == 3

            # 5. Exact match: Session.send over HTTP
            resp_exact = client.get("/api/v1/entity/Session.send")
            assert resp_exact.status_code == 200
            data_exact = resp_exact.json()
            assert data_exact["count"] == 1
            assert data_exact["chunks"][0]["identifier"] == "Session.send"
            assert data_exact["chunks"][0]["astNodeType"] == "FunctionDef"
            assert data_exact["chunks"][0]["filePath"] == "sessions.py"

            # 6. Casing differences over HTTP: Session vs session vs SESSION
            resp_class = client.get("/api/v1/entity/Session")
            assert resp_class.status_code == 200 and resp_class.json()["count"] == 1
            assert resp_class.json()["chunks"][0]["astNodeType"] == "ClassDef"

            resp_func = client.get("/api/v1/entity/session")
            assert resp_func.status_code == 200 and resp_func.json()["count"] == 1
            assert resp_func.json()["chunks"][0]["astNodeType"] == "FunctionDef"

            resp_upper = client.get("/api/v1/entity/SESSION")
            assert resp_upper.status_code == 200 and resp_upper.json()["count"] == 0

            # 7. Non-existent entity over HTTP
            resp_none = client.get("/api/v1/entity/NonExistent_Entity_999")
            assert resp_none.status_code == 200 and resp_none.json()["count"] == 0

            # 8. SQLi entity parameter over HTTP
            resp_sqli = client.get("/api/v1/entity/Session.send'%20OR%20'1'='1")
            assert resp_sqli.status_code == 200 and resp_sqli.json()["count"] == 0

            # 9. Filtering over HTTP: ClassDef
            resp_filt_class = client.post("/api/v1/search", json={"query": "HTTP", "top_k": 10, "ast_node_type": "ClassDef"})
            assert resp_filt_class.status_code == 200
            for c in resp_filt_class.json()["chunks"]:
                assert c["astNodeType"] == "ClassDef"

            # 10. Filtering over HTTP: FunctionDef
            resp_filt_func = client.post("/api/v1/search", json={"query": "HTTP", "top_k": 10, "ast_node_type": "FunctionDef"})
            assert resp_filt_func.status_code == 200
            for c in resp_filt_func.json()["chunks"]:
                assert c["astNodeType"] == "FunctionDef"

            # 11. Filtering over HTTP: Invalid node type rejected with 422
            resp_filt_inv = client.post("/api/v1/search", json={"query": "HTTP", "top_k": 5, "ast_node_type": "InvalidType123"})
            assert resp_filt_inv.status_code == 422

            dt = (time.perf_counter() - t0) * 1000
            self.record_test("fastapi_http_endpoints", True, "All 11 HTTP endpoint adversarial checks (422 validation, unicode, long queries, exact match, filtering) passed", dt)
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            self.record_test("fastapi_http_endpoints", False, f"Exception: {e}", dt)

    def run_all(self):
        print("=" * 70)
        print(f"Starting LanceDB Adversarial Stress Suite on: {self.db_path}")
        print(f"Initial store count: {self.store.count()} chunks")
        print("=" * 70)

        self.test_semantic_empty_query()
        self.test_semantic_whitespace_query()
        self.test_semantic_very_long_query()
        self.test_semantic_unicode_and_non_ascii()
        self.test_semantic_punctuation_only()

        self.test_exact_lookup_qualified_method_names()
        self.test_exact_lookup_non_existent_entity()
        self.test_exact_lookup_casing_differences()
        self.test_exact_lookup_sql_injection_defense()

        self.test_filtering_class_def()
        self.test_filtering_function_def()
        self.test_filtering_invalid_node_types_and_injection()

        self.test_top_k_boundaries()
        self.test_extreme_vector_inputs()
        self.test_get_by_id_integrity()
        self.test_repeated_load_and_service_stability()
        self.test_fastapi_http_endpoints()

        self.store.close()

        print("=" * 70)
        print(f"Stress Suite Finished. Passed: {self.passed}, Failed: {self.failed}")
        print("=" * 70)
        return self.failed == 0


if __name__ == "__main__":
    runner = StressTestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)
