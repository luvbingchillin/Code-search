"""FastAPI application entrypoint for the AST Code Retrieval Engine."""

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import Settings, settings as default_settings
from app.core.embedding import BaseEmbeddingModel, MockEmbeddingModel, SentenceTransformerEmbedder
from app.vector_store.base import BaseVectorStore
from app.vector_store.lance_store import LanceDBVectorStore
from app.vector_store.sqlite_store import SQLiteVectorStore

logger = logging.getLogger(__name__)


def create_app(
    settings: Optional[Settings] = None,
    vector_store: Optional[BaseVectorStore] = None,
    embedder: Optional[BaseEmbeddingModel] = None,
) -> FastAPI:
    """Factory creating and configuring the FastAPI application instance."""
    app_settings = settings or default_settings

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # 1. Initialize Vector Store
        if not hasattr(app.state, "vector_store") or app.state.vector_store is None:
            if vector_store is not None:
                app.state.vector_store = vector_store
            elif app_settings.vector_db_type.lower() == "sqlite":
                app.state.vector_store = SQLiteVectorStore(db_path=app_settings.sqlite_db_path)
            else:
                app.state.vector_store = LanceDBVectorStore(db_path=app_settings.db_path)

        app.state.vector_store.initialize()

        # 2. Initialize Embedding Model
        if not hasattr(app.state, "embedder") or app.state.embedder is None:
            if embedder is not None:
                app.state.embedder = embedder
            elif app_settings.use_mock_embedder:
                app.state.embedder = MockEmbeddingModel(dim=app_settings.embedding_dimension)
            else:
                app.state.embedder = SentenceTransformerEmbedder(model_name=app_settings.model_name)

        logger.info(
            f"Initialized {app_settings.project_name} "
            f"[VectorDB: {app.state.vector_store.__class__.__name__}, "
            f"Embedder: {app.state.embedder.__class__.__name__}]"
        )

        yield

        # Teardown: close vector store connections and release file locks
        if hasattr(app.state, "vector_store") and app.state.vector_store is not None:
            app.state.vector_store.close()
            logger.info("Vector store cleanly closed.")

    app = FastAPI(
        title=app_settings.project_name,
        version=app_settings.version,
        description="Offline AST Ingestion and Semantic Retrieval Server for Generative Code Search",
        lifespan=lifespan,
    )

    # Store settings in application state
    app.state.settings = app_settings
    if vector_store is not None:
        app.state.vector_store = vector_store
    if embedder is not None:
        app.state.embedder = embedder

    # CORS Middleware allowing frontend direct access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(api_router, prefix=app_settings.api_v1_str)

    @app.get("/", summary="Root Status")
    def root():
        return {
            "name": app_settings.project_name,
            "version": app_settings.version,
            "status": "running",
            "docs_url": "/docs",
            "api_v1": app_settings.api_v1_str,
        }

    return app


# Default ASGI application instance for uvicorn
app = create_app()
