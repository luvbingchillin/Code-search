import { AstCodeChunk } from '../types';

export const mockAstChunks: AstCodeChunk[] = [
  {
    id: 'chunk-fastapi-solve-deps',
    filePath: 'fastapi/dependencies/utils.py',
    fileName: 'utils.py',
    astNodeType: 'FunctionDef',
    identifier: 'solve_dependencies',
    startLine: 450,
    endLine: 520,
    language: 'python',
    repoFullName: 'fastapi/fastapi',
    relevanceScore: 0.96,
    docstring: 'Solves dependency injection tree for a given endpoint request, recursively resolving sub-dependencies.',
    parameters: [
      'request: Union[Request, WebSocket]',
      'dependant: Dependant',
      'body: Optional[Union[Dict[str, Any], FormData]] = None',
      'background_tasks: Optional[BackgroundTasks] = None',
      'response: Optional[Response] = None',
      'dependency_overrides_provider: Optional[Any] = None',
      'async_exit_stack: AsyncExitStack',
    ],
    decorators: ['@asynccontextmanager'],
    imports: ['inspect', 'typing', 'fastapi.params'],
    calls: ['get_param_sub_dependant', 'solve_dependencies'],
    summary: 'Recursive async dependency injection resolver for FastAPI routes.',
    code: `async def solve_dependencies(
    *,
    request: Union[Request, WebSocket],
    dependant: Dependant,
    body: Optional[Union[Dict[str, Any], FormData]] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    response: Optional[Response] = None,
    dependency_overrides_provider: Optional[Any] = None,
    async_exit_stack: AsyncExitStack,
) -> Tuple[
    Dict[str, Any], List[Any], Optional[BackgroundTasks], Response, Dict[Tuple[Callable[..., Any], str], Any]
]:
    """Solves dependency injection tree for a given endpoint request."""
    values: Dict[str, Any] = {}
    errors: List[Any] = []
    
    # Traverse sub-dependencies recursively
    for sub_dependant in dependant.dependencies:
        sub_values, sub_errors, _, _, _ = await solve_dependencies(
            request=request,
            dependant=sub_dependant,
            async_exit_stack=async_exit_stack,
        )
        values.update(sub_values)
        errors.extend(sub_errors)
        
    return values, errors, background_tasks, response, {}`,
  },
  {
    id: 'chunk-fastapi-ws-endpoint',
    filePath: 'fastapi/websockets.py',
    fileName: 'websockets.py',
    astNodeType: 'ClassDef',
    identifier: 'WebSocketEndpoint',
    startLine: 25,
    endLine: 68,
    language: 'python',
    repoFullName: 'fastapi/fastapi',
    relevanceScore: 0.91,
    docstring: 'Base class for WebSocket endpoints managing protocol handshakes and lifecycle callbacks.',
    parameters: ['scope: Scope', 'receive: Receive', 'send: Send'],
    decorators: [],
    imports: ['starlette.websockets', 'typing'],
    calls: ['websocket.accept', 'websocket.receive_text', 'websocket.send_text'],
    summary: 'Full-duplex WebSocket endpoint class implementation.',
    code: `class WebSocketEndpoint:
    encoding = None

    def __init__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self.scope = scope
        self.receive = receive
        self.send = send

    async def on_connect(self, websocket: WebSocket) -> None:
        await websocket.accept()

    async def on_receive(self, websocket: WebSocket, data: Any) -> None:
        pass

    async def on_disconnect(self, websocket: WebSocket, close_code: int) -> None:
        pass`,
  },
  {
    id: 'chunk-langchain-text-splitter',
    filePath: 'langchain_text_splitters/character.py',
    fileName: 'character.py',
    astNodeType: 'ClassDef',
    identifier: 'RecursiveCharacterTextSplitter',
    startLine: 32,
    endLine: 85,
    language: 'python',
    repoFullName: 'langchain-ai/langchain',
    relevanceScore: 0.98,
    docstring: 'Splitting text by recursively looking at characters, preserving language-specific semantics.',
    parameters: [
      'separators: Optional[List[str]] = None',
      'keep_separator: bool = True',
      'is_separator_regex: bool = False',
    ],
    decorators: [],
    imports: ['re', 'typing', 'langchain.text_splitter.base'],
    calls: ['_split_text_with_regex'],
    summary: 'Language-aware recursive character text splitter.',
    code: `class RecursiveCharacterTextSplitter(TextSplitter):
    def __init__(
        self,
        separators: Optional[List[str]] = None,
        keep_separator: bool = True,
        is_separator_regex: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._separators = separators or ["\\n\\n", "\\n", " ", ""]
        self._is_separator_regex = is_separator_regex

    def split_text(self, text: str) -> List[str]:
        return self._split_text(text, self._separators)`,
  },
  {
    id: 'chunk-auth-01',
    filePath: 'src/services/auth_service.py',
    fileName: 'auth_service.py',
    astNodeType: 'FunctionDef',
    identifier: 'verify_jwt_token',
    startLine: 45,
    endLine: 62,
    language: 'python',
    repoFullName: 'demo/security',
    relevanceScore: 0.95,
    docstring: 'Verifies JWT signature and extracts token payload with expiration verification.',
    parameters: ['token: str', 'secret_key: str'],
    decorators: ['@rate_limit(max_requests=100)'],
    imports: ['jwt', 'datetime'],
    calls: ['jwt.decode'],
    summary: 'JWT token decoder with cryptographic signature check.',
    code: `def verify_jwt_token(token: str, secret_key: str) -> dict:
    """Verifies JWT signature and extracts token payload."""
    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return {"valid": True, "claims": payload}
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "Token expired"}
    except jwt.InvalidTokenError:
        return {"valid": False, "error": "Invalid token"}`,
  },
  {
    id: 'chunk-db-02',
    filePath: 'src/database/connection_pool.py',
    fileName: 'connection_pool.py',
    astNodeType: 'ClassDef',
    identifier: 'AsyncDatabasePool',
    startLine: 110,
    endLine: 145,
    language: 'python',
    repoFullName: 'demo/database',
    relevanceScore: 0.89,
    docstring: 'Manages asynchronous database connection pooling with health monitoring.',
    parameters: ['dsn: str', 'min_size: int = 5', 'max_size: int = 20'],
    decorators: ['@singleton'],
    imports: ['asyncpg', 'asyncio'],
    calls: ['asyncpg.create_pool'],
    summary: 'Asyncpg connection pool lifecycle manager.',
    code: `class AsyncDatabasePool:
    """Manages asynchronous database connection pooling."""
    def __init__(self, dsn: str, min_size: int = 5, max_size: int = 20):
        self.dsn = dsn
        self.min_size = min_size
        self.max_size = max_size
        self._pool = None

    async def initialize(self):
        self._pool = await asyncpg.create_pool(
            self.dsn,
            min_size=self.min_size,
            max_size=self.max_size
        )
        return self._pool`,
  },
];
