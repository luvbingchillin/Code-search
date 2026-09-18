"""AST Code Chunk data model conforming to frontend contract."""

from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

AstNodeType = Literal['FunctionDef', 'AsyncFunctionDef', 'ClassDef', 'Module', 'Assign']


class AstCodeChunk(BaseModel):
    """Pydantic model representing an extracted AST code chunk.
    
    Conforms directly to the frontend TypeScript interface defined in
    frontend/src/types/index.ts.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique deterministic identifier, e.g. 'filePath:identifier:startLine'")
    filePath: str = Field(..., description="Normalized relative file path (forward slashes)")
    fileName: str = Field(..., description="Base file name, e.g. 'utils.py'")
    astNodeType: AstNodeType = Field(..., description="AST node classification")
    identifier: str = Field(..., description="Function name, class name, or qualified method name")
    startLine: int = Field(..., ge=1, description="1-indexed starting line number (includes decorators)")
    endLine: int = Field(..., ge=1, description="1-indexed ending line number")
    code: str = Field(..., description="Complete verbatim source code of the AST node")
    relevanceScore: float = Field(default=0.0, ge=0.0, le=1.0, description="Relevance score for retrieval")
    docstring: Optional[str] = Field(default=None, description="Cleaned docstring text without quotes")
    parameters: Optional[List[str]] = Field(default_factory=list, description="Extracted parameter signatures")
    decorators: Optional[List[str]] = Field(default_factory=list, description="Decorator declarations starting with @")
    language: Optional[str] = Field(default="python", description="Programming language")
    repoFullName: Optional[str] = Field(default="local", description="Repository name or source identifier")
    summary: Optional[str] = Field(default=None, description="Concise summary (e.g. first line of docstring)")
    imports: Optional[List[str]] = Field(default_factory=list, description="Imports found in scope/file")
    calls: Optional[List[str]] = Field(default_factory=list, description="Function/method calls made inside body")

    @model_validator(mode="after")
    def validate_line_range(self) -> "AstCodeChunk":
        if self.endLine < self.startLine:
            raise ValueError(f"endLine ({self.endLine}) cannot be less than startLine ({self.startLine})")
        return self

    # Convenience snake_case accessors for Pythonic backend code
    @property
    def file_path(self) -> str:
        return self.filePath

    @property
    def file_name(self) -> str:
        return self.fileName

    @property
    def ast_node_type(self) -> AstNodeType:
        return self.astNodeType

    @property
    def start_line(self) -> int:
        return self.startLine

    @property
    def end_line(self) -> int:
        return self.endLine

    @property
    def relevance_score(self) -> float:
        return self.relevanceScore

    @property
    def repo_full_name(self) -> Optional[str]:
        return self.repoFullName
