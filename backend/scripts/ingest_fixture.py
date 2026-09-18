"""Ingest Python fixture codebase (requests) into persistent LanceDB storage.

Extracts AST chunks using Tree-sitter, computes embeddings via MockEmbeddingModel(384),
and persists them into backend/data/lancedb in table 'ast_chunks'.
"""

import gc
import os
import sys
from pathlib import Path

# Ensure backend package is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import lancedb
from app.core.embedding import MockEmbeddingModel
from app.services.ingestion import VectorIngestionService
from app.vector_store.lance_store import LanceDBVectorStore


def ingest_fixture(
    fixture_dir: Path,
    db_path: Path,
    table_name: str = "ast_chunks",
    batch_size: int = 64,
    dimension: int = 384,
) -> int:
    """Ingest python files from fixture_dir into LanceDB table."""
    fixture_path = Path(fixture_dir).resolve()
    db_dir = Path(db_path).resolve()
    db_dir.mkdir(parents=True, exist_ok=True)

    print(f"[Ingest] Connecting to LanceDB at: {db_dir}")
    db = lancedb.connect(str(db_dir))

    # Inspect existing tables and drop old table if present to prevent duplicates
    tables_obj = db.list_tables()
    table_names = tables_obj.tables if hasattr(tables_obj, "tables") else list(tables_obj)
    if table_name in table_names:
        print(f"[Ingest] Dropping existing '{table_name}' table...")
        db.drop_table(table_name)
        gc.collect()

    # Initialize vector store
    print(f"[Ingest] Initializing LanceDBVectorStore (table='{table_name}', dim={dimension})...")
    store = LanceDBVectorStore(db_path=str(db_dir), table_name=table_name, dimension=dimension)
    store.initialize()

    # Initialize mock embedder (deterministic, unit-normalized, 384-dim, 100% offline)
    embedder = MockEmbeddingModel(dimension=dimension)

    # Initialize ingestion service
    service = VectorIngestionService(
        embedder=embedder,
        vector_store=store,
        batch_size=batch_size,
    )

    print(f"[Ingest] Scanning and ingesting fixture from: {fixture_path}")
    count = service.ingest_directory(root_dir=str(fixture_path), repo_root=str(fixture_path))
    print(f"[Ingest] Successfully ingested {count} AST chunks into LanceDB.")

    # Validate store count
    stored_count = store.count()
    assert stored_count == count, f"Count mismatch: store has {stored_count} chunks, expected {count}"

    # Verify key AST chunk lookup (Session.request)
    session_request_chunks = store.search_exact("Session.request")
    assert len(session_request_chunks) >= 1, "Expected at least 1 chunk for Session.request"
    req_chunk = session_request_chunks[0]
    print(
        f"[Verify] Found exact match: {req_chunk.identifier} ({req_chunk.astNodeType}) in {req_chunk.filePath}:{req_chunk.startLine}-{req_chunk.endLine}"
    )
    assert req_chunk.filePath == "sessions.py"
    assert req_chunk.astNodeType == "FunctionDef"

    # Verify semantic search
    query_vec = embedder.embed_query("send an HTTP GET request")
    semantic_results = store.search_semantic(query_vec, top_k=3)
    print(f"[Verify] Semantic search returned {len(semantic_results)} results:")
    for r in semantic_results:
        print(f"  - {r.identifier} ({r.astNodeType}) in {r.filePath}:{r.startLine} [score: {r.relevanceScore:.4f}]")
    assert len(semantic_results) > 0, "Semantic search should return results"

    store.close()
    print(f"[Ingest] Done. All {count} chunks persisted to LanceDB.")
    return count


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent.parent
    fixture_dir = project_root / "fixtures" / "requests"
    db_path = project_root / "backend" / "data" / "lancedb"

    if not fixture_dir.exists():
        raise FileNotFoundError(f"Fixture directory not found at: {fixture_dir}")

    total_chunks = ingest_fixture(fixture_dir, db_path)
    print(f"[Main] Ingestion complete with {total_chunks} chunks.")


if __name__ == "__main__":
    main()
