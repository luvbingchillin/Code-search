"""Codebase scanner for recursively discovering and parsing Python files into AST chunks."""

import fnmatch
import logging
import os
from pathlib import Path
from typing import List, Optional, Set

from app.models.chunk import AstCodeChunk
from app.parser.extractor import PythonAstExtractor

logger = logging.getLogger(__name__)

DEFAULT_EXCLUDE_PATTERNS = [
    ".*",
    "__pycache__",
    "venv",
    ".venv",
    "env",
    ".env",
    "node_modules",
    "build",
    "dist",
    ".git",
    ".pytest_cache",
    ".agents",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    "*.egg-info",
]


class CodebaseScanner:
    """Recursively scans a filesystem directory and parses all Python files into AST code chunks."""

    def __init__(
        self,
        extractor: Optional[PythonAstExtractor] = None,
        exclude_patterns: Optional[List[str]] = None,
    ) -> None:
        """Initialize the scanner with an AST extractor and exclusion patterns.

        Args:
            extractor: Optional PythonAstExtractor instance. If None, a new instance is created.
            exclude_patterns: Optional list of glob patterns to exclude from scanning.
        """
        self.extractor = extractor or PythonAstExtractor()
        self.exclude_patterns = exclude_patterns if exclude_patterns is not None else list(DEFAULT_EXCLUDE_PATTERNS)

    def is_excluded(self, path: str, name: str) -> bool:
        """Check whether a given directory or file should be excluded.

        Args:
            path: Relative or absolute path of the item.
            name: File or directory name.

        Returns:
            True if excluded, False otherwise.
        """
        for pattern in self.exclude_patterns:
            if fnmatch.fnmatch(name, pattern) or fnmatch.fnmatch(path, pattern):
                return True
        return False

    def find_python_files(self, root_dir: str) -> List[str]:
        """Find all non-excluded Python files in a directory hierarchy.

        Args:
            root_dir: Root directory path to scan.

        Returns:
            Sorted list of absolute paths to discovered Python files.
        """
        root_path = Path(root_dir).resolve()
        if not root_path.exists():
            logger.warning(f"Root directory does not exist: {root_dir}")
            return []

        if root_path.is_file():
            if root_path.suffix == ".py" and not self.is_excluded(str(root_path), root_path.name):
                return [str(root_path)]
            return []

        discovered: List[str] = []
        for dirpath, dirnames, filenames in os.walk(str(root_path)):
            # Filter directories in-place to avoid descending into excluded dirs
            dirnames[:] = [
                d
                for d in dirnames
                if not self.is_excluded(os.path.relpath(os.path.join(dirpath, d), str(root_path)), d)
            ]

            for filename in filenames:
                if filename.endswith(".py"):
                    rel_file = os.path.relpath(os.path.join(dirpath, filename), str(root_path))
                    if not self.is_excluded(rel_file, filename):
                        discovered.append(os.path.normpath(os.path.join(dirpath, filename)))

        discovered.sort()
        return discovered

    def scan_file(self, file_path: str, repo_root: Optional[str] = None) -> List[AstCodeChunk]:
        """Scan a single Python file and extract its AST chunks.

        Args:
            file_path: Path to the Python file.
            repo_root: Optional repository root directory for computing relative paths.

        Returns:
            List of AstCodeChunk objects extracted from the file.
        """
        effective_root = repo_root or os.path.dirname(os.path.abspath(file_path))
        try:
            return self.extractor.parse_file(file_path=file_path, repo_root=effective_root)
        except Exception as e:
            logger.error(f"Failed to parse file {file_path}: {e}", exc_info=True)
            return []

    def scan_directory(self, root_dir: str, repo_root: Optional[str] = None) -> List[AstCodeChunk]:
        """Recursively scan a directory, parse all Python files, and return aggregated chunks.

        Args:
            root_dir: Root directory path to scan.
            repo_root: Optional repository root for computing relative paths. If None, root_dir is used.

        Returns:
            List of all AstCodeChunk objects discovered across the directory.
        """
        effective_root = repo_root or root_dir
        py_files = self.find_python_files(root_dir)
        all_chunks: List[AstCodeChunk] = []

        for file_path in py_files:
            try:
                chunks = self.extractor.parse_file(file_path=file_path, repo_root=effective_root)
                all_chunks.extend(chunks)
            except Exception as e:
                logger.error(f"Error extracting AST from {file_path}: {e}", exc_info=True)
                continue

        return all_chunks
