"""Repository registry management for tracking indexed codebases."""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from app.schemas.ast_chunk import RepositoryItem

logger = logging.getLogger(__name__)

DEFAULT_REGISTRY_PATH = Path("data/repos_registry.json")

SEED_REPOSITORIES = [
    {
        "id": "requests",
        "name": "psf/requests",
        "path": "fixtures/requests",
        "chunks_count": 284,
        "files_count": 17,
        "status": "indexed",
        "description": "Python HTTP for Humans (284 AST nodes, Session, models, adapters)",
    },
    {
        "id": "sample_codebase",
        "name": "sample_codebase",
        "path": "backend/sample_codebase",
        "chunks_count": 14,
        "files_count": 3,
        "status": "indexed",
        "description": "FastAPI service sample with math functions, classes, and decorators",
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
            return [RepositoryItem(**item) for item in data]
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
                target_item = RepositoryItem(
                    id=r.id,
                    name=r.name,
                    path=norm_path,
                    chunks_count=chunks_count,
                    files_count=files_count,
                    status="indexed",
                    description=description or r.description or f"Indexed codebase ({chunks_count} AST chunks)",
                    last_indexed=now,
                )
                updated_repos.append(target_item)
            else:
                updated_repos.append(r)

        if not found:
            target_item = RepositoryItem(
                id=repo_id,
                name=repo_name,
                path=norm_path,
                chunks_count=chunks_count,
                files_count=files_count,
                status="indexed",
                description=description or f"Indexed codebase ({chunks_count} AST chunks)",
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


repo_registry = RepoRegistry()
