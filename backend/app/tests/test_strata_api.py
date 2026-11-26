"""Comprehensive unit and integration tests for 3D Layered Strata Graph API and Tier Classification."""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.config import Settings
from app.models.chunk import AstCodeChunk
from app.services.repo_registry import RepoRegistry
from app.services.strata import (
    TIER_DEFINITIONS,
    build_strata_graph,
    classify_chunk_tier,
)


@pytest.fixture
def strata_test_client(tmp_path: Path) -> TestClient:
    """Fixture providing a TestClient with an isolated database and registry."""
    db_file = tmp_path / "strata_test.db"
    registry_file = tmp_path / "repos_registry.json"

    settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=str(db_file),
        use_mock_embedder=True,
    )

    app = create_app(settings=settings)
    from app.api.v1.endpoints import repos
    repos.repo_registry = RepoRegistry(registry_file=registry_file)

    with TestClient(app) as client:
        yield client


class TestStrataApiEndpoints:
    """Tests for GET /api/v1/repos/{repo_id}/strata-graph endpoint."""

    def test_strata_endpoint_sample_codebase_success(self, strata_test_client: TestClient):
        """Verify endpoint returns complete 3D strata graph for sample_codebase."""
        resp = strata_test_client.get("/api/v1/repos/sample_codebase/strata-graph")
        assert resp.status_code == 200
        data = resp.json()

        assert data["repo_id"] == "sample_codebase"
        assert "nodes" in data
        assert "edges" in data
        assert "tiers" in data
        assert data["total_nodes"] == len(data["nodes"])
        assert data["total_edges"] == len(data["edges"])
        assert data["total_nodes"] > 0
        assert data["total_edges"] > 0

        # Validate nodes schema and tier constraints
        node_ids = set()
        for node in data["nodes"]:
            assert "id" in node
            assert "identifier" in node
            assert "filePath" in node
            assert "astNodeType" in node
            assert "tier" in node
            assert "startLine" in node
            assert "endLine" in node
            assert node["tier"] in (0, 1, 2, 3)
            assert node["startLine"] >= 1
            assert node["endLine"] >= node["startLine"]
            node_ids.add(node["id"])

        # Validate edges schema and reference integrity
        for edge in data["edges"]:
            assert "id" in edge
            assert "source" in edge
            assert "target" in edge
            assert "callName" in edge
            assert edge["source"] in node_ids
            assert edge["target"] in node_ids
            assert edge["source"] != edge["target"]

        # Validate tiers metadata
        assert len(data["tiers"]) == 4
        tier_indices = [t["tier"] for t in data["tiers"]]
        assert tier_indices == [0, 1, 2, 3]

        tier_sum = sum(t["nodeCount"] for t in data["tiers"])
        assert tier_sum == data["total_nodes"]

    def test_strata_endpoint_requests_success(self, strata_test_client: TestClient):
        """Verify endpoint returns complete 3D strata graph with all 4 tiers for requests."""
        resp = strata_test_client.get("/api/v1/repos/requests/strata-graph")
        assert resp.status_code == 200
        data = resp.json()

        assert data["repo_id"] == "requests"
        assert data["total_nodes"] >= 200
        assert data["total_edges"] >= 100

        # Verify all 4 tiers are populated in requests
        tiers_present = {node["tier"] for node in data["nodes"]}
        assert {0, 1, 2, 3}.issubset(tiers_present)

    def test_strata_endpoint_camel_case_compatibility(self, strata_test_client: TestClient):
        """Verify frontend-compatible camelCase aliases are returned alongside snake_case."""
        resp = strata_test_client.get("/api/v1/repos/sample_codebase/strata-graph")
        assert resp.status_code == 200
        data = resp.json()

        assert data["repoId"] == data["repo_id"]
        assert data["totalNodes"] == data["total_nodes"]
        assert data["totalEdges"] == data["total_edges"]
        for tier in data["tiers"]:
            assert tier["nodeCount"] == tier["node_count"]

    def test_strata_endpoint_nonexistent_repo_returns_404(self, strata_test_client: TestClient):
        """Verify endpoint returns 404 for unknown repository."""
        resp = strata_test_client.get("/api/v1/repos/nonexistent_repo/strata-graph")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


