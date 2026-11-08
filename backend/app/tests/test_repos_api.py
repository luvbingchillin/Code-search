"""Unit tests for Repository Registry and Repositories API endpoints."""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.config import Settings
from app.services.repo_registry import RepoRegistry


@pytest.fixture
def repo_test_client(tmp_path: Path) -> TestClient:
    db_file = tmp_path / "test.db"
    registry_file = tmp_path / "repos_registry.json"

    settings = Settings(
        vector_db_type="sqlite",
        sqlite_db_path=str(db_file),
        use_mock_embedder=True,
    )

    app = create_app(settings=settings)
    # Override registry path for test isolation
    from app.api.v1.endpoints import repos
    repos.repo_registry = RepoRegistry(registry_file=registry_file)

    with TestClient(app) as client:
        yield client


def test_list_repositories_returns_seed_repos(repo_test_client: TestClient):
    """Verify GET /api/v1/repos lists seed repositories."""
    resp = repo_test_client.get("/api/v1/repos")
    assert resp.status_code == 200
    data = resp.json()
    assert "repositories" in data
    assert data["total"] >= 2
    repo_ids = [r["id"] for r in data["repositories"]]
    assert "requests" in repo_ids
    assert "sample_codebase" in repo_ids


def test_get_repository_by_id(repo_test_client: TestClient):
    """Verify GET /api/v1/repos/{repo_id} retrieves specific repo or 404."""
    resp = repo_test_client.get("/api/v1/repos/requests")
    assert resp.status_code == 200
    repo = resp.json()
    assert repo["id"] == "requests"
    assert "psf/requests" in repo["name"]

    not_found = repo_test_client.get("/api/v1/repos/nonexistent_repo_id")
    assert not_found.status_code == 404


def test_get_repository_tree(repo_test_client: TestClient):
    """Verify GET /api/v1/repos/{repo_id}/tree returns hierarchical file tree."""
    resp = repo_test_client.get("/api/v1/repos/requests/tree")
    assert resp.status_code == 200
    data = resp.json()
    assert data["repo_id"] == "requests"
    assert "total_files" in data
    assert "total_symbols" in data
    assert "tree" in data
    assert isinstance(data["tree"], list)

    not_found = repo_test_client.get("/api/v1/repos/nonexistent_repo/tree")
    assert not_found.status_code == 404
