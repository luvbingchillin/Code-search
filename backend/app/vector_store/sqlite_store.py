"""SQLite + NumPy vector store implementation for lightweight and offline testing."""

import json
import os
import sqlite3
from typing import List, Optional
import numpy as np

from app.models.chunk import AstCodeChunk
from app.vector_store.base import BaseVectorStore


class SQLiteVectorStore(BaseVectorStore):
    """Vector store backed by SQLite for metadata and NumPy for vector cosine similarity.

    Requires zero external C-dependencies, making it ideal for testing and
    environments without native vector database dependencies.
    """

    def __init__(
        self,
        db_path: str = ":memory:",
        table_name: str = "ast_chunks",
        dimension: int = 384,
    ) -> None:
        self.db_path = str(db_path)
        self.table_name = table_name
        self.dimension = dimension
        self.conn: Optional[sqlite3.Connection] = None

    def initialize(self) -> None:
        """Initialize SQLite database connection and create schema and indices."""
        if self.conn is not None:
            return

        if self.db_path != ":memory:":
            parent_dir = os.path.dirname(os.path.abspath(self.db_path))
            if parent_dir:
                os.makedirs(parent_dir, exist_ok=True)

        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

        with self.conn:
            self.conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id TEXT PRIMARY KEY,
                    filePath TEXT NOT NULL,
                    fileName TEXT NOT NULL,
                    astNodeType TEXT NOT NULL,
                    identifier TEXT NOT NULL,
                    startLine INTEGER NOT NULL,
                    endLine INTEGER NOT NULL,
                    code TEXT NOT NULL,
                    relevanceScore REAL NOT NULL DEFAULT 1.0,
                    docstring TEXT,
                    parameters TEXT,
                    decorators TEXT,
                    language TEXT,
                    repoFullName TEXT,
                    summary TEXT,
                    imports TEXT,
                    calls TEXT,
                    vector BLOB NOT NULL
                );
            """)
            self.conn.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{self.table_name}_identifier ON {self.table_name} (identifier);"
            )
            self.conn.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{self.table_name}_astNodeType ON {self.table_name} (astNodeType);"
            )

    def _ensure_initialized(self) -> None:
        if self.conn is None:
            self.initialize()

    def add_chunks(self, chunks: List[AstCodeChunk], embeddings: np.ndarray) -> None:
        """Store AST chunks with their embedding vectors as BLOBs."""
        if not chunks:
            return

        self._ensure_initialized()

        rows = []
        for chunk, emb in zip(chunks, embeddings):
            vec_bytes = np.asarray(emb, dtype=np.float32).tobytes()
            rows.append((
                chunk.id,
                chunk.filePath,
                chunk.fileName,
                chunk.astNodeType,
                chunk.identifier,
                chunk.startLine,
                chunk.endLine,
                chunk.code,
                chunk.relevanceScore,
                chunk.docstring,
                json.dumps(chunk.parameters or []),
                json.dumps(chunk.decorators or []),
                chunk.language or "python",
                chunk.repoFullName or "local",
                chunk.summary,
                json.dumps(chunk.imports or []),
                json.dumps(chunk.calls or []),
                vec_bytes,
            ))

        sql = f"""
            INSERT OR REPLACE INTO {self.table_name} (
                id, filePath, fileName, astNodeType, identifier, startLine, endLine, code,
                relevanceScore, docstring, parameters, decorators, language, repoFullName,
                summary, imports, calls, vector
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        with self.conn:
            self.conn.executemany(sql, rows)

    def search_semantic(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
        ast_node_type: Optional[str] = None,
    ) -> List[AstCodeChunk]:
        """Compute cosine similarity between query_vector and stored chunks using NumPy."""
        self._ensure_initialized()

        if ast_node_type:
            cursor = self.conn.execute(
                f"SELECT * FROM {self.table_name} WHERE astNodeType = ?",
                (ast_node_type,),
            )
        else:
            cursor = self.conn.execute(f"SELECT * FROM {self.table_name}")

        rows = cursor.fetchall()
        if top_k <= 0 or not rows:
            return []

        vectors = np.stack([np.frombuffer(r["vector"], dtype=np.float32) for r in rows])
        q = np.asarray(query_vector, dtype=np.float32)

        q_norm = float(np.linalg.norm(q))
        if q_norm > 0.0:
            q = q / q_norm

        vec_norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        vec_norms[vec_norms == 0.0] = 1.0
        norm_vectors = vectors / vec_norms

        # Cosine similarity in [-1.0, 1.0]
        sims = np.dot(norm_vectors, q)
        # Cosine distance: d = 1.0 - sim in [0.0, 2.0]
        distances = np.maximum(0.0, 1.0 - sims)
        # Normalized relevance score: 1 / (1 + d) in [0.0, 1.0]
        scores = np.clip(1.0 / (1.0 + distances), 0.0, 1.0)

        top_indices = np.argsort(-scores)[:top_k]
        results: List[AstCodeChunk] = []
        for idx in top_indices:
            r = rows[idx]
            chunk = self._row_to_chunk(r, relevance_score=float(scores[idx]))
            results.append(chunk)

        return results

    def search_exact(self, identifier: str) -> List[AstCodeChunk]:
        """Retrieve AST chunks matching exact entity name."""
        self._ensure_initialized()

        cursor = self.conn.execute(
            f"SELECT * FROM {self.table_name} WHERE identifier = ?",
            (identifier,),
        )
        rows = cursor.fetchall()
        return [self._row_to_chunk(r, relevance_score=1.0) for r in rows]

    def get_by_id(self, chunk_id: str) -> Optional[AstCodeChunk]:
        """Retrieve a single chunk by unique ID."""
        self._ensure_initialized()

        cursor = self.conn.execute(
            f"SELECT * FROM {self.table_name} WHERE id = ?",
            (chunk_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return self._row_to_chunk(row)

    def count(self) -> int:
        """Total number of stored chunks."""
        self._ensure_initialized()
        cursor = self.conn.execute(f"SELECT COUNT(*) FROM {self.table_name}")
        row = cursor.fetchone()
        return int(row[0]) if row else 0

    def close(self) -> None:
        """Close SQLite database connection cleanly."""
        if self.conn is not None:
            self.conn.close()
            self.conn = None

    def _row_to_chunk(
        self,
        r: sqlite3.Row,
        relevance_score: Optional[float] = None,
    ) -> AstCodeChunk:
        score = relevance_score if relevance_score is not None else float(r["relevanceScore"])
        return AstCodeChunk(
            id=r["id"],
            filePath=r["filePath"],
            fileName=r["fileName"],
            astNodeType=r["astNodeType"],
            identifier=r["identifier"],
            startLine=int(r["startLine"]),
            endLine=int(r["endLine"]),
            code=r["code"],
            relevanceScore=score,
            docstring=r["docstring"],
            parameters=json.loads(r["parameters"]) if r["parameters"] else [],
            decorators=json.loads(r["decorators"]) if r["decorators"] else [],
            language=r["language"] or "python",
            repoFullName=r["repoFullName"] or "local",
            summary=r["summary"],
            imports=json.loads(r["imports"]) if r["imports"] else [],
            calls=json.loads(r["calls"]) if r["calls"] else [],
        )
