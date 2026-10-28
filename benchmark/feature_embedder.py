"""Deterministic subword feature hashing embedding model for code search benchmarking.

Provides realistic semantic & lexical similarity matching without requiring
cloud API keys or heavy offline PyTorch downloads.
Conforms to BaseEmbeddingModel.
"""

import hashlib
import re
from typing import List
import numpy as np

from app.core.embedding import BaseEmbeddingModel


class FeatureHashingEmbedder(BaseEmbeddingModel):
    """Generates unit-normalized 384-dimensional dense vectors using token & n-gram hashing."""

    def __init__(self, dimension: int = 384) -> None:
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def _text_to_vector(self, text: str) -> np.ndarray:
        if not text or not text.strip():
            v = np.ones(self._dimension, dtype=np.float32)
            return (v / np.linalg.norm(v)).astype(np.float32)

        # Tokenize on words, identifiers, and snake_case / camelCase parts
        tokens = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', text.lower())
        sub_tokens = []
        for tok in tokens:
            # Split snake_case
            parts = tok.split('_')
            if len(parts) > 1:
                sub_tokens.extend([p for p in parts if len(p) >= 2])
            # Add character 3-grams for typo & morphological tolerance
            if len(tok) >= 3:
                for i in range(len(tok) - 2):
                    sub_tokens.append(tok[i:i+3])

        all_features = tokens + sub_tokens
        vec = np.zeros(self._dimension, dtype=np.float32)

        for feat in all_features:
            h = int(hashlib.md5(feat.encode('utf-8')).hexdigest(), 16)
            idx = h % self._dimension
            sign = 1.0 if (h >> 16) % 2 == 0 else -1.0
            vec[idx] += sign

        norm = float(np.linalg.norm(vec))
        if norm > 0.0:
            vec = vec / norm
        return vec.astype(np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        return self._text_to_vector(text)

    def embed_documents(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self._dimension), dtype=np.float32)
        return np.stack([self._text_to_vector(t) for t in texts]).astype(np.float32)
