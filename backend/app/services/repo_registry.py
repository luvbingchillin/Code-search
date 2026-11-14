"""Repository registry management for tracking indexed codebases."""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from app.schemas.ast_chunk import RepositoryItem, RepositoryManifestResponse

logger = logging.getLogger(__name__)

DEFAULT_REGISTRY_PATH = Path("data/repos_registry.json")

REQUESTS_MANIFEST = (
    "psf/requests is a human-friendly HTTP client library for Python.\n"
    "Core Components:\n"
    "- Session: Maintains cookies, connection pooling, and configuration across requests.\n"
    "- Request & PreparedRequest: Represents outgoing HTTP requests before and after URL/header preparation.\n"
    "- Response: Encapsulates server response data, status codes, encoding detection, and JSON parsing.\n"
    "- HTTPAdapter: Transport adapter connecting Sessions to urllib3 socket pools.\n"
    "Pipeline: Session.request() builds Request -> prepares PreparedRequest -> dispatches via HTTPAdapter.send() -> returns Response."
)

SAMPLE_CODEBASE_MANIFEST = (
    "sample_codebase is a demonstration service showcasing FastAPI routes, mathematical operations, and utility classes.\n"
    "Core Components:\n"
    "- Calculator: Core calculation class supporting arithmetic operations, memory storage, and error handling.\n"
    "- FastAPI Routes: API endpoints exposing calculation services and health checks.\n"
    "- Utility Functions: Helper validation and formatting routines.\n"
    "Pipeline: Client request -> FastAPI route validation -> Calculator business logic execution -> JSON response."
)

SEED_MANIFESTS = {
    "requests": REQUESTS_MANIFEST,
    "sample_codebase": SAMPLE_CODEBASE_MANIFEST,
}

SEED_REPOSITORIES = [
    {
        "id": "requests",
        "name": "psf/requests",
        "path": "fixtures/requests",
        "chunks_count": 284,
        "files_count": 17,
        "status": "indexed",
        "description": "Python HTTP for Humans (284 AST nodes, Session, models, adapters)",
        "manifest": REQUESTS_MANIFEST,
    },
    {
        "id": "sample_codebase",
        "name": "sample_codebase",
        "path": "backend/sample_codebase",
        "chunks_count": 14,
        "files_count": 3,
        "status": "indexed",
        "description": "FastAPI service sample with math functions, classes, and decorators",
        "manifest": SAMPLE_CODEBASE_MANIFEST,
    },
]


class RepoRegistry:
    """Manages the persistence and querying of indexed repositories."""

    def __init__(self, registry_file: Optional[Path] = None):
        self.registry_file = registry_file or DEFAULT_REGISTRY_PATH

    def _ensure_registry_file(self) -> None:
        """Create the registry file with default seed repos if it does not exist."""
        if not self.registry_file.exists():
            self.registry_file.parent.mkdir(parents=True, exist_ok=True)
            now = datetime.now(timezone.utc).isoformat()
            seeded = [
                {**repo, "last_indexed": now}
                for repo in SEED_REPOSITORIES
            ]
            try:
                with open(self.registry_file, "w", encoding="utf-8") as f:
                    json.dump(seeded, f, indent=2)
            except Exception as e:
                logger.warning(f"Failed to create repo registry file: {e}")

    def list_repositories(self) -> List[RepositoryItem]:
        """Return all tracked repositories from disk."""
        self._ensure_registry_file()
        try:
            with open(self.registry_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            results = []
            for item in data:
                if not item.get("manifest") and item.get("id") in SEED_MANIFESTS:
                    item["manifest"] = SEED_MANIFESTS[item["id"]]
                results.append(RepositoryItem(**item))
            return results
        except Exception as e:
            logger.error(f"Error reading repository registry: {e}")
            return [RepositoryItem(**item) for item in SEED_REPOSITORIES]

    def get_repository(self, repo_id: str) -> Optional[RepositoryItem]:
        """Find a repository by its unique id or path."""
        repos = self.list_repositories()
        clean_id = repo_id.strip().lower()
        for r in repos:
            if r.id.lower() == clean_id or r.name.lower() == clean_id or r.path.lower() == clean_id:
                return r
        return None

    def record_indexed_repository(
        self,
        source_dir: str,
        files_count: int,
        chunks_count: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> RepositoryItem:
        """Add or update an indexed repository entry in the registry."""
        self._ensure_registry_file()
        norm_path = source_dir.replace("\\", "/").strip().rstrip("/")
        repo_name = name or Path(norm_path).name or "codebase"
        repo_id = Path(norm_path).name.lower().replace(" ", "-") or "repo"

        now = datetime.now(timezone.utc).isoformat()
        repos = self.list_repositories()

        # Check if already exists by path or id
        found = False
        updated_repos = []
        target_item: Optional[RepositoryItem] = None

        for r in repos:
            if r.path.replace("\\", "/").rstrip("/").lower() == norm_path.lower() or r.id == repo_id:
                found = True
                manifest_val = r.manifest or SEED_MANIFESTS.get(r.id) or description
                target_item = RepositoryItem(
                    id=r.id,
                    name=r.name,
                    path=norm_path,
                    chunks_count=chunks_count,
                    files_count=files_count,
                    status="indexed",
                    description=description or r.description or f"Indexed codebase ({chunks_count} AST chunks)",
                    manifest=manifest_val,
                    last_indexed=now,
                )
                updated_repos.append(target_item)
            else:
                updated_repos.append(r)

        if not found:
            manifest_val = SEED_MANIFESTS.get(repo_id) or description or f"{repo_name} codebase with {files_count} Python files and {chunks_count} indexed AST symbols."
            target_item = RepositoryItem(
                id=repo_id,
                name=repo_name,
                path=norm_path,
                chunks_count=chunks_count,
                files_count=files_count,
                status="indexed",
                description=description or f"Indexed codebase ({chunks_count} AST chunks)",
                manifest=manifest_val,
                last_indexed=now,
            )
            updated_repos.append(target_item)

        try:
            with open(self.registry_file, "w", encoding="utf-8") as f:
                json.dump([item.model_dump() for item in updated_repos], f, indent=2)
        except Exception as e:
            logger.error(f"Error persisting repository registry: {e}")

        return target_item or RepositoryItem(
            id=repo_id,
            name=repo_name,
            path=norm_path,
            chunks_count=chunks_count,
            files_count=files_count,
            status="indexed",
            last_indexed=now,
        )

    def get_repository_manifest(self, repo_id: str) -> Optional[RepositoryManifestResponse]:
        """Retrieve architectural manifest and core symbols for instant overview synthesis."""
        repo = self.get_repository(repo_id)
        if not repo:
            return None

        manifest_text = (
            repo.manifest
            or SEED_MANIFESTS.get(repo.id)
            or repo.description
            or f"{repo.name} codebase with {repo.chunks_count} AST symbols."
        )

        components = []
        if repo.id == "requests":
            components = ["Session", "Request", "PreparedRequest", "Response", "HTTPAdapter"]
        elif repo.id == "sample_codebase":
            components = ["Calculator", "FastAPI Routes", "Utility Functions"]
        else:
            for line in manifest_text.splitlines():
                line_str = line.strip()
                if line_str.startswith("- "):
                    comp = line_str[2:].split(":")[0].strip()
                    if comp:
                        components.append(comp)

        return RepositoryManifestResponse(
            repo_id=repo.id,
            repo_name=repo.name,
            manifest=manifest_text,
            core_components=components,
        )


repo_registry = RepoRegistry()
