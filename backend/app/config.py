"""Configuration settings for the Code Search Backend application."""

from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables or defaults."""

    model_config = SettingsConfigDict(
        env_prefix="APP_",
        case_sensitive=False,
        env_file=".env",
        extra="ignore",
    )

    project_name: str = "Generative Code Retrieval Backend"
    version: str = "0.1.0"
    api_v1_str: str = "/api/v1"

    # Storage settings
    vector_db_type: str = Field(
        default="lancedb",
        description="Vector database type: 'lancedb' or 'sqlite'",
    )
    db_path: str = Field(
        default="data/lancedb",
        description="Directory path for LanceDB vector storage",
    )
    sqlite_db_path: str = Field(
        default="data/code_search.db",
        description="SQLite database file path for fallback/testing storage",
    )

    # Embedding settings
    model_name: str = Field(
        default="all-MiniLM-L6-v2",
        description="HuggingFace model name for SentenceTransformers",
    )
    embedding_dimension: int = Field(
        default=384,
        description="Embedding vector dimensionality",
    )
    use_mock_embedder: bool = Field(
        default=False,
        description="Whether to use MockEmbeddingModel for offline development/testing",
    )

    # CORS settings
    cors_origins: List[str] = Field(
        default=["*"],
        description="Allowed CORS origins for frontend access",
    )

    # Ingestion settings
    default_source_dir: Optional[str] = Field(
        default=None,
        description="Default codebase directory to index on startup if specified",
    )


settings = Settings()
