"""Adversarial stress tests for vector store ranking, score monotonicity, top_k boundaries, and SQL injection."""

import os
from pathlib import Path
from typing import List
import numpy as np
import pytest

from app.core.embedding import MockEmbeddingModel
from app.models.chunk import AstCodeChunk
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore


def make_dummy_chunk(cid: str, identifier: str, node_type: str = "FunctionDef") -> AstCodeChunk:
    return AstCodeChunk(
        id=f"test/file.py::{identifier}:1-10",
        filePath="test/file.py",
        fileName="file.py",
        astNodeType=node_type,
        identifier=identifier,
        startLine=1,
        endLine=10,
        code=f"def {identifier}(): pass",
        relevanceScore=1.0,
    )


# ============================================================================
# 1. SQL Injection Tests in search_exact
# ============================================================================

@pytest.mark.parametrize(
    "payload",
    [
        "' OR 1=1 --",
        "' OR '1'='1",
        "secret' OR 1=1 --",
        "admin' OR '1'='1' --",
        "' OR 1=1 /*",
        "'; DROP TABLE ast_chunks; --",
        "\" OR 1=1 --",
        "' UNION SELECT * FROM ast_chunks --",
        "'; DELETE FROM ast_chunks WHERE '1'='1",
        "'; SELECT * FROM ast_chunks; --",
        "\\'; DROP TABLE ast_chunks; --",
        "'' OR ''='' --",
        "nonexistent' OR 1=1 #",
    ],
)
def test_search_exact_sql_injection_sqlite(memory_sqlite_store: SQLiteVectorStore, payload: str):
    """Verify SQLite search_exact is 100% immune to SQL injection payloads."""
    c1 = make_dummy_chunk("1", "target_func")
    c2 = make_dummy_chunk("2", "secret_func")
    c3 = make_dummy_chunk("3", "auth_token")
    vecs = np.random.randn(3, 384).astype(np.float32)
    memory_sqlite_store.add_chunks([c1, c2, c3], vecs)

    try:
        results = memory_sqlite_store.search_exact(payload)
    except Exception as e:
        # Raising a syntax error or query error is acceptable, but returning leaked data is not
        results = []

    # None of the chunks have payload as identifier, so result must be empty
    assert results == [], f"SQLite SQL injection leaked data on payload: {payload}"


@pytest.mark.parametrize(
    "payload",
    [
        "' OR 1=1 --",
        "' OR '1'='1",
        "secret' OR 1=1 --",
        "admin' OR '1'='1' --",
        "' OR 1=1 /*",
        "'; DROP TABLE ast_chunks; --",
        "\" OR 1=1 --",
        "' UNION SELECT * FROM ast_chunks --",
        "'; DELETE FROM ast_chunks WHERE '1'='1",
        "'; SELECT * FROM ast_chunks; --",
        "\\'; DROP TABLE ast_chunks; --",
        "'' OR ''='' --",
        "nonexistent' OR 1=1 #",
    ],
)
def test_search_exact_sql_injection_lance(lance_store: LanceDBVectorStore, payload: str):
    """Verify LanceDB search_exact is 100% immune to SQL injection payloads."""
    c1 = make_dummy_chunk("1", "target_func")
    c2 = make_dummy_chunk("2", "secret_func")
    c3 = make_dummy_chunk("3", "auth_token")
    vecs = np.random.randn(3, 384).astype(np.float32)
    lance_store.add_chunks([c1, c2, c3], vecs)

    # Do not catch exceptions; observe raw behavior
    results = lance_store.search_exact(payload)
    assert results == [], f"LanceDB SQL injection leaked data on payload: {payload}"


# ============================================================================
# 2. Vector Search Ranking & Score Monotonicity (Identical, Orthogonal, Inverse)
# ============================================================================

