"""Boundary & Differential Invariant Verification Suite for M1 Challenger 2.

Comprehensive adversarial test harness:
1. Invariant: len(chunk.code.split('\n')) == (chunk.endLine - chunk.startLine + 1)
2. Differential Oracle: stdlib ast.parse comparison across multiple standard library modules
3. Edge Cases:
   - empty, whitespace, comment-only files
   - CRLF, LF, mixed line endings
   - no trailing newline at EOF
   - comments between decorators and inside functions
   - single-line definitions
   - functions separated by variable blank lines
   - multiline parameters and complex type hints
   - PEP 3131 non-ASCII Unicode identifiers (Chinese, Greek, Cyrillic, accented Latin)
   - Unicode in docstrings, strings, and comments (including emojis)
   - Property getters and setters with identical identifiers
   - Deeply nested structures (classes in classes in functions)
   - Malformed/syntax error files and error recovery
   - Python 3.10+ match/case, async generators, and complex syntax
"""

import ast
import inspect
import os
import sys
from pathlib import Path
from typing import List, Set, Tuple

import pytest

from app.models.chunk import AstCodeChunk
from app.parser.extractor import PythonAstExtractor
from app.parser.scanner import CodebaseScanner


# =====================================================================
# Invariant & Oracle Helpers
# =====================================================================

def verify_display_invariant(chunk: AstCodeChunk) -> None:
    """Verify the frontend display invariant for a single chunk."""
    lines = chunk.code.split("\n")
    expected_line_count = chunk.endLine - chunk.startLine + 1
    assert len(lines) == expected_line_count, (
        f"Invariant violation in chunk '{chunk.id}': "
        f"len(code.split('\\n'))={len(lines)} != (endLine={chunk.endLine} - startLine={chunk.startLine} + 1)={expected_line_count}\n"
        f"Code:\n{chunk.code}"
    )


class AstParseOracle:
    """Oracle extracting definitions using stdlib ast module for differential comparison."""

    @staticmethod
    def get_top_level_definitions(source: str) -> List[Tuple[str, str]]:
        """Extract top-level (type, name) tuples: ('FunctionDef'|'AsyncFunctionDef'|'ClassDef', name)."""
        tree = ast.parse(source)
        defs = []
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                defs.append(("FunctionDef", node.name))
            elif isinstance(node, ast.AsyncFunctionDef):
                defs.append(("AsyncFunctionDef", node.name))
            elif isinstance(node, ast.ClassDef):
                defs.append(("ClassDef", node.name))
        return defs

    @staticmethod
    def get_all_definitions_hierarchical(source: str) -> List[Tuple[str, str]]:
        """Extract all definitions with dotted names mirroring PythonAstExtractor qualified names."""
        tree = ast.parse(source)
        results = []

        def walk_body(body_nodes, prefix: str):
            for node in body_nodes:
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    name = f"{prefix}.{node.name}" if prefix else node.name
                    node_type = (
                        "ClassDef" if isinstance(node, ast.ClassDef)
                        else ("AsyncFunctionDef" if isinstance(node, ast.AsyncFunctionDef) else "FunctionDef")
                    )
                    results.append((node_type, name))
                    walk_body(node.body, name)

        walk_body(tree.body, "")
        return results


# =====================================================================
# 1. Project Invariant Tests
# =====================================================================

def test_invariant_on_existing_project_files():
    """Verify invariant on all Python files currently in the backend project."""
    scanner = CodebaseScanner()
    chunks = scanner.scan_directory("backend")
    assert len(chunks) > 0, "Expected chunks to be extracted from backend"
    for chunk in chunks:
        verify_display_invariant(chunk)


def test_invariant_on_sample_service():
    """Verify invariant across all 24 entities in sample_service.py."""
    extractor = PythonAstExtractor()
    chunks = extractor.parse_file("backend/sample_codebase/sample_service.py")
    assert len(chunks) == 24
    for chunk in chunks:
        verify_display_invariant(chunk)


# =====================================================================
# 2. Line Ending & Boundary Stress Tests
# =====================================================================

