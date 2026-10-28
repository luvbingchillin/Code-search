"""Naive text chunker baseline simulating traditional RAG splitters.

Emulates LangChain's RecursiveCharacterTextSplitter / sliding window:
- Fixed character size: 500 characters
- Character overlap: 50 characters
- Splits blindly on line or character boundaries without syntactic awareness.
"""

from pathlib import Path
from typing import List, Dict, Any
import re


class NaiveCodeChunker:
    """Splits source code into fixed-character overlapping chunks."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_file(self, file_path: Path, base_dir: Path) -> List[Dict[str, Any]]:
        """Split a python file into naive chunks with estimated line numbers."""
        rel_path = file_path.relative_to(base_dir).as_posix()
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = file_path.read_text(encoding="latin-1")

        lines = content.splitlines(keepends=True)
        if not lines:
            return []

        # Build index mapping character offset to 1-indexed line number
        char_to_line = []
        current_line = 1
        for line in lines:
            for _ in line:
                char_to_line.append(current_line)
            current_line += 1

        total_chars = len(content)
        chunks: List[Dict[str, Any]] = []
        step = max(1, self.chunk_size - self.chunk_overlap)
        chunk_idx = 0

        for start_pos in range(0, total_chars, step):
            end_pos = min(total_chars, start_pos + self.chunk_size)
            chunk_text = content[start_pos:end_pos]
            if not chunk_text.strip():
                continue

            start_line = char_to_line[min(start_pos, len(char_to_line) - 1)]
            end_line = char_to_line[min(end_pos - 1, len(char_to_line) - 1)]

            # Naively guess an identifier from the chunk text (e.g. def foo or class Bar)
            match = re.search(r'(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)', chunk_text)
            identifier = match.group(1) if match else f"chunk_{chunk_idx}"

            chunk_id = f"{rel_path}:naive_{chunk_idx}:{start_line}"
            chunks.append({
                "id": chunk_id,
                "filePath": rel_path,
                "fileName": file_path.name,
                "astNodeType": "Module", # Naive chunker has no AST node classification
                "identifier": identifier,
                "startLine": start_line,
                "endLine": max(start_line, end_line),
                "code": chunk_text,
                "relevanceScore": 0.0,
                "docstring": "",
                "parameters": [],
                "decorators": [],
                "language": "python",
                "repoFullName": "local",
                "summary": chunk_text[:100].replace("\n", " ").strip(),
                "imports": [],
                "calls": [],
            })
            chunk_idx += 1

        return chunks

    def chunk_directory(self, directory: Path) -> List[Dict[str, Any]]:
        """Recursively chunk all .py files in a directory."""
        dir_path = Path(directory).resolve()
        py_files = sorted(dir_path.rglob("*.py"))
        all_chunks = []
        for pf in py_files:
            all_chunks.extend(self.chunk_file(pf, dir_path))
        return all_chunks