class TestTierClassification:
    """Unit tests for classify_chunk_tier logic across all 4 architectural tiers."""

    def test_tier_0_foundation_primitives(self):
        """Verify models, schemas, config, and assign chunks classify to Tier 0."""
        c1 = AstCodeChunk(
            id="models/user.py:User:1",
            filePath="models/user.py",
            fileName="user.py",
            astNodeType="ClassDef",
            identifier="User",
            startLine=1,
            endLine=20,
            code="class User:\n    pass",
        )
        assert classify_chunk_tier(c1) == 0

        c2 = AstCodeChunk(
            id="config.py:Settings:1",
            filePath="config.py",
            fileName="config.py",
            astNodeType="ClassDef",
            identifier="Settings",
            startLine=1,
            endLine=10,
            code="class Settings:\n    pass",
        )
        assert classify_chunk_tier(c2) == 0

        c3 = AstCodeChunk(
            id="constants.py:MAX_RETRY:1",
            filePath="constants.py",
            fileName="constants.py",
            astNodeType="Assign",
            identifier="MAX_RETRY",
            startLine=1,
            endLine=1,
            code="MAX_RETRY = 5",
        )
        assert classify_chunk_tier(c3) == 0

        c4 = AstCodeChunk(
            id="sample.py:BaseEntity:1",
            filePath="sample.py",
            fileName="sample.py",
            astNodeType="ClassDef",
            identifier="BaseEntity",
            startLine=1,
            endLine=15,
            code="class BaseEntity:\n    pass",
        )
        assert classify_chunk_tier(c4) == 0

    def test_tier_1_adapters_transport(self):
        """Verify adapters, transport, services, vector stores classify to Tier 1."""
        c1 = AstCodeChunk(
            id="adapters.py:HTTPAdapter:1",
            filePath="adapters.py",
            fileName="adapters.py",
            astNodeType="ClassDef",
            identifier="HTTPAdapter",
            startLine=1,
            endLine=50,
            code="class HTTPAdapter:\n    pass",
        )
        assert classify_chunk_tier(c1) == 1

        c2 = AstCodeChunk(
            id="vector_store/lance.py:LanceDBStore:1",
            filePath="vector_store/lance.py",
            fileName="lance.py",
            astNodeType="ClassDef",
            identifier="LanceDBStore",
            startLine=1,
            endLine=40,
            code="class LanceDBStore:\n    pass",
        )
        assert classify_chunk_tier(c2) == 1

        c3 = AstCodeChunk(
            id="services/retrieval.py:RetrievalService:1",
            filePath="services/retrieval.py",
            fileName="retrieval.py",
            astNodeType="ClassDef",
            identifier="RetrievalService",
            startLine=1,
            endLine=30,
            code="class RetrievalService:\n    pass",
        )
        assert classify_chunk_tier(c3) == 1

        c4 = AstCodeChunk(
            id="network.py:fetch_remote_resource:1",
            filePath="network.py",
            fileName="network.py",
            astNodeType="AsyncFunctionDef",
            identifier="fetch_remote_resource",
            startLine=1,
            endLine=20,
            code="async def fetch_remote_resource():\n    pass",
        )
        assert classify_chunk_tier(c4) == 1

    def test_tier_2_core_logic(self):
        """Verify parser, processing, algorithms, calculator classify to Tier 2."""
        c1 = AstCodeChunk(
            id="parser/extractor.py:PythonAstExtractor:1",
            filePath="parser/extractor.py",
            fileName="extractor.py",
            astNodeType="ClassDef",
            identifier="PythonAstExtractor",
            startLine=1,
            endLine=60,
            code="class PythonAstExtractor:\n    pass",
        )
        assert classify_chunk_tier(c1) == 2

        c2 = AstCodeChunk(
            id="calc.py:calculate_statistics:1",
            filePath="calc.py",
            fileName="calc.py",
            astNodeType="FunctionDef",
            identifier="calculate_statistics",
            startLine=1,
            endLine=25,
            code="def calculate_statistics():\n    pass",
        )
        assert classify_chunk_tier(c2) == 2

        c3 = AstCodeChunk(
            id="sessions.py:Session:1",
            filePath="sessions.py",
            fileName="sessions.py",
            astNodeType="ClassDef",
            identifier="Session",
            startLine=1,
            endLine=100,
            code="class Session:\n    pass",
        )
        assert classify_chunk_tier(c3) == 2

    def test_tier_3_entrypoints(self):
        """Verify api, endpoints, routes, cli, main classify to Tier 3."""
        c1 = AstCodeChunk(
            id="api/v1/endpoints/search.py:search_chunks:1",
            filePath="api/v1/endpoints/search.py",
            fileName="search.py",
            astNodeType="FunctionDef",
            identifier="search_chunks",
            startLine=1,
            endLine=20,
            code="def search_chunks():\n    pass",
        )
        assert classify_chunk_tier(c1) == 3

        c2 = AstCodeChunk(
            id="main.py:create_app:1",
            filePath="main.py",
            fileName="main.py",
            astNodeType="FunctionDef",
            identifier="create_app",
            startLine=1,
            endLine=30,
            code="def create_app():\n    pass",
        )
        assert classify_chunk_tier(c2) == 3

        c3 = AstCodeChunk(
            id="cli.py:cli_runner:1",
            filePath="cli.py",
            fileName="cli.py",
            astNodeType="FunctionDef",
            identifier="cli_runner",
            startLine=1,
            endLine=15,
            code="def cli_runner():\n    pass",
        )
        assert classify_chunk_tier(c3) == 3


