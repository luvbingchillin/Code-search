"""Abstract Base Class for Vector Stores in Code Search."""

from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np

from app.models.chunk import AstCodeChunk


class BaseVectorStore(ABC):
    """Abstract base class defining the contract for AST chunk vector stores."""

    def __enter__(self) -> "BaseVectorStore":
        self.initialize()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    @abstractmethod
    def initialize(self) -> None:
        """Initialize the vector store, schemas, connections, and tables."""
        pass

    @abstractmethod
    def add_chunks(self, chunks: List[AstCodeChunk], embeddings: np.ndarray) -> None:
        """Store AST chunks with their corresponding embedding vectors.

        Args:
            chunks: List of AstCodeChunk objects.
            embeddings: 2D numpy array of shape (len(chunks), dimension) with float32 values.
        """
        pass

    @abstractmethod
    def search_semantic(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
        ast_node_type: Optional[str] = None,
    ) -> List[AstCodeChunk]:
        """Search top-K most similar AST chunks by vector similarity.

        Args:
            query_vector: 1D numpy array of shape (dimension,).
            top_k: Maximum number of results to return.
            ast_node_type: Optional filter by AST node type (e.g. 'FunctionDef', 'ClassDef').

        Returns:
            List of AstCodeChunk objects ordered by descending relevanceScore in [0.0, 1.0].
        """
        pass

    @abstractmethod
    def search_exact(self, identifier: str) -> List[AstCodeChunk]:
        """Retrieve AST chunks matching exact entity name.

        Args:
            identifier: Exact identifier (e.g. function name or ClassName.method_name).

        Returns:
            List of matching AstCodeChunk objects with relevanceScore set to 1.0.
        """
        pass

    @abstractmethod
    def get_by_id(self, chunk_id: str) -> Optional[AstCodeChunk]:
        """Retrieve a single chunk by unique ID.

        Args:
            chunk_id: The unique ID of the chunk.

        Returns:
            AstCodeChunk if found, None otherwise.
        """
        pass

    @abstractmethod
    def count(self) -> int:
        """Total number of stored chunks in the vector store."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Cleanly close connection and release all file handles and locks."""
        pass
