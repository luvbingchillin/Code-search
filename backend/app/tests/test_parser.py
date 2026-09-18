"""Unit tests for AST Extraction Pipeline and Codebase Scanner.

Validates compliance with Milestone 1 requirements:
- Tree-sitter 0.26 / Python 0.25 compatibility
- Frontend contract matching (AstCodeChunk, AstNodeType)
- Synchronous, asynchronous, class, method, and nested definition extraction
- Docstring cleansing, parameter parsing, decorator handling, and 1-indexed coordinates
- Invariant: len(code.split('\n')) == (endLine - startLine + 1)
- Resilient error handling and directory scanning
"""

import os
import tempfile
from pathlib import Path
from typing import List

import pytest
from pydantic import ValidationError

from app.models.chunk import AstCodeChunk, AstNodeType
from app.parser.extractor import PythonAstExtractor
from app.parser.scanner import CodebaseScanner


# =====================================================================
# 1. AstCodeChunk Pydantic Model Tests
# =====================================================================

def test_chunk_model_validation_valid():
    """Test instantiating AstCodeChunk with valid fields matching frontend schema."""
    chunk = AstCodeChunk(
        id="sample/utils.py:calculate:10",
        filePath="sample/utils.py",
        fileName="utils.py",
        astNodeType="FunctionDef",
        identifier="calculate",
        startLine=10,
        endLine=15,
        code="def calculate(x: int) -> int:\n    return x * 2",
        relevanceScore=0.95,
        docstring="Double the input.",
        parameters=["x: int"],
        decorators=["@cache"],
        language="python",
        repoFullName="local",
        summary="Double the input.",
        imports=["functools"],
        calls=["cache"],
    )

    assert chunk.id == "sample/utils.py:calculate:10"
    assert chunk.filePath == "sample/utils.py"
    assert chunk.fileName == "utils.py"
    assert chunk.astNodeType == "FunctionDef"
    assert chunk.identifier == "calculate"
    assert chunk.startLine == 10
    assert chunk.endLine == 15
    assert chunk.relevanceScore == 0.95
    assert chunk.docstring == "Double the input."
    assert chunk.parameters == ["x: int"]
    assert chunk.decorators == ["@cache"]
    assert chunk.language == "python"

    # Verify snake_case property accessors
    assert chunk.file_path == chunk.filePath
    assert chunk.file_name == chunk.fileName
    assert chunk.ast_node_type == chunk.astNodeType
    assert chunk.start_line == chunk.startLine
    assert chunk.end_line == chunk.endLine
    assert chunk.relevance_score == chunk.relevanceScore


def test_chunk_model_invalid_line_range():
    """Test that endLine < startLine raises a validation error."""
    with pytest.raises(ValidationError):
        AstCodeChunk(
            id="test:fn:10",
            filePath="test.py",
            fileName="test.py",
            astNodeType="FunctionDef",
            identifier="fn",
            startLine=10,
            endLine=5,  # Invalid: endLine < startLine
            code="def fn(): pass",
        )


def test_chunk_model_serialization_matches_frontend():
    """Test that model_dump produces keys matching frontend interface exactly."""
    chunk = AstCodeChunk(
        id="a.py:f:1",
        filePath="a.py",
        fileName="a.py",
        astNodeType="FunctionDef",
        identifier="f",
        startLine=1,
        endLine=2,
        code="def f():\n    pass",
    )
    dumped = chunk.model_dump()
    expected_keys = {
        "id", "filePath", "fileName", "astNodeType", "identifier",
        "startLine", "endLine", "code", "relevanceScore", "docstring",
        "parameters", "decorators", "language", "repoFullName",
        "summary", "imports", "calls",
    }
    assert expected_keys.issubset(set(dumped.keys()))


# =====================================================================
# 2. PythonAstExtractor: Functions & Async Functions
# =====================================================================

def test_extract_simple_sync_function():
    """Test extracting a standard synchronous function with docstring and params."""
    code = (
        "def compute_sum(a: int, b: int = 10) -> int:\n"
        '    """Compute the sum of two integers."""\n'
        "    return a + b\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="math_ops.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.astNodeType == "FunctionDef"
    assert chunk.identifier == "compute_sum"
    assert chunk.startLine == 1
    assert chunk.endLine == 3
    assert chunk.docstring == "Compute the sum of two integers."
    assert chunk.summary == "Compute the sum of two integers."
    assert chunk.parameters == ["a: int", "b: int = 10"]
    assert chunk.decorators == []
    assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)