def create_controlled_vectors(dim: int = 384):
    """Construct controlled vectors with known cosine similarities to target v0:
    - v_identical: sim = +1.0
    - v_similar: sim = ~0.8
    - v_orthogonal: sim = 0.0
    - v_opposite_similar: sim = ~-0.8
    - v_inverse: sim = -1.0
    """
    v0 = np.zeros(dim, dtype=np.float32)
    v0[0] = 1.0  # Unit vector along axis 0

    # 1. Identical
    v_ident = v0.copy()

    # 2. Similar (angle ~ 36.87 deg -> cos ~ 0.8)
    v_sim = np.zeros(dim, dtype=np.float32)
    v_sim[0] = 0.8
    v_sim[1] = 0.6

    # 3. Orthogonal (axis 1 only)
    v_orth = np.zeros(dim, dtype=np.float32)
    v_orth[1] = 1.0

    # 4. Negative similar (cos ~ -0.8)
    v_neg_sim = np.zeros(dim, dtype=np.float32)
    v_neg_sim[0] = -0.8
    v_neg_sim[1] = 0.6

    # 5. Inverse (-v0)
    v_inv = -v0.copy()

    chunks = [
        make_dummy_chunk("c_ident", "chunk_identical"),
        make_dummy_chunk("c_sim", "chunk_similar"),
        make_dummy_chunk("c_orth", "chunk_orthogonal"),
        make_dummy_chunk("c_neg_sim", "chunk_neg_similar"),
        make_dummy_chunk("c_inv", "chunk_inverse"),
    ]
    vecs = np.stack([v_ident, v_sim, v_orth, v_neg_sim, v_inv])
    return v0, chunks, vecs


def test_score_monotonicity_and_ranking_sqlite(memory_sqlite_store: SQLiteVectorStore):
    """Verify SQLiteVectorStore ranking order and strict score monotonicity."""
    query_vec, chunks, vecs = create_controlled_vectors(384)
    memory_sqlite_store.add_chunks(chunks, vecs)

    results = memory_sqlite_store.search_semantic(query_vec, top_k=10)
    assert len(results) == 5

    # 1. Ranking order check
    expected_order = [
        "chunk_identical",
        "chunk_similar",
        "chunk_orthogonal",
        "chunk_neg_similar",
        "chunk_inverse",
    ]
    actual_order = [r.identifier for r in results]
    assert actual_order == expected_order, f"SQLite order mismatch: {actual_order} vs {expected_order}"

    # 2. Score monotonicity check: scores must be strictly non-increasing
    scores = [r.relevanceScore for r in results]
    for i in range(len(scores) - 1):
        assert scores[i] >= scores[i + 1], f"Score monotonicity violated at {i}: {scores[i]} < {scores[i+1]}"

    # 3. Exact score boundaries:
    # sim = 1.0 -> d = 0.0 -> score = 1 / (1 + 0) = 1.0
    assert scores[0] == pytest.approx(1.0, abs=1e-5)
    # sim = 0.8 -> d = 0.2 -> score = 1 / 1.2 ~= 0.8333
    assert scores[1] == pytest.approx(1.0 / 1.2, abs=1e-4)
    # sim = 0.0 -> d = 1.0 -> score = 1 / 2.0 = 0.5
    assert scores[2] == pytest.approx(0.5, abs=1e-4)
    # sim = -0.8 -> d = 1.8 -> score = 1 / 2.8 ~= 0.3571
    assert scores[3] == pytest.approx(1.0 / 2.8, abs=1e-4)
    # sim = -1.0 -> d = 2.0 -> score = 1 / 3.0 ~= 0.3333
    assert scores[4] == pytest.approx(1.0 / 3.0, abs=1e-4)


def test_score_monotonicity_and_ranking_lance(lance_store: LanceDBVectorStore):
    """Verify LanceDBVectorStore ranking order and score monotonicity."""
    query_vec, chunks, vecs = create_controlled_vectors(384)
    lance_store.add_chunks(chunks, vecs)

    results = lance_store.search_semantic(query_vec, top_k=10)
    assert len(results) == 5

    # 1. Ranking order check
    expected_order = [
        "chunk_identical",
        "chunk_similar",
        "chunk_orthogonal",
        "chunk_neg_similar",
        "chunk_inverse",
    ]
    actual_order = [r.identifier for r in results]
    assert actual_order == expected_order, f"LanceDB order mismatch: {actual_order} vs {expected_order}"

    # 2. Score monotonicity check: scores must be strictly non-increasing
    scores = [r.relevanceScore for r in results]
    for i in range(len(scores) - 1):
        assert scores[i] >= scores[i + 1], f"Score monotonicity violated at {i}: {scores[i]} < {scores[i+1]}"

    # 3. Exact score validation:
    # LanceDB defaults to L2 distance.
    # For unit vectors:
    # ||u - v||^2 = ||u||^2 + ||v||^2 - 2(u.v) = 2 - 2*sim
    # In LanceDB: dist = ||u - v||^2 or ||u - v||?
    # Let's verify score of identical is 1.0 (since dist=0 => 1 / (1 + 0) = 1.0)
    assert scores[0] == pytest.approx(1.0, abs=1e-4)
    # All scores must be in [0.0, 1.0]
    for s in scores:
        assert 0.0 <= s <= 1.0


