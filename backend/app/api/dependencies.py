"""FastAPI dependencies for injecting services, stores, and embedders."""

from typing import cast
from fastapi import Depends, Request

from app.config import Settings, settings
from app.core.embedding import BaseEmbeddingModel
from app.services.ingestion import VectorIngestionService
from app.services.retrieval import RetrievalService
from app.vector_store.base import BaseVectorStore


def get_settings() -> Settings:
    """Return application settings instance."""
    return settings


def get_vector_store(request: Request) -> BaseVectorStore:
    """Return active vector store from application state with lazy initialization fallback."""
    if not hasattr(request.app.state, "vector_store") or request.app.state.vector_store is None:
        from app.vector_store.lance_store import LanceDBVectorStore
        from app.vector_store.sqlite_store import SQLiteVectorStore

        app_settings = getattr(request.app.state, "settings", settings)
        if app_settings.vector_db_type.lower() == "sqlite":
            store = SQLiteVectorStore(db_path=app_settings.sqlite_db_path)
        else:
            store = LanceDBVectorStore(db_path=app_settings.db_path)
        store.initialize()
        request.app.state.vector_store = store
    return cast(BaseVectorStore, request.app.state.vector_store)


def get_embedder(request: Request) -> BaseEmbeddingModel:
    """Return active embedding model from application state with lazy initialization fallback."""
    if not hasattr(request.app.state, "embedder") or request.app.state.embedder is None:
        from app.core.embedding import MockEmbeddingModel, SentenceTransformerEmbedder

        app_settings = getattr(request.app.state, "settings", settings)
        if app_settings.use_mock_embedder:
            emb = MockEmbeddingModel(dimension=app_settings.embedding_dimension)
        else:
            emb = SentenceTransformerEmbedder(model_name=app_settings.model_name)
        request.app.state.embedder = emb
    return cast(BaseEmbeddingModel, request.app.state.embedder)


def get_retrieval_service(
    vector_store: BaseVectorStore = Depends(get_vector_store),
    embedder: BaseEmbeddingModel = Depends(get_embedder),
) -> RetrievalService:
    """Provide RetrievalService instance configured with active store and embedder."""
    return RetrievalService(vector_store=vector_store, embedder=embedder)


def get_ingestion_service(
    vector_store: BaseVectorStore = Depends(get_vector_store),
    embedder: BaseEmbeddingModel = Depends(get_embedder),
) -> VectorIngestionService:
    """Provide VectorIngestionService instance configured with active store and embedder."""
    return VectorIngestionService(embedder=embedder, vector_store=vector_store)