def test_extract_async_function():
    """Test extracting an asynchronous function (async def)."""
    code = (
        "async def fetch_user_data(user_id: str) -> dict:\n"
        '    """Fetch user record asynchronously."""\n'
        "    await asyncio.sleep(0.1)\n"
        '    return {"id": user_id}\n'
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="service.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.astNodeType == "AsyncFunctionDef"
    assert chunk.identifier == "fetch_user_data"
    assert chunk.startLine == 1
    assert chunk.endLine == 4
    assert chunk.docstring == "Fetch user record asynchronously."
    assert chunk.parameters == ["user_id: str"]
    assert "asyncio.sleep" in chunk.calls
    assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)


def test_extract_empty_and_pass_functions():
    """Test functions containing only pass or ellipsis."""
    code = (
        "def pass_fn():\n"
        "    pass\n"
        "\n"
        "def ellipsis_fn():\n"
        "    ...\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="empty.py")

    assert len(chunks) == 2
    assert chunks[0].identifier == "pass_fn"
    assert chunks[0].docstring is None
    assert chunks[0].startLine == 1
    assert chunks[0].endLine == 2

    assert chunks[1].identifier == "ellipsis_fn"
    assert chunks[1].docstring is None
    assert chunks[1].startLine == 4
    assert chunks[1].endLine == 5


# =====================================================================
# 3. PythonAstExtractor: Classes & Methods
# =====================================================================

def test_extract_class_and_methods():
    """Test class definition and method extraction with ClassName.method qualified names."""
    code = (
        "class OrderService:\n"
        '    """Handles customer orders."""\n'
        "\n"
        "    def __init__(self, db_client: Any):\n"
        '        """Initialize database client."""\n'
        "        self.db = db_client\n"
        "\n"
        "    def create_order(self, customer_id: str, amount: float) -> str:\n"
        '        """Create a new order."""\n'
        '        return "order-123"\n'
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="orders.py")

    assert len(chunks) == 3

    # Class chunk
    cls_chunk = chunks[0]
    assert cls_chunk.astNodeType == "ClassDef"
    assert cls_chunk.identifier == "OrderService"
    assert cls_chunk.startLine == 1
    assert cls_chunk.endLine == 10
    assert cls_chunk.docstring == "Handles customer orders."
    assert cls_chunk.parameters == []

    # __init__ method chunk
    init_chunk = chunks[1]
    assert init_chunk.astNodeType == "FunctionDef"
    assert init_chunk.identifier == "OrderService.__init__"
    assert init_chunk.startLine == 4
    assert init_chunk.endLine == 6
    assert init_chunk.docstring == "Initialize database client."
    assert init_chunk.parameters == ["self", "db_client: Any"]

    # create_order method chunk
    method_chunk = chunks[2]
    assert method_chunk.astNodeType == "FunctionDef"
    assert method_chunk.identifier == "OrderService.create_order"
    assert method_chunk.startLine == 8
    assert method_chunk.endLine == 10
    assert method_chunk.parameters == ["self", "customer_id: str", "amount: float"]


def test_extract_nested_class_and_closures():
    """Test nested classes (Outer.Inner) and closures (outer.inner)."""
    code = (
        "class Outer:\n"
        "    class Inner:\n"
        '        """Nested inner class."""\n'
        "        def inner_method(self):\n"
        "            pass\n"
        "\n"
        "def outer_fn():\n"
        "    def inner_closure():\n"
        "        return 42\n"
        "    return inner_closure()\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="nested.py")

    identifiers = [c.identifier for c in chunks]
    assert "Outer" in identifiers
    assert "Outer.Inner" in identifiers
    assert "Outer.Inner.inner_method" in identifiers
    assert "outer_fn" in identifiers
    assert "outer_fn.inner_closure" in identifiers

    inner_cls = next(c for c in chunks if c.identifier == "Outer.Inner")
    assert inner_cls.astNodeType == "ClassDef"
    assert inner_cls.docstring == "Nested inner class."


# =====================================================================
# 4. Decorators & Multiline Definitions
# =====================================================================

def test_extract_decorators_and_line_alignment():
    """Test single, stacked, and multiline decorators."""
    code = (
        "@app.get(\n"
        '    "/items/{item_id}",\n'
        "    response_model=Item\n"
        ")\n"
        "@auth_required\n"
        "async def get_item(item_id: int) -> Item:\n"
        '    """Retrieve item by ID."""\n'
        "    return Item(id=item_id)\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="routes.py")

    # Ensure no duplicate extraction (should be exactly 1 chunk)
    assert len(chunks) == 1
    chunk = chunks[0]

    assert chunk.astNodeType == "AsyncFunctionDef"
    assert chunk.identifier == "get_item"
    assert chunk.startLine == 1  # Must start on the first decorator line
    assert chunk.endLine == 8
    assert len(chunk.decorators) == 2
    assert chunk.decorators[0].startswith("@app.get")
    assert chunk.decorators[1] == "@auth_required"
    assert chunk.docstring == "Retrieve item by ID."
    assert chunk.parameters == ["item_id: int"]

    # Verify line invariant
    assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)
    # Verbatim code should start with the decorator
    assert chunk.code.startswith("@app.get(")


def test_decorated_class_method():
    """Test class method with @classmethod and @staticmethod decorators."""
    code = (
        "class Factory:\n"
        "    @classmethod\n"
        "    def create(cls, mode: str):\n"
        '        """Create instance."""\n'
        "        return cls()\n"
        "\n"
        "    @staticmethod\n"
        "    def helper():\n"
        "        return True\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="factory.py")

    assert len(chunks) == 3
    create_fn = next(c for c in chunks if c.identifier == "Factory.create")
    assert create_fn.decorators == ["@classmethod"]
    assert create_fn.startLine == 2
    assert create_fn.endLine == 5

    helper_fn = next(c for c in chunks if c.identifier == "Factory.helper")
    assert helper_fn.decorators == ["@staticmethod"]
    assert helper_fn.startLine == 7
    assert helper_fn.endLine == 9


# =====================================================================
# 5. Parameter Parsing & Edge Cases
# =====================================================================

def test_extract_complex_parameters():
    """Test positional-only (/), keyword-only (*), *args, and **kwargs."""
    code = (
        "def complex_signature(\n"
        "    pos_only,\n"
        "    /,\n"
        "    standard: int = 1,\n"
        "    *args: str,\n"
        "    kw_only: bool = True,\n"
        "    **kwargs: Any\n"
        ") -> None:\n"
        "    pass\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="params.py")

    assert len(chunks) == 1
    params = chunks[0].parameters
    # '/' and '*' must NOT be included as parameters
    assert "/" not in params
    assert "*" not in params
    assert "pos_only" in params
    assert "standard: int = 1" in params
    assert "*args: str" in params
    assert "kw_only: bool = True" in params
    assert "**kwargs: Any" in params


# =====================================================================
# 6. Docstring Cleansing
# =====================================================================

def test_extract_docstrings_various_formats():
    """Test triple double, triple single, single line, and raw docstrings."""
    code = (
        'def fn_triple_double():\n'
        '    """Triple double quote.\n'
        '    Second line.\n'
        '    """\n'
        '    pass\n'
        '\n'
        "def fn_triple_single():\n"
        "    '''Triple single quote.'''\n"
        "    pass\n"
        '\n'
        'def fn_single_line():\n'
        '    "Single line doc."\n'
        '    pass\n'
        '\n'
        'def fn_raw_doc():\n'
        '    r"""Raw docstring with \\d+ digits."""\n'
        '    pass\n'
        '\n'
        'def fn_no_doc():\n'
        '    x = 10\n'
        '    return x\n'
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="docs.py")

    doc_map = {c.identifier: c.docstring for c in chunks}
    assert doc_map["fn_triple_double"] == "Triple double quote.\nSecond line."
    assert doc_map["fn_triple_single"] == "Triple single quote."
    assert doc_map["fn_single_line"] == "Single line doc."
    assert "Raw docstring with" in (doc_map["fn_raw_doc"] or "")
    assert doc_map["fn_no_doc"] is None


# =====================================================================
# 7. Coordinates & Indentation Preservation
# =====================================================================

def test_code_slice_preserves_indentation():
    """Test that methods preserve their column 0 indentation in code."""
    code = (
        "class Container:\n"
        "    def indented_method(self):\n"
        "        x = 1\n"
        "        return x\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="container.py")

    method = next(c for c in chunks if c.identifier == "Container.indented_method")
    # First line should have leading 4 spaces preserved
    assert method.code.startswith("    def indented_method(self):")
    lines = method.code.split("\n")
    assert len(lines) == (method.endLine - method.startLine + 1)


# =====================================================================
# 8. Imports and Calls Extraction
# =====================================================================

def test_extract_imports_and_calls():
    """Test extracting file-level imports and function calls within body."""
    code = (
        "import os\n"
        "import sys.path as sp\n"
        "from typing import List, Optional\n"
        "from .models import Item\n"
        "\n"
        "def process():\n"
        "    a = max([1, 2, 3])\n"
        "    b = round(3.1415, 2)\n"
        "    os.path.join('a', 'b')\n"
        "    return a\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="pipeline.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert "os" in chunk.imports
    assert "typing" in chunk.imports
    assert ".models" in chunk.imports

    assert "max" in chunk.calls
    assert "round" in chunk.calls
    assert "os.path.join" in chunk.calls


# =====================================================================
# 9. Error Resilience
# =====================================================================

def test_error_resilience_malformed_syntax():
    """Test that tree-sitter tolerates syntax errors without throwing exceptions."""
    corrupted_code = (
        "def broken_function(\n"  # Unclosed syntax error
        "    x, : int\n"
        "\n"
        "def valid_function(y: int) -> int:\n"
        '    """This function is well-formed."""\n'
        "    return y * 2\n"
    )
    extractor = PythonAstExtractor()
    # Must not raise an unhandled exception
    chunks = extractor.parse_source(corrupted_code, file_path="broken.py")

    # Should successfully extract the valid function
    identifiers = [c.identifier for c in chunks]
    assert "valid_function" in identifiers
    valid_fn = next(c for c in chunks if c.identifier == "valid_function")
    assert valid_fn.docstring == "This function is well-formed."


# =====================================================================
# 10. Sample Codebase & CodebaseScanner Tests
# =====================================================================

def test_sample_service_full_extraction():
    """Verify end-to-end AST extraction on backend/sample_codebase/sample_service.py."""
    sample_file = Path(__file__).resolve().parent.parent.parent / "sample_codebase" / "sample_service.py"
    assert sample_file.exists(), f"Sample file not found at: {sample_file}"

    extractor = PythonAstExtractor()
    chunks = extractor.parse_file(str(sample_file))

    assert len(chunks) == 24

    # Check unique deterministic IDs
    ids = [c.id for c in chunks]
    assert len(ids) == len(set(ids)), "Chunk IDs must be strictly unique"

    # Check line invariants for all chunks
    for chunk in chunks:
        line_count = len(chunk.code.split("\n"))
        expected_count = chunk.endLine - chunk.startLine + 1
        assert line_count == expected_count, (
            f"Line count mismatch in {chunk.identifier}: "
            f"code lines={line_count} != expected={expected_count} ({chunk.startLine}-{chunk.endLine})"
        )

    # Check key entities
    chunk_map = {c.identifier: c for c in chunks}
    assert "calculate_statistics" in chunk_map
    assert "fetch_remote_resource" in chunk_map
    assert "BaseEntity" in chunk_map
    assert "DataProcessingService" in chunk_map
    assert "DataProcessingService.transform_batch" in chunk_map
    assert "DataProcessingService.process_stream" in chunk_map
    assert "DataProcessingService.ProcessingConfig" in chunk_map

    # Check that async functions have correct node type
    assert chunk_map["fetch_remote_resource"].astNodeType == "AsyncFunctionDef"
    assert chunk_map["DataProcessingService.process_stream"].astNodeType == "AsyncFunctionDef"

    # Check classes
    assert chunk_map["BaseEntity"].astNodeType == "ClassDef"
    assert chunk_map["DataProcessingService"].astNodeType == "ClassDef"
    assert chunk_map["DataProcessingService.ProcessingConfig"].astNodeType == "ClassDef"


def test_codebase_scanner_directory_scan():
    """Test CodebaseScanner directory scanning and exclusion filtering."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # Create valid python files
        file1 = tmp_path / "mod1.py"
        file1.write_text("def fn1(): pass\n", encoding="utf-8")

        sub_dir = tmp_path / "pkg"
        sub_dir.mkdir()
        file2 = sub_dir / "mod2.py"
        file2.write_text("class Cls2:\n    def method(self): pass\n", encoding="utf-8")

        # Create excluded directory and file
        venv_dir = tmp_path / ".venv"
        venv_dir.mkdir()
        ignored_file = venv_dir / "ignored.py"
        ignored_file.write_text("def ignored(): pass\n", encoding="utf-8")

        scanner = CodebaseScanner()
        py_files = scanner.find_python_files(tmp_dir)

        # Ensure .venv is excluded
        assert not any(".venv" in p for p in py_files)
        assert len(py_files) == 2

        chunks = scanner.scan_directory(tmp_dir)
        identifiers = {c.identifier for c in chunks}
        assert "fn1" in identifiers
        assert "Cls2" in identifiers
        assert "Cls2.method" in identifiers
        assert "ignored" not in identifiers