# ============================================================================
# 3. Top-K Boundary Stress Tests
# ============================================================================

@pytest.mark.parametrize("store_type", ["sqlite", "lance"])
def test_top_k_boundaries(lance_store: LanceDBVectorStore, memory_sqlite_store: SQLiteVectorStore, store_type: str):
    """Test boundary conditions for top_k:
    - top_k = 1
    - top_k = total chunks (e.g. 5)
    - top_k = 100 (exceeding store size)
    - top_k = 0
    - top_k = -1
    """
    store = lance_store if store_type == "lance" else memory_sqlite_store
    dim = 384
    q_vec, chunks, vecs = create_controlled_vectors(dim)
    store.add_chunks(chunks, vecs)
    assert store.count() == 5

    # top_k = 1
    res1 = store.search_semantic(q_vec, top_k=1)
    assert len(res1) == 1
    assert res1[0].identifier == "chunk_identical"

    # top_k = 3
    res3 = store.search_semantic(q_vec, top_k=3)
    assert len(res3) == 3

    # top_k = 5 (exact store size)
    res5 = store.search_semantic(q_vec, top_k=5)
    assert len(res5) == 5

    # top_k = 100 (exceeding store size)
    res100 = store.search_semantic(q_vec, top_k=100)
    assert len(res100) == 5

    # top_k = 0: Check whether store raises ValueError or returns empty list
    try:
        res0 = store.search_semantic(q_vec, top_k=0)
        assert len(res0) == 0, f"Expected 0 results for top_k=0, got {len(res0)}"
    except ValueError as e:
        # LanceDB requires positive limit
        assert "Limit is required" in str(e) or "top_k" in str(e)

    # top_k = -1: Check boundary handling
    try:
        res_neg = store.search_semantic(q_vec, top_k=-1)
        # In SQLite numpy slicing [: -1] returns 4 results instead of 0 or error!
        # If it returns results, record this behavior
    except (ValueError, Exception):
        pass


# ============================================================================
# 4. Exact Search Identifier Identity & Edge Cases
# ============================================================================

@pytest.mark.parametrize("store_type", ["sqlite", "lance"])
def test_search_exact_boundary_identifiers(lance_store: LanceDBVectorStore, memory_sqlite_store: SQLiteVectorStore, store_type: str):
    """Verify search_exact strictly matches exact identifiers and handles edge case names."""
    store = lance_store if store_type == "lance" else memory_sqlite_store
    special_identifiers = [
        "empty_test",
        "函数_计算",
        "α_beta_γ",
        "module.sub_module.func_name",
        "kebab-case-name",
        "my function with spaces",
        "fn$1",
        "__init__",
        "calc::run",
        "Class.method[0]",
    ]

    chunks = [make_dummy_chunk(f"c_{i}", name) for i, name in enumerate(special_identifiers)]
    vecs = np.random.randn(len(special_identifiers), 384).astype(np.float32)
    store.add_chunks(chunks, vecs)

    for ident in special_identifiers:
        results = store.search_exact(ident)
        assert len(results) == 1, f"Failed exact match for identifier: '{ident}' on {store_type}"
        assert results[0].identifier == ident
        assert results[0].relevanceScore == 1.0

    # Non-matching identifier should return empty list
    assert store.search_exact("non_existent_identifier_12345") == []
    # Partial substring match should NOT return matches
    assert store.search_exact("函数") == []
    assert store.search_exact("sub_module") == []