@pytest.mark.parametrize("line_ending", ["\n", "\r\n"])
def test_invariant_across_line_endings(line_ending: str):
    """Test invariant holds with both UNIX (LF) and Windows (CRLF) line endings."""
    code_raw = (
        "class Calculator:\n"
        '    """A simple calculator."""\n'
        "\n"
        "    def add(self, a: int, b: int) -> int:\n"
        '        """Add two numbers."""\n'
        "        return a + b\n"
        "\n"
        "    @classmethod\n"
        "    def create(cls):\n"
        "        return cls()\n"
    )
    code = code_raw.replace("\n", line_ending)
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="calc.py")

    assert len(chunks) == 3
    for chunk in chunks:
        verify_display_invariant(chunk)

    calc_chunk = next(c for c in chunks if c.identifier == "Calculator")
    add_chunk = next(c for c in chunks if c.identifier == "Calculator.add")
    create_chunk = next(c for c in chunks if c.identifier == "Calculator.create")

    assert calc_chunk.startLine == 1
    assert add_chunk.identifier == "Calculator.add"
    assert "@classmethod" in create_chunk.decorators


def test_mixed_line_endings():
    """Test file with mixed LF and CRLF line endings."""
    code = "def f():\r\n    x = 1\n    return x\r\n\ndef g():\n    return 2\r\n"
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="mixed.py")

    assert len(chunks) == 2
    for chunk in chunks:
        verify_display_invariant(chunk)


def test_no_trailing_newline():
    """Test function at end of file without trailing newline."""
    code = "def f(x):\n    return x * 2"
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="no_newline.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.startLine == 1
    assert chunk.endLine == 2
    verify_display_invariant(chunk)


def test_single_line_definitions():
    """Test single line function and class definitions."""
    code = "def single_fn(): pass\nclass SingleClass: pass\ndef compute(x): return x + 1\n"
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="single.py")

    assert len(chunks) == 3
    for chunk in chunks:
        assert chunk.startLine == chunk.endLine
        verify_display_invariant(chunk)


