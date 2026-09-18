# Generative Code Retrieval Backend

Offline Python Ingestion and Retrieval Backend for the Generative Code Retrieval Search Engine.

## Modules

- `app.models`: Pydantic V2 data models (`AstCodeChunk`, `AstNodeType`) conforming to the frontend TypeScript contract.
- `app.parser`: Tree-sitter 0.26 / Python 0.25 AST extractor (`PythonAstExtractor`) and directory scanner (`CodebaseScanner`).
- `sample_codebase`: Representative Python codebase fixture for integration testing and AST verification.
- `app.tests`: Pytest test suite covering AST parsing, edge cases, and directory scanning.

## Running Tests

From project root:
```bash
pytest backend/app/tests/test_parser.py -v
```

Or from `backend/`:
```bash
pytest -v
```
