"""Embedding models abstraction and implementations for code retrieval."""

from abc import ABC, abstractmethod
import hashlib
from typing import List, Optional
import numpy as np


class BaseEmbeddingModel(ABC):
    """Abstract base class for text and code embedding models."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding vector dimension."""
        pass

    @abstractmethod
    def embed_query(self, text: str) -> np.ndarray:
        """Embed a single search query text.
        
        Returns:
            1D numpy array of shape (dimension,) and dtype float32 (unit-normalized).
        """
        pass

    @abstractmethod
    def embed_documents(self, texts: List[str]) -> np.ndarray:
        """Embed a batch of document texts or code chunks.
        
        Returns:
            2D numpy array of shape (len(texts), dimension) and dtype float32 (unit-normalized).
        """
        pass


class MockEmbeddingModel(BaseEmbeddingModel):
    """Deterministic, offline embedding model generating unit-normalized vectors.
    
    Uses SHA-256 string hashing to seed a NumPy pseudo-random generator,
    guaranteeing identical vectors for identical strings across processes
    without requiring external model downloads or internet connectivity.
    """

    def __init__(self, dimension: int = 384) -> None:
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_query(self, text: str) -> np.ndarray:
        if not text:
            # Handle empty string with fixed non-zero vector
            v = np.ones(self._dimension, dtype=np.float32)
            return (v / np.linalg.norm(v)).astype(np.float32)

        # Seed pseudo-random generator deterministically via SHA-256
        h = hashlib.sha256(text.encode("utf-8")).digest()
        seed = int.from_bytes(h[:4], "big")
        rng = np.random.RandomState(seed)
        v = rng.randn(self._dimension).astype(np.float32)
        norm = float(np.linalg.norm(v))
        if norm > 0.0:
            v = v / norm
        return v.astype(np.float32)

    def embed_documents(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self._dimension), dtype=np.float32)
        return np.stack([self.embed_query(t) for t in texts]).astype(np.float32)


class SentenceTransformerEmbedder(BaseEmbeddingModel):
    """Embedding model powered by Hugging Face sentence-transformers.
    
    Loads the underlying neural network lazily upon first embedding request.
    Defaults to 'all-MiniLM-L6-v2' (384-dimensional output).
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        device: Optional[str] = None,
        dimension: int = 384,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self._default_dimension = dimension
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise ImportError(
                    "sentence-transformers is not installed. "
                    "Install it via `pip install sentence-transformers` or "
                    "use MockEmbeddingModel for offline testing."
                ) from exc
            self._model = SentenceTransformer(self.model_name, device=self.device)
        return self._model

    @property
    def dimension(self) -> int:
        if self._model is not None:
            return int(self._model.get_sentence_embedding_dimension())
        return self._default_dimension

    def embed_query(self, text: str) -> np.ndarray:
        model = self._get_model()
        emb = model.encode(
            text,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return np.asarray(emb, dtype=np.float32)

    def embed_documents(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dimension), dtype=np.float32)
        model = self._get_model()
        embs = model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return np.asarray(embs, dtype=np.float32)