def test_functions_separated_by_various_blank_lines():
    """Test functions separated by multiple variable blank lines."""
    code = (
        "def first():\n"
        "    pass\n"
        "\n"
        "\n"
        "\n"
        "def second():\n"
        "    pass\n"
        "\n\n\n\n\n"
        "def third():\n"
        "    pass\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="blanks.py")

    assert len(chunks) == 3
    assert chunks[0].startLine == 1
    assert chunks[0].endLine == 2
    assert chunks[1].startLine == 6
    assert chunks[1].endLine == 7
    assert chunks[2].startLine == 13
    assert chunks[2].endLine == 14
    for chunk in chunks:
        verify_display_invariant(chunk)


def test_comments_immediately_after_functions():
    """Test functions followed immediately by comments without blank lines."""
    code = (
        "def first():\n"
        "    return 1\n"
        "# Comment right after first\n"
        "def second():\n"
        "    return 2\n"
        "# Comment right after second\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="comments_after.py")

    assert len(chunks) == 2
    assert chunks[0].startLine == 1
    assert chunks[0].endLine == 2
    assert chunks[1].startLine == 4
    assert chunks[1].endLine == 5
    for chunk in chunks:
        verify_display_invariant(chunk)


def test_comments_between_decorators():
    """Test function with comments between multiple decorators."""
    code = (
        "@decorator_one\n"
        "# Intermediate comment explaining next decorator\n"
        "@decorator_two(option=True)\n"
        "def decorated_with_comments():\n"
        "    return 42\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="dec_comments.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.startLine == 1
    assert chunk.endLine == 5
    assert len(chunk.decorators) == 2
    assert "@decorator_one" in chunk.decorators[0]
    assert "@decorator_two" in chunk.decorators[1]
    verify_display_invariant(chunk)


def test_multiline_signature_and_docstring_variations():
    """Test complex multiline parameter lists, comments inside signature, and docstrings."""
    code = (
        "def complex_signature(\n"
        "    param1: int,\n"
        "    param2: str = 'default',\n"
        "    # intermediate comment\n"
        "    *args: List[Any],\n"
        "    **kwargs: Dict[str, Any],\n"
        ") -> Tuple[int, str]:\n"
        '    """This is a multiline docstring.\n'
        "\n"
        "    With multiple paragraphs.\n"
        '    """\n'
        "    val = param1\n"
        "    return val, param2\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="complex.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.startLine == 1
    assert chunk.endLine == 13
    assert chunk.summary == "This is a multiline docstring."
    verify_display_invariant(chunk)


# =====================================================================
# 3. Edge Case Code Files: Empty, Comments, Unicode
# =====================================================================

def test_empty_files_and_whitespace():
    """Test that empty or whitespace-only code produces empty chunk lists without error."""
    extractor = PythonAstExtractor()
    assert extractor.parse_source("", file_path="empty.py") == []
    assert extractor.parse_source("   \n\t  \n  ", file_path="whitespace.py") == []
    assert extractor.parse_source("\n\n\n", file_path="newlines.py") == []


def test_comment_only_files():
    """Test that comment-only files return empty chunk lists."""
    code = (
        "# This is a Python module comment\n"
        "# Another comment\n"
        "# TODO: Implement logic later\n"
    )
    extractor = PythonAstExtractor()
    assert extractor.parse_source(code, file_path="comments.py") == []


def test_non_ascii_and_unicode_code():
    """Test valid PEP 3131 Unicode identifiers (Chinese, Greek, Cyrillic, Accented Latin) and emojis in docs/comments."""
    code = (
        "# -*- coding: utf-8 -*-\n"
        '"""模块文档：Unicode 支持测试 🚀"""\n'
        "\n"
        "def 计算总和(数字列表: list) -> int:\n"
        '    """计算总和函数说明\n'
        "    支持中文 docstring 和 emoji ✨。\n"
        '    """\n'
        "    # 循环累加 🛰️\n"
        "    总计 = 0\n"
        "    for 数 in 数字列表:\n"
        "        总计 += 数\n"
        "    return 总计\n"
        "\n"
        "class МодельДанных:\n"
        '    """Cyrillic identifier class."""\n'
        "    def parse_résumé(self, texte: str) -> str:\n"
        '        """Accented latin method."""\n'
        "        return texte.strip()\n"
        "\n"
        "def compute_α_β(α: float, β: float) -> float:\n"
        '    """Greek letter identifier function."""\n'
        "    return α * β\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="unicode_test.py")

    assert len(chunks) == 4
    fn_chunk = next(c for c in chunks if c.identifier == "计算总和")
    assert fn_chunk.astNodeType == "FunctionDef"
    assert "计算总和函数说明" in fn_chunk.docstring

    cyrillic_chunk = next(c for c in chunks if c.identifier == "МодельДанных")
    assert cyrillic_chunk.astNodeType == "ClassDef"

    accent_chunk = next(c for c in chunks if c.identifier == "МодельДанных.parse_résumé")
    assert accent_chunk.astNodeType == "FunctionDef"

    greek_chunk = next(c for c in chunks if c.identifier == "compute_α_β")
    assert greek_chunk.astNodeType == "FunctionDef"

    for chunk in chunks:
        verify_display_invariant(chunk)


def test_property_getter_and_setter_distinct_chunks():
    """Test that properties with same identifier produce distinct chunks with correct coordinates."""
    code = (
        "class Temperature:\n"
        "    def __init__(self, celsius: float):\n"
        "        self._celsius = celsius\n"
        "\n"
        "    @property\n"
        "    def celsius(self) -> float:\n"
        '        """Get temperature in celsius."""\n'
        "        return self._celsius\n"
        "\n"
        "    @celsius.setter\n"
        "    def celsius(self, val: float) -> None:\n"
        '        """Set temperature in celsius."""\n'
        "        self._celsius = val\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="temp.py")

    assert len(chunks) == 4
    celsius_chunks = [c for c in chunks if c.identifier == "Temperature.celsius"]
    assert len(celsius_chunks) == 2
    # Ensure they have distinct startLine and unique chunk IDs
    assert celsius_chunks[0].startLine != celsius_chunks[1].startLine
    assert celsius_chunks[0].id != celsius_chunks[1].id
    assert "@property" in celsius_chunks[0].decorators
    assert "@celsius.setter" in celsius_chunks[1].decorators

    for chunk in chunks:
        verify_display_invariant(chunk)


def test_deeply_nested_structures():
    """Test deeply nested classes, methods, and functions."""
    code = (
        "class Level1:\n"
        "    class Level2:\n"
        "        class Level3:\n"
        "            def level3_method(self):\n"
        "                def helper():\n"
        "                    return 99\n"
        "                return helper()\n"
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="nested.py")

    assert len(chunks) == 5
    identifiers = [c.identifier for c in chunks]
    assert "Level1" in identifiers
    assert "Level1.Level2" in identifiers
    assert "Level1.Level2.Level3" in identifiers
    assert "Level1.Level2.Level3.level3_method" in identifiers
    assert "Level1.Level2.Level3.level3_method.helper" in identifiers

    for chunk in chunks:
        verify_display_invariant(chunk)


def test_error_resilience_malformed_input():
    """Test parser resilience on syntax errors: no unhandled exceptions and invariant holds on all extracted chunks."""
    corrupted_inputs = [
        "def unclosed_parens(x, y:\n    pass\n\ndef valid_next():\n    return 42\n",
        "class IncompleteClass:\n",
        "def unclosed_string():\n    s = '''unclosed\n\ndef another(): pass\n",
        "def bad_indent():\nreturn 1\n",
    ]
    extractor = PythonAstExtractor()
    for src in corrupted_inputs:
        # Must not raise unhandled exception
        chunks = extractor.parse_source(src, file_path="corrupted.py")
        # For every chunk that was extracted, display invariant must hold
        for chunk in chunks:
            verify_display_invariant(chunk)


def test_python_310_pattern_matching_and_generators():
    """Test extraction with Python 3.10+ match/case and async generator syntax."""
    code = (
        "async def process_event_stream(events: list) -> AsyncGenerator[str, None]:\n"
        '    """Process events using structural pattern matching."""\n'
        "    for event in events:\n"
        "        match event:\n"
        '            case {"type": "user", "id": uid}:\n'
        '                yield f"user:{uid}"\n'
        '            case {"type": "system", "action": act}:\n'
        '                yield f"sys:{act}"\n'
        "            case _:\n"
        '                yield "unknown"\n'
    )
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(code, file_path="match_case.py")

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.astNodeType == "AsyncFunctionDef"
    assert chunk.identifier == "process_event_stream"
    assert chunk.startLine == 1
    assert chunk.endLine == 10
    verify_display_invariant(chunk)


# =====================================================================
# 4. Differential Testing against Python stdlib ast.parse Oracle
# =====================================================================

@pytest.mark.parametrize("module_name", [
    "ast",
    "inspect",
    "dataclasses",
    "difflib",
    "asyncio.events",
    "functools",
    "json.encoder",
    "contextlib",
    "pathlib",
    "unittest.case",
    "http.client",
    "email.message",
    "tarfile",
    "logging",
    "typing",
    "enum",
    "threading",
    "subprocess",
])
def test_differential_oracle_stdlib_modules(module_name: str):
    """Compare PythonAstExtractor against ast.parse oracle across Python stdlib modules."""
    import importlib
    mod = importlib.import_module(module_name)
    source_file = inspect.getsourcefile(mod)
    assert source_file is not None and os.path.exists(source_file)

    with open(source_file, "r", encoding="utf-8", errors="replace") as f:
        source_text = f.read()

    # 1. Oracle extraction
    oracle_defs = AstParseOracle.get_top_level_definitions(source_text)

    # 2. Tree-sitter extractor
    extractor = PythonAstExtractor()
    chunks = extractor.parse_source(source_text, file_path=f"{module_name}.py")

    # Filter top-level chunks from extractor (no '.' in identifier)
    extracted_top_level = [
        (c.astNodeType, c.identifier)
        for c in chunks
        if "." not in c.identifier
    ]

    # Verify every top-level definition from ast.parse is captured by tree-sitter
    oracle_set = set(oracle_defs)
    extracted_set = set(extracted_top_level)

    # All top-level definitions in oracle MUST be extracted
    missing_from_extractor = oracle_set - extracted_set
    assert not missing_from_extractor, (
        f"Module {module_name}: PythonAstExtractor missed top-level definitions identified by ast.parse: {missing_from_extractor}"
    )

    # Verify frontend display invariant on ALL extracted chunks for this module
    for chunk in chunks:
        verify_display_invariant(chunk)


def test_differential_oracle_hierarchical_sample_service():
    """Hierarchical differential comparison on backend sample_service.py."""
    service_path = "backend/sample_codebase/sample_service.py"
    with open(service_path, "r", encoding="utf-8") as f:
        source_text = f.read()

    oracle_hierarchical = AstParseOracle.get_all_definitions_hierarchical(source_text)
    extractor = PythonAstExtractor()
    chunks = extractor.parse_file(service_path)

    extracted_hierarchical = [(c.astNodeType, c.identifier) for c in chunks]

    # Check that every definition identified by ast.parse oracle exists in extractor output
    oracle_set = set(oracle_hierarchical)
    extracted_set = set(extracted_hierarchical)

    missing = oracle_set - extracted_set
    assert not missing, f"Missing definitions compared to ast.parse oracle: {missing}"

    # Also verify counts match (no duplicate extractions)
    assert len(extracted_hierarchical) == len(oracle_hierarchical)
    for chunk in chunks:
        verify_display_invariant(chunk)