class TestStrataGraphBuilder:
    """Unit tests for build_strata_graph and edge creation."""

    def test_call_matching_and_edge_creation(self):
        """Verify edges link caller AST chunks to callee AST chunks based on calls."""
        c_caller = AstCodeChunk(
            id="service.py:ProcessStream:1",
            filePath="service.py",
            fileName="service.py",
            astNodeType="FunctionDef",
            identifier="process_stream",
            startLine=1,
            endLine=20,
            code="def process_stream():\n    transform_batch()\n    calc_total()",
            calls=["transform_batch", "calc_total", "external_lib_func"],
        )
        c_target1 = AstCodeChunk(
            id="service.py:TransformBatch:25",
            filePath="service.py",
            fileName="service.py",
            astNodeType="FunctionDef",
            identifier="transform_batch",
            startLine=25,
            endLine=40,
            code="def transform_batch():\n    pass",
            calls=[],
        )
        c_target2 = AstCodeChunk(
            id="calc.py:CalcTotal:10",
            filePath="calc.py",
            fileName="calc.py",
            astNodeType="FunctionDef",
            identifier="calc_total",
            startLine=10,
            endLine=20,
            code="def calc_total():\n    pass",
            calls=[],
        )

        graph = build_strata_graph([c_caller, c_target1, c_target2], repo_id="test_repo")

        assert graph.total_nodes == 3
        assert graph.total_edges == 2

        edge_targets = {e.target for e in graph.edges}
        assert c_target1.id in edge_targets
        assert c_target2.id in edge_targets

        # external_lib_func should not create edge because no chunk matches it
        call_names = {e.callName for e in graph.edges}
        assert "transform_batch" in call_names
        assert "calc_total" in call_names
        assert "external_lib_func" not in call_names

    def test_self_loops_are_excluded(self):
        """Verify recursive functions calling themselves do not produce self-edges."""
        c_recursive = AstCodeChunk(
            id="recursion.py:factorial:1",
            filePath="recursion.py",
            fileName="recursion.py",
            astNodeType="FunctionDef",
            identifier="factorial",
            startLine=1,
            endLine=10,
            code="def factorial(n):\n    return factorial(n-1)",
            calls=["factorial"],
        )

        graph = build_strata_graph([c_recursive], repo_id="recursion_repo")
        assert graph.total_nodes == 1
        assert graph.total_edges == 0

    def test_duplicate_calls_are_deduplicated(self):
        """Verify repeated calls in the same function produce a single unique edge."""
        c_caller = AstCodeChunk(
            id="caller.py:run:1",
            filePath="caller.py",
            fileName="caller.py",
            astNodeType="FunctionDef",
            identifier="run",
            startLine=1,
            endLine=15,
            code="def run():\n    step()\n    step()\n    step()",
            calls=["step", "step", "step"],
        )
        c_target = AstCodeChunk(
            id="caller.py:step:20",
            filePath="caller.py",
            fileName="caller.py",
            astNodeType="FunctionDef",
            identifier="step",
            startLine=20,
            endLine=30,
            code="def step():\n    pass",
            calls=[],
        )

        graph = build_strata_graph([c_caller, c_target], repo_id="dedup_repo")
        assert graph.total_nodes == 2
        assert graph.total_edges == 1
        assert graph.edges[0].callName == "step"

    def test_qualified_method_call_resolution(self):
        """Verify calls using self.method resolve to Class.method callee."""
        c_caller = AstCodeChunk(
            id="engine.py:Engine.run:1",
            filePath="engine.py",
            fileName="engine.py",
            astNodeType="FunctionDef",
            identifier="Engine.run",
            startLine=1,
            endLine=10,
            code="def run(self):\n    self.compute()",
            calls=["self.compute"],
        )
        c_target = AstCodeChunk(
            id="engine.py:Engine.compute:12",
            filePath="engine.py",
            fileName="engine.py",
            astNodeType="FunctionDef",
            identifier="Engine.compute",
            startLine=12,
            endLine=20,
            code="def compute(self):\n    pass",
            calls=[],
        )

        graph = build_strata_graph([c_caller, c_target], repo_id="engine_repo")
        assert graph.total_nodes == 2
        assert graph.total_edges == 1
        assert graph.edges[0].source == c_caller.id
        assert graph.edges[0].target == c_target.id
        assert graph.edges[0].callName == "self.compute"

    def test_empty_chunks_graph_builder(self):
        """Verify building strata graph with empty chunks returns 0 nodes/edges and valid tier metadata."""
        graph = build_strata_graph([], repo_id="empty_repo")
        assert graph.total_nodes == 0
        assert graph.total_edges == 0
        assert len(graph.tiers) == 4
        for t in graph.tiers:
            assert t.node_count == 0

    def test_tier_definitions_integrity(self):
        """Verify standard tier metadata definitions conform to design tokens and reserve lime for citations."""
        assert len(TIER_DEFINITIONS) == 4
        for i, t in enumerate(TIER_DEFINITIONS):
            assert t["tier"] == i
            assert "name" in t
            assert "description" in t
            assert "color" in t
            assert t["color"].startswith("#")
            # Electric acid lime (#68f12b) must be reserved exclusively for AI citation highlights
            assert t["color"].lower() != "#68f12b"

    def test_ambiguous_container_calls_do_not_create_cross_file_spiderweb(self):
        """Generic calls like dict.get() or resp.close() must not link unrelated classes across files."""
        c_caller = AstCodeChunk(
            id="utils.py:parse_headers:1",
            filePath="utils.py",
            fileName="utils.py",
            astNodeType="FunctionDef",
            identifier="parse_headers",
            startLine=1,
            endLine=10,
            code="def parse_headers(d): return d.get('host')",
            calls=["d.get", "resp.close"],
        )
        c_other_get = AstCodeChunk(
            id="api.py:get:1",
            filePath="api.py",
            fileName="api.py",
            astNodeType="FunctionDef",
            identifier="get",
            startLine=1,
            endLine=10,
            code="def get(url): pass",
            calls=[],
        )
        c_other_close = AstCodeChunk(
            id="sessions.py:Session.close:1",
            filePath="sessions.py",
            fileName="sessions.py",
            astNodeType="FunctionDef",
            identifier="Session.close",
            startLine=1,
            endLine=10,
            code="def close(self): pass",
            calls=[],
        )

        graph = build_strata_graph([c_caller, c_other_get, c_other_close], repo_id="test_repo")
        assert graph.total_edges == 0

    def test_class_method_tier_cohesion_prevents_splitting_class_across_tiers(self):
        """Methods belonging to a ClassDef in the same file inherit the owning class's tier."""
        c_class = AstCodeChunk(
            id="sessions.py:Session:10",
            filePath="sessions.py",
            fileName="sessions.py",
            astNodeType="ClassDef",
            identifier="Session",
            startLine=10,
            endLine=100,
            code="class Session:\n    pass",
            calls=[],
        )
        # 'send' normally triggers Tier 1 keyword matching, but belongs to Session (Tier 2)
        c_method = AstCodeChunk(
            id="sessions.py:Session.send:40",
            filePath="sessions.py",
            fileName="sessions.py",
            astNodeType="FunctionDef",
            identifier="Session.send",
            startLine=40,
            endLine=75,
            code="def send(self, request):\n    pass",
            calls=[],
        )

        graph = build_strata_graph([c_class, c_method], repo_id="cohesion_repo")
        tiers_by_id = {n.id: n.tier for n in graph.nodes}
        assert tiers_by_id[c_class.id] == 2
        assert tiers_by_id[c_method.id] == 2

    def test_topology_refines_unanchored_fallback_sinks_and_roots(self):
        """Unanchored fallback nodes refine via fan-in/fan-out topology when path signals are neutral."""
        c_entry = AstCodeChunk(
            id="alpha.py:orchestrate:1",
            filePath="alpha.py",
            fileName="alpha.py",
            astNodeType="FunctionDef",
            identifier="orchestrate",
            startLine=1,
            endLine=15,
            code="def orchestrate():\n    leaf_a()\n    leaf_b()",
            calls=["leaf_a", "leaf_b"],
        )
        c_leaf_a = AstCodeChunk(
            id="beta.py:leaf_a:1",
            filePath="beta.py",
            fileName="beta.py",
            astNodeType="FunctionDef",
            identifier="leaf_a",
            startLine=1,
            endLine=5,
            code="def leaf_a():\n    pass",
            calls=[],
        )
        c_leaf_b = AstCodeChunk(
            id="gamma.py:leaf_b:1",
            filePath="gamma.py",
            fileName="gamma.py",
            astNodeType="FunctionDef",
            identifier="leaf_b",
            startLine=1,
            endLine=5,
            code="def leaf_b():\n    pass",
            calls=[],
        )

        graph = build_strata_graph([c_entry, c_leaf_a, c_leaf_b], repo_id="topo_repo")
        tiers_by_id = {n.id: n.tier for n in graph.nodes}
        assert tiers_by_id[c_entry.id] == 3
        assert tiers_by_id[c_leaf_a.id] == 0
        assert tiers_by_id[c_leaf_b.id] == 0
