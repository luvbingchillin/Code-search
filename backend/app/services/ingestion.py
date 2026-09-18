"""Vector ingestion service coordinating AST scanning, embedding, and vector storage."""

import logging
from pathlib import Path
from typing import List, Optional, Union
import numpy as np

from app.core.embedding import BaseEmbeddingModel
from app.models.chunk import AstCodeChunk
from app.parser.scanner import CodebaseScanner
from app.vector_store.base import BaseVectorStore

logger = logging.getLogger(__name__)


class VectorIngestionService:
    """Coordinates AST extraction, vector embedding generation, and vector DB storage."""

    def __init__(
        self,
        embedder: BaseEmbeddingModel,
        vector_store: BaseVectorStore,
        scanner: Optional[CodebaseScanner] = None,
        batch_size: int = 64,
    ) -> None:
        self.embedder = embedder
        self.vector_store = vector_store
        self.scanner = scanner or CodebaseScanner()
        self.batch_size = max(1, batch_size)

    def prepare_chunk_text(self, chunk: AstCodeChunk) -> str:
        """Construct the textual representation of an AST chunk for semantic embedding.

        Combines identifier, docstring, parameters, and code body to provide
        high semantic retrieval fidelity.
        """
        parts: List[str] = [f"Entity: {chunk.identifier}", f"Type: {chunk.astNodeType}"]
        if chunk.docstring:
            parts.append(f"Docstring:\n{chunk.docstring}")
        if chunk.parameters:
            parts.append(f"Parameters: {', '.join(chunk.parameters)}")
        if chunk.code:
            parts.append(f"Code:\n{chunk.code}")
        return "\n\n".join(parts)

    def ingest_chunks(self, chunks: List[AstCodeChunk]) -> int:
        """Embed a collection of AST code chunks and persist them into the vector store.

        Processes chunks in batches to control memory consumption.

        Args:
            chunks: List of AstCodeChunk objects to embed and store.

        Returns:
            Number of successfully ingested chunks.
        """
        if not chunks:
            return 0

        total = len(chunks)
        logger.info(f"Ingesting {total} AST chunks in batches of {self.batch_size}...")

        for i in range(0, total, self.batch_size):
            batch = chunks[i : i + self.batch_size]
            texts = [self.prepare_chunk_text(c) for c in batch]
            embeddings: np.ndarray = self.embedder.embed_documents(texts)
            self.vector_store.add_chunks(batch, embeddings)

        logger.info(f"Successfully ingested {total} chunks.")
        return total

    def ingest_directory(
        self,
        root_dir: Union[str, Path],
        repo_root: Optional[Union[str, Path]] = None,
    ) -> int:
        """Scan a filesystem directory for Python files, parse AST chunks, and ingest them.

        Args:
            root_dir: Root directory path to scan.
            repo_root: Optional repository root for generating relative file paths.

        Returns:
            Total count of chunks extracted and ingested.
        """
        root_str = str(root_dir)
        repo_str = str(repo_root) if repo_root is not None else None
        chunks = self.scanner.scan_directory(root_str, repo_root=repo_str)
        return self.ingest_chunks(chunks)

    def ingest_file(
        self,
        file_path: Union[str, Path],
        repo_root: Optional[Union[str, Path]] = None,
    ) -> int:
        """Parse a single Python file into AST chunks and ingest them into the vector store.

        Args:
            file_path: Path to the target Python file.
            repo_root: Optional repository root for relative path calculations.

        Returns:
            Total count of chunks extracted and ingested.
        """
        file_str = str(file_path)
        repo_str = str(repo_root) if repo_root is not None else None
        chunks = self.scanner.scan_file(file_str, repo_root=repo_str)
        return self.ingest_chunks(chunks)