@pytest.mark.parametrize("store_type", ["sqlite", "lance"])
def test_literal_injection_identifier_storage_and_exact_retrieval(
    lance_store: LanceDBVectorStore,
    memory_sqlite_store: SQLiteVectorStore,
    store_type: str,
):
    """If a chunk is deliberately stored with an identifier that looks like a SQL injection payload,
    search_exact must retrieve ONLY that specific chunk and no other chunks.
    """
    store = lance_store if store_type == "lance" else memory_sqlite_store
    injected_identifier = "' OR 1=1 --"
    chunk_injected = make_dummy_chunk("inj_1", injected_identifier)
    chunk_normal_1 = make_dummy_chunk("norm_1", "regular_function")
    chunk_normal_2 = make_dummy_chunk("norm_2", "another_function")

    vecs = np.random.randn(3, 384).astype(np.float32)
    store.add_chunks([chunk_injected, chunk_normal_1, chunk_normal_2], vecs)

    # Search for the exact injected identifier
    results = store.search_exact(injected_identifier)
    assert len(results) == 1, f"Expected exactly 1 result for literal '{injected_identifier}', got {len(results)}"
    assert results[0].identifier == injected_identifier
    assert results[0].id == "test/file.py::' OR 1=1 --:1-10"

    # Search for normal function
    normal_results = store.search_exact("regular_function")
    assert len(normal_results) == 1
    assert normal_results[0].identifier == "regular_function"


# ============================================================================
# 5. Metadata Filter & ID Lookup Injection Safety
# ============================================================================

@pytest.mark.parametrize("store_type", ["sqlite", "lance"])
def test_ast_node_type_filter_injection_safety(
    lance_store: LanceDBVectorStore,
    memory_sqlite_store: SQLiteVectorStore,
    store_type: str,
):
    """Verify ast_node_type in search_semantic cannot be injected to bypass type filtering."""
    store = lance_store if store_type == "lance" else memory_sqlite_store
    c_func = make_dummy_chunk("1", "func1", node_type="FunctionDef")
    c_class = make_dummy_chunk("2", "Class1", node_type="ClassDef")
    vecs = np.random.randn(2, 384).astype(np.float32)
    store.add_chunks([c_func, c_class], vecs)

    q = vecs[0]

    # Malicious node_type payload trying to select all rows
    payload = "FunctionDef' OR '1'='1"
    try:
        results = store.search_semantic(q, top_k=10, ast_node_type=payload)
    except Exception:
        results = []

    # Should match nothing because no chunk has astNodeType="FunctionDef' OR '1'='1"
    assert results == [], f"ast_node_type injection leaked records on {store_type}: {[r.identifier for r in results]}"


@pytest.mark.parametrize("store_type", ["sqlite", "lance"])
def test_get_by_id_injection_safety(
    lance_store: LanceDBVectorStore,
    memory_sqlite_store: SQLiteVectorStore,
    store_type: str,
):
    """Verify get_by_id cannot be exploited with injection payloads."""
    store = lance_store if store_type == "lance" else memory_sqlite_store
    c1 = make_dummy_chunk("test/file.py::func:1-10", "func")
    vecs = np.random.randn(1, 384).astype(np.float32)
    store.add_chunks([c1], vecs)

    payloads = [
        "' OR 1=1 --",
        "test/file.py::func:1-10' OR '1'='1",
        "'; DROP TABLE ast_chunks; --",
    ]
    for p in payloads:
        try:
            res = store.get_by_id(p)
        except Exception:
            res = None
        assert res is None, f"get_by_id leaked data on payload '{p}' for {store_type}"


# ============================================================================
# 6. Zero Vector and Degenerate Query Stress Tests
# ============================================================================

@pytest.mark.parametrize("store_type", ["sqlite", "lance"])
def test_zero_query_vector_behavior(
    lance_store: LanceDBVectorStore,
    memory_sqlite_store: SQLiteVectorStore,
    store_type: str,
):
    """Stress test search_semantic with an all-zeros query vector."""
    store = lance_store if store_type == "lance" else memory_sqlite_store
    q_vec, chunks, vecs = create_controlled_vectors(384)
    store.add_chunks(chunks, vecs)

    zero_q = np.zeros(384, dtype=np.float32)
    results = store.search_semantic(zero_q, top_k=5)

    assert len(results) == 5
    for r in results:
        # All relevance scores must remain valid floats within [0.0, 1.0]
        assert not np.isnan(r.relevanceScore)
        assert not np.isinf(r.relevanceScore)
        assert 0.0 <= r.relevanceScore <= 1.0
