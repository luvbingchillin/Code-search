"""Pydantic schemas for 3D Layered Strata Code Dependency Graph."""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrataNode(BaseModel):
    """3D Strata Graph Node representing an AST code symbol."""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique deterministic AST chunk identifier")
    identifier: str = Field(..., description="Function, class, or method name")
    filePath: str = Field(..., description="Normalized relative file path")
    astNodeType: str = Field(..., description="AST node type classification")
    tier: int = Field(..., ge=0, le=3, description="Architectural strata tier index (0 to 3)")
    startLine: int = Field(..., ge=1, description="1-indexed starting line number")
    endLine: int = Field(..., ge=1, description="1-indexed ending line number")
    bases: List[str] = Field(default_factory=list, description="Superclass base names for ClassDef nodes")

    @property
    def file_path(self) -> str:
        return self.filePath

    @property
    def ast_node_type(self) -> str:
        return self.astNodeType

    @property
    def start_line(self) -> int:
        return self.startLine

    @property
    def end_line(self) -> int:
        return self.endLine


class StrataEdge(BaseModel):
    """3D Strata Graph Edge representing a dependency call reference."""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Caller AST chunk ID")
    target: str = Field(..., description="Callee AST chunk ID")
    callName: str = Field(..., description="Invoked function or method name")
    edgeType: str = Field(default="call", description="Edge relationship kind: 'call' or 'inherits'")

    @property
    def call_name(self) -> str:
        return self.callName


class StrataTierInfo(BaseModel):
    """Metadata defining an architectural stratum tier."""
    model_config = ConfigDict(populate_by_name=True)

    tier: int = Field(..., ge=0, le=3, description="Tier index (0 to 3)")
    name: str = Field(..., description="Display name of architectural stratum")
    description: str = Field(..., description="Summary of components residing in this stratum")
    color: Optional[str] = Field(default=None, description="Hex color token for 3D visual styling")
    node_count: int = Field(default=0, description="Count of nodes in this tier")
    nodeCount: int = Field(default=0, description="CamelCase alias for frontend compatibility")

    @model_validator(mode="after")
    def sync_node_counts(self) -> "StrataTierInfo":
        if self.nodeCount == 0 and self.node_count != 0:
            self.nodeCount = self.node_count
        elif self.node_count == 0 and self.nodeCount != 0:
            self.node_count = self.nodeCount
        return self


class StrataGraphResponse(BaseModel):
    """Response payload for GET /api/v1/repos/{repo_id}/strata-graph."""
    model_config = ConfigDict(populate_by_name=True)

    repo_id: str = Field(..., description="Repository identifier")
    repoId: Optional[str] = Field(default=None, description="CamelCase alias for frontend compatibility")
    nodes: List[StrataNode] = Field(default_factory=list, description="List of AST symbol nodes with tier assignment")
    edges: List[StrataEdge] = Field(default_factory=list, description="List of dependency call edges")
    tiers: List[StrataTierInfo] = Field(default_factory=list, description="Architectural tier metadata definitions")
    total_nodes: int = Field(default=0, description="Total number of nodes")
    totalNodes: int = Field(default=0, description="CamelCase alias for frontend compatibility")
    total_edges: int = Field(default=0, description="Total number of edges")
    totalEdges: int = Field(default=0, description="CamelCase alias for frontend compatibility")

    @model_validator(mode="after")
    def sync_aliases(self) -> "StrataGraphResponse":
        if not self.repoId:
            self.repoId = self.repo_id
        if self.totalNodes == 0 and self.total_nodes != 0:
            self.totalNodes = self.total_nodes
        elif self.total_nodes == 0 and self.totalNodes != 0:
            self.total_nodes = self.totalNodes
        if self.totalEdges == 0 and self.total_edges != 0:
            self.totalEdges = self.total_edges
        elif self.total_edges == 0 and self.totalEdges != 0:
            self.total_edges = self.totalEdges
        return self
