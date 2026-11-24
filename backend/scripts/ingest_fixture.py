"""Ingest Python fixture codebase (requests) into persistent LanceDB storage.

Extracts AST chunks using Tree-sitter, computes embeddings via MockEmbeddingModel(384),
and persists them into backend/data/lancedb in table 'ast_chunks'.
"""

import argparse
import gc
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure backend package is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import lancedb
from app.core.embedding import BaseEmbeddingModel, MockEmbeddingModel, SentenceTransformerEmbedder
from app.services.ingestion import VectorIngestionService
from app.services.repo_registry import SEED_REPOSITORIES
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


def seed_all_repositories(
    project_root: Path,
    use_real_embedder: bool = True,
    dimension: int = 384,
) -> None:
    """Seed both root data/lancedb and backend/data/lancedb with requests and sample_codebase."""
    embedder: BaseEmbeddingModel
    if use_real_embedder:
        print("[Seed] Loading SentenceTransformerEmbedder('all-MiniLM-L6-v2')...")
        embedder = SentenceTransformerEmbedder(model_name="all-MiniLM-L6-v2", dimension=dimension)
    else:
        print("[Seed] Using MockEmbeddingModel(384)...")
        embedder = MockEmbeddingModel(dimension=dimension)

    requests_dir = project_root / "fixtures" / "requests"
    sample_dir = project_root / "backend" / "sample_codebase"

    # 1. Seed root data/lancedb (used by live FastAPI application) with both requests (284) and sample_codebase (24) = 308 chunks
    root_db_dir = project_root / "data" / "lancedb"
    root_db_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n[Seed] Rebuilding live application LanceDB at: {root_db_dir}")
    db = lancedb.connect(str(root_db_dir))
    tables_obj = db.list_tables()
    table_names = tables_obj.tables if hasattr(tables_obj, "tables") else list(tables_obj)
    if "ast_chunks" in table_names:
        db.drop_table("ast_chunks")
        gc.collect()

    store = LanceDBVectorStore(db_path=str(root_db_dir), table_name="ast_chunks", dimension=dimension)
    store.initialize()
    service = VectorIngestionService(embedder=embedder, vector_store=store, batch_size=64)

    req_count = service.ingest_directory(
        root_dir=str(requests_dir),
        repo_root=str(requests_dir),
        repo_id="requests",
    )
    sample_count = service.ingest_directory(
        root_dir=str(sample_dir),
        repo_root=str(sample_dir),
        repo_id="sample_codebase",
    )
    print(f"[Seed] {root_db_dir}: requests={req_count}, sample_codebase={sample_count}, total={store.count()}")
    store.close()

    # 2. Ensure backend/data/lancedb (used by M1 benchmark & adversarial fixture tests) has clean 284 requests chunks
    backend_db_dir = project_root / "backend" / "data" / "lancedb"
    ingest_fixture(requests_dir, backend_db_dir, dimension=dimension)

    # Reset data/repos_registry.json to clean seed state without pytest temp folders
    now = datetime.now(timezone.utc).isoformat()
    clean_registry = [{**repo, "last_indexed": now} for repo in SEED_REPOSITORIES]
    for reg_path in [
        project_root / "data" / "repos_registry.json",
        project_root / "backend" / "data" / "repos_registry.json",
    ]:
        reg_path.parent.mkdir(parents=True, exist_ok=True)
        reg_path.write_text(json.dumps(clean_registry, indent=2), encoding="utf-8")
        print(f"[Seed] Cleaned registry: {reg_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed LanceDB with AST code chunks.")
    parser.add_argument("--all-seeds", action="store_true", help="Seed both requests and sample_codebase into root and backend LanceDB")
    parser.add_argument("--real-embedder", action="store_true", help="Use SentenceTransformerEmbedder('all-MiniLM-L6-v2')")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent.parent
    if args.all_seeds:
        seed_all_repositories(project_root, use_real_embedder=args.real_embedder)
        return

    fixture_dir = project_root / "fixtures" / "requests"
    db_path = project_root / "backend" / "data" / "lancedb"

    if not fixture_dir.exists():
        raise FileNotFoundError(f"Fixture directory not found at: {fixture_dir}")

    total_chunks = ingest_fixture(fixture_dir, db_path)
    print(f"[Main] Ingestion complete with {total_chunks} chunks.")


if __name__ == "__main__":
    main()
