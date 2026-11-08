"""Pydantic request and response schemas for AST chunk retrieval API."""

from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.models.chunk import AstCodeChunk, AstNodeType


class SearchRequest(BaseModel):
    """Request payload for semantic vector search."""
    model_config = ConfigDict(populate_by_name=True)

    query: str = Field(..., min_length=1, description="Natural language search query or concept")
    top_k: int = Field(default=5, ge=1, le=100, description="Maximum number of results to return (>= 1)")
    ast_node_type: Optional[AstNodeType] = Field(default=None, description="Optional AST node type filter")
    file_path: Optional[str] = Field(default=None, description="Optional relative file path filter")


class SearchResponse(BaseModel):
    """Response payload for semantic vector search."""
    model_config = ConfigDict(populate_by_name=True)

    query: str = Field(..., description="Original search query string")
    total_results: int = Field(..., description="Number of retrieved matching chunks")
    chunks: List[AstCodeChunk] = Field(default_factory=list, description="List of matched AST code chunks")
    latency_ms: float = Field(..., description="Search latency in milliseconds")


class EntityLookupResponse(BaseModel):
    """Response payload for exact identifier match lookup."""
    model_config = ConfigDict(populate_by_name=True)

    identifier: str = Field(..., description="Exact queried entity name or method")
    count: int = Field(..., description="Number of matching AST chunks found")
    chunks: List[AstCodeChunk] = Field(default_factory=list, description="Matching AST code chunks")


class HealthResponse(BaseModel):
    """Response payload for backend health check."""
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(default="healthy", description="Service health status")
    vector_db: str = Field(..., description="Active vector store engine name")
    total_chunks: int = Field(..., description="Total indexed AST code chunks")
    embedding_dimension: int = Field(..., description="Vector dimensionality of active embedder")
    embedding_model: str = Field(..., description="Active embedding model name or identifier")


class IndexRequest(BaseModel):
    """Request payload to trigger codebase scanning and vector indexing."""
    model_config = ConfigDict(populate_by_name=True)

    source_dir: str = Field(..., min_length=1, description="Absolute or relative path to directory to index")
    force_reindex: bool = Field(default=False, description="Whether to re-extract and re-index all chunks")


class IndexResponse(BaseModel):
    """Response payload after indexing a codebase directory."""
    model_config = ConfigDict(populate_by_name=True)

    indexed_files: int = Field(..., description="Count of scanned Python files")
    extracted_chunks: int = Field(..., description="Count of parsed and embedded AST code chunks")
    elapsed_seconds: float = Field(..., description="Total ingestion execution time in seconds")


class RepositoryItem(BaseModel):
    """Metadata schema representing an indexed codebase repository."""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique repository identifier")
    name: str = Field(..., description="Display name of the repository")
    path: str = Field(..., description="Local file system path")
    chunks_count: int = Field(default=0, description="Total AST chunks extracted and stored")
    files_count: int = Field(default=0, description="Total Python source files scanned")
    status: str = Field(default="indexed", description="Indexing status: indexed, indexing, or not_indexed")
    description: Optional[str] = Field(default=None, description="Short summary description")
    last_indexed: Optional[str] = Field(default=None, description="ISO timestamp of last successful index")


class RepositoriesResponse(BaseModel):
    """Response payload returning list of known and indexed repositories."""
    model_config = ConfigDict(populate_by_name=True)

    repositories: List[RepositoryItem] = Field(default_factory=list, description="List of repositories")
    total: int = Field(..., description="Total repository count")


class FileSymbolNode(BaseModel):
    """Compact AST symbol metadata for file tree explorer."""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique AST chunk identifier")
    identifier: str = Field(..., description="Function, method, or class name")
    ast_node_type: str = Field(..., alias="astNodeType", description="AST Node type (ClassDef, FunctionDef)")
    start_line: int = Field(..., alias="startLine", description="Starting source line number")
    end_line: int = Field(..., alias="endLine", description="Ending source line number")
    parameters: List[str] = Field(default_factory=list, description="Method parameter names")


class FileTreeNode(BaseModel):
    """File node grouping all extracted AST symbols within a source file."""
    model_config = ConfigDict(populate_by_name=True)

    file_path: str = Field(..., alias="filePath", description="Relative or normalized file path")
    file_name: str = Field(..., alias="fileName", description="Base file name")
    symbols_count: int = Field(default=0, alias="symbolsCount", description="Count of AST symbols in file")
    symbols: List[FileSymbolNode] = Field(default_factory=list, description="Nested AST symbols")


class RepositoryTreeResponse(BaseModel):
    """Hierarchical AST symbol tree for a repository."""
    model_config = ConfigDict(populate_by_name=True)

    repo_id: str = Field(..., description="Unique repository identifier")
    repo_name: str = Field(..., description="Repository display name")
    total_files: int = Field(..., description="Count of source files")
    total_symbols: int = Field(..., description="Count of total AST symbols")
    tree: List[FileTreeNode] = Field(default_factory=list, description="List of file nodes with nested symbols")


__all__ = [
    "AstNodeType",
    "AstCodeChunk",
    "SearchRequest",
    "SearchResponse",
    "EntityLookupResponse",
    "HealthResponse",
    "IndexRequest",
    "IndexResponse",
    "RepositoryItem",
    "RepositoriesResponse",
    "FileSymbolNode",
    "FileTreeNode",
    "RepositoryTreeResponse",
]
