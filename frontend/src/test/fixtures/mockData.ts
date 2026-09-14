import { AstCodeChunk } from '../../types';

export const mockAstChunks: AstCodeChunk[] = [
  {
    id: 'chunk-auth-01',
    filePath: 'src/services/auth_service.py',
    fileName: 'auth_service.py',
    astNodeType: 'FunctionDef',
    identifier: 'verify_jwt_token',
    startLine: 45,
    endLine: 62,
    code: `def verify_jwt_token(token: str, secret_key: str) -> dict:
    """Verifies JWT signature and extracts token payload."""
    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return {"valid": True, "claims": payload}
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "Token expired"}
    except jwt.InvalidTokenError:
        return {"valid": False, "error": "Invalid token"}`,
    relevanceScore: 0.96,
    docstring: 'Verifies JWT signature and extracts token payload.',
    parameters: ['token: str', 'secret_key: str'],
    decorators: ['@rate_limit(max_requests=100)'],
  },
  {
    id: 'chunk-db-02',
    filePath: 'src/database/connection_pool.py',
    fileName: 'connection_pool.py',
    astNodeType: 'ClassDef',
    identifier: 'AsyncDatabasePool',
    startLine: 110,
    endLine: 145,
    code: `class AsyncDatabasePool:
    """Manages asynchronous database connection pooling."""
    def __init__(self, dsn: str, min_size: int = 5, max_size: int = 20):
        self.dsn = dsn
        self.min_size = min_size
        self.max_size = max_size
        self._pool = None

    async def initialize(self):
        self._pool = await asyncpg.create_pool(self.dsn, min_size=self.min_size, max_size=self.max_size)
        return self._pool`,
    relevanceScore: 0.88,
    docstring: 'Manages asynchronous database connection pooling.',
    decorators: ['@singleton'],
  },
];
