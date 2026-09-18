"""LanceDB vector store implementation for AST code chunks."""

import gc
import os
from typing import List, Optional
import lancedb
import numpy as np
import pyarrow as pa

from app.models.chunk import AstCodeChunk
from app.vector_store.base import BaseVectorStore


class LanceDBVectorStore(BaseVectorStore):
    """Local vector store backed by LanceDB and Apache Arrow.

    Supports native zero-copy columnar storage, vector search, and
    SQL filtering on AST metadata.
    """

    def __init__(
        self,
        db_path: str,
        table_name: str = "ast_chunks",
        dimension: int = 384,
    ) -> None:
        self.db_path = str(db_path)
        self.table_name = table_name
        self.dimension = dimension
        self._db: Optional[lancedb.DBConnection] = None
        self._table = None

    def initialize(self) -> None:
        """Initialize LanceDB database connection and ensure table exists."""
        os.makedirs(self.db_path, exist_ok=True)
        self._db = lancedb.connect(self.db_path)

        if hasattr(self._db, "list_tables"):
            tables_obj = self._db.list_tables()
            table_names = tables_obj.tables if hasattr(tables_obj, "tables") else list(tables_obj)
        else:
            table_names = self._db.table_names()

        if self.table_name in table_names:
            self._table = self._db.open_table(self.table_name)
        else:
            schema = pa.schema([
                pa.field("id", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), self.dimension)),
                pa.field("filePath", pa.string()),
                pa.field("fileName", pa.string()),
                pa.field("astNodeType", pa.string()),
                pa.field("identifier", pa.string()),
                pa.field("startLine", pa.int64()),
                pa.field("endLine", pa.int64()),
                pa.field("code", pa.string()),
                pa.field("relevanceScore", pa.float32()),
                pa.field("docstring", pa.string()),
                pa.field("parameters", pa.list_(pa.string())),
                pa.field("decorators", pa.list_(pa.string())),
                pa.field("language", pa.string()),
                pa.field("repoFullName", pa.string()),
                pa.field("summary", pa.string()),
                pa.field("imports", pa.list_(pa.string())),
                pa.field("calls", pa.list_(pa.string())),
            ])
            self._table = self._db.create_table(self.table_name, schema=schema)

    def _ensure_initialized(self) -> None:
        if self._table is None:
            self.initialize()

    def add_chunks(self, chunks: List[AstCodeChunk], embeddings: np.ndarray) -> None:
        """Add AST chunks with their corresponding embedding vectors to LanceDB."""
        if not chunks:
            return

        self._ensure_initialized()

        records = []
        for chunk, emb in zip(chunks, embeddings):
            row = chunk.model_dump()
            row["vector"] = emb.tolist() if isinstance(emb, np.ndarray) else list(emb)
            row["parameters"] = list(row.get("parameters") or [])
            row["decorators"] = list(row.get("decorators") or [])
            row["imports"] = list(row.get("imports") or [])
            row["calls"] = list(row.get("calls") or [])
            records.append(row)

        self._table.add(records)

    def search_semantic(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
        ast_node_type: Optional[str] = None,
    ) -> List[AstCodeChunk]:
        """Search top-K most similar AST chunks by vector similarity."""
        self._ensure_initialized()
        if top_k <= 0 or len(self._table) == 0:
            return []

        q_vec = query_vector.tolist() if isinstance(query_vector, np.ndarray) else list(query_vector)
        query = self._table.search(q_vec)

        if ast_node_type:
            safe_type = ast_node_type.replace("'", "''")
            query = query.where(f"astNodeType = '{safe_type}'")

        results = query.limit(top_k).to_list()
        output: List[AstCodeChunk] = []

        for r in results:
            dist = float(r.get("_distance", 0.0))
            # Monotonic distance to relevance score mapping: 1 / (1 + d) in [0.0, 1.0]
            relevance = float(np.clip(1.0 / (1.0 + max(0.0, dist)), 0.0, 1.0))
            data = dict(r)
            data.pop("vector", None)
            data.pop("_distance", None)
            data["relevanceScore"] = relevance

            for list_key in ("parameters", "decorators", "imports", "calls"):
                if data.get(list_key) is not None:
                    data[list_key] = list(data[list_key])
                else:
                    data[list_key] = []

            output.append(AstCodeChunk(**data))

        return output

    def search_exact(self, identifier: str) -> List[AstCodeChunk]:
        """Retrieve AST chunks matching exact entity name."""
        self._ensure_initialized()
        if len(self._table) == 0:
            return []

        safe_id = identifier.replace("'", "''")
        results = self._table.search().where(f"identifier = '{safe_id}'").to_list()
        output: List[AstCodeChunk] = []

        for r in results:
            data = dict(r)
            data.pop("vector", None)
            data.pop("_distance", None)
            data["relevanceScore"] = 1.0

            for list_key in ("parameters", "decorators", "imports", "calls"):
                if data.get(list_key) is not None:
                    data[list_key] = list(data[list_key])
                else:
                    data[list_key] = []

            output.append(AstCodeChunk(**data))

        return output

    def get_by_id(self, chunk_id: str) -> Optional[AstCodeChunk]:
        """Retrieve a single chunk by its unique ID."""
        self._ensure_initialized()
        if len(self._table) == 0:
            return None

        safe_id = chunk_id.replace("'", "''")
        results = self._table.search().where(f"id = '{safe_id}'").limit(1).to_list()
        if not results:
            return None

        data = dict(results[0])
        data.pop("vector", None)
        data.pop("_distance", None)

        for list_key in ("parameters", "decorators", "imports", "calls"):
            if data.get(list_key) is not None:
                data[list_key] = list(data[list_key])
            else:
                data[list_key] = []

        return AstCodeChunk(**data)

    def count(self) -> int:
        """Total number of stored chunks."""
        self._ensure_initialized()
        return len(self._table)

    def close(self) -> None:
        """Cleanly close connection and release all file locks."""
        self._table = None
        if self._db is not None:
            if hasattr(self._db, "close"):
                self._db.close()
            self._db = None
        gc.collect()
