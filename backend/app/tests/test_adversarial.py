"""Adversarial stress test harness for PythonAstExtractor and CodebaseScanner.

Adversarial dimensions tested:
1. Single-line functions, methods, and classes (with/without docstrings, with/without pass)
2. Deeply nested scopes (10+ levels of functions, classes, closures, and control flow blocks)
3. Syntax errors, malformed tokens, corrupted files, unclosed delimiters, and binary garbage
4. Unusual, stacked, multiline, parameterized, and exotic decorators
5. Unicode identifiers (PEP 3131), emojis in docstrings/comments, and malformed UTF-8 bytes
6. Docstring edge cases (raw, bytes, f-string, concatenated, multiline with complex indent, docstring-only bodies)
7. Coordinate invariants and line count accuracy across CRLF and LF line endings
8. CodebaseScanner robustness on invalid directories, non-python files, and excluded directories
"""

import os
import tempfile
from pathlib import Path
import pytest
from app.parser.extractor import PythonAstExtractor
from app.parser.scanner import CodebaseScanner


@pytest.fixture
def extractor():
    return PythonAstExtractor()


# =====================================================================
# 1. Single-Line Functions, Methods, and Classes
# =====================================================================

def test_single_line_functions(extractor):
    """Test various single-line function definitions."""
    code = (
        "def f1(): pass\n"
        "def f2(x: int): return x + 1\n"
        "def f3(): ...\n"
        "def f4(a, b=2, *args, **kw): return a\n"
    )
    chunks = extractor.parse_source(code, file_path="single.py")
    assert len(chunks) == 4

    expected = [
        ("f1", 1, 1, "def f1(): pass"),
        ("f2", 2, 2, "def f2(x: int): return x + 1"),
        ("f3", 3, 3, "def f3(): ..."),
        ("f4", 4, 4, "def f4(a, b=2, *args, **kw): return a"),
    ]

    for chunk, (name, s_line, e_line, expected_code) in zip(chunks, expected):
        assert chunk.identifier == name
        assert chunk.startLine == s_line
        assert chunk.endLine == e_line
        assert chunk.code == expected_code
        assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)


def test_single_line_class_and_methods(extractor):
    """Test single-line class definition and inline methods."""
    code = (
        "class Empty: pass\n"
        "class OneLiner:\n"
        "    def m1(self): pass\n"
        "    def m2(self): return 42\n"
    )
    chunks = extractor.parse_source(code, file_path="single_class.py")
    assert len(chunks) == 4

    names = [c.identifier for c in chunks]
    assert names == ["Empty", "OneLiner", "OneLiner.m1", "OneLiner.m2"]

    empty_cls = chunks[0]
    assert empty_cls.startLine == 1
    assert empty_cls.endLine == 1
    assert empty_cls.code == "class Empty: pass"

    m1 = chunks[2]
    assert m1.startLine == 3
    assert m1.endLine == 3
    assert m1.code == "    def m1(self): pass"


def test_single_line_with_docstring(extractor):
    """Test single-line function with inline docstring."""
    code = 'def f(): """Inline doc.""" ; return 1\n'
    chunks = extractor.parse_source(code, file_path="inline_doc.py")
    assert len(chunks) == 1
    assert chunks[0].docstring == "Inline doc."
    assert chunks[0].startLine == 1
    assert chunks[0].endLine == 1


# =====================================================================
# 2. Deeply Nested Scopes (10+ levels)
# =====================================================================

def test_deeply_nested_functions_10_levels(extractor):
    """Test 10 levels of nested functions."""
    lines = []
    for i in range(1, 11):
        indent = "    " * (i - 1)
        lines.append(f"{indent}def fn_level_{i}():")
        lines.append(f'{indent}    """Docstring at level {i}."""')
    lines.append(f"{'    ' * 10}return 10")
    code = "\n".join(lines)

    chunks = extractor.parse_source(code, file_path="deep_nesting.py")
    assert len(chunks) == 10

    expected_scope = []
    for i in range(1, 11):
        expected_scope.append(f"fn_level_{i}")
        expected_id = ".".join(expected_scope)
        chunk = next((c for c in chunks if c.identifier == expected_id), None)
        assert chunk is not None, f"Missing chunk for {expected_id}"
        assert chunk.astNodeType == "FunctionDef"
        assert chunk.docstring == f"Docstring at level {i}."
        assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)


def test_deeply_nested_classes_and_methods(extractor):
    """Test 5 nested classes each with a method (10 total scopes)."""
    lines = []
    for i in range(1, 6):
        indent = "    " * (i - 1) * 2
        lines.append(f"{indent}class ClassLevel{i}:")
        lines.append(f'{indent}    """Class doc {i}."""')
        lines.append(f"{indent}    def method_level_{i}(self):")
        lines.append(f'{indent}        """Method doc {i}."""')
        lines.append(f"{indent}        pass")
    code = "\n".join(lines)

    chunks = extractor.parse_source(code, file_path="nested_classes.py")
    # 5 classes + 5 methods = 10 chunks
    assert len(chunks) == 10

    # The code had classes defined inside methods, so the full qualified scope is preserved:
    expected_classes = [
        "ClassLevel1",
        "ClassLevel1.method_level_1.ClassLevel2",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2.ClassLevel3",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2.ClassLevel3.method_level_3.ClassLevel4",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2.ClassLevel3.method_level_3.ClassLevel4.method_level_4.ClassLevel5",
    ]
    for cls_name in expected_classes:
        assert any(c.identifier == cls_name and c.astNodeType == "ClassDef" for c in chunks)

    expected_methods = [
        "ClassLevel1.method_level_1",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2.ClassLevel3.method_level_3",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2.ClassLevel3.method_level_3.ClassLevel4.method_level_4",
        "ClassLevel1.method_level_1.ClassLevel2.method_level_2.ClassLevel3.method_level_3.ClassLevel4.method_level_4.ClassLevel5.method_level_5",
    ]
    for meth_name in expected_methods:
        assert any(c.identifier == meth_name and c.astNodeType == "FunctionDef" for c in chunks)


def test_pure_nested_classes_10_levels(extractor):
    """Test 10 levels of pure nested classes (class inside class body)."""
    lines = []
    for i in range(1, 11):
        indent = "    " * (i - 1)
        lines.append(f"{indent}class C{i}:")
        lines.append(f'{indent}    """Class doc {i}."""')
    lines.append(f"{'    ' * 10}pass")
    code = "\n".join(lines)

    chunks = extractor.parse_source(code, file_path="pure_nested_classes.py")
    assert len(chunks) == 10

    expected_scope = []
    for i in range(1, 11):
        expected_scope.append(f"C{i}")
        expected_id = ".".join(expected_scope)
        chunk = next((c for c in chunks if c.identifier == expected_id), None)
        assert chunk is not None, f"Missing chunk for {expected_id}"
        assert chunk.astNodeType == "ClassDef"
        assert chunk.docstring == f"Class doc {i}."
        assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)


def test_nested_inside_control_flow_blocks(extractor):
    """Test functions nested inside if, try, while, for, and with blocks."""
    code = (
        "def outer_controller():\n"
        "    if True:\n"
        "        try:\n"
        "            while False:\n"
        "                with None:\n"
        "                    def deeply_hidden():\n"
        '                        """Hidden inside control flow."""\n'
        "                        return 42\n"
        "        except Exception:\n"
        "            pass\n"
    )
    chunks = extractor.parse_source(code, file_path="control_nesting.py")
    assert len(chunks) == 2
    names = [c.identifier for c in chunks]
    assert "outer_controller" in names
    assert "outer_controller.deeply_hidden" in names

    hidden = next(c for c in chunks if c.identifier == "outer_controller.deeply_hidden")
    assert hidden.docstring == "Hidden inside control flow."
    assert hidden.startLine == 6
    assert hidden.endLine == 8


# =====================================================================
# 3. Syntax Errors, Malformed Code, and Edge Inputs
# =====================================================================

def test_empty_and_whitespace_sources(extractor):
    """Test empty source, whitespace only, and comment only files."""
    assert extractor.parse_source("", file_path="empty.py") == []
    assert extractor.parse_source("   \n\t  \n", file_path="blank.py") == []
    assert extractor.parse_source("# Just a comment\n# Another comment\n", file_path="comments.py") == []


def test_malformed_syntax_graceful_recovery(extractor):
    """Test extractor does not crash on syntax errors and recovers subsequent valid definitions."""
    corrupted = (
        "def (\n"  # Missing name
        "def broken_unclosed(a, b\n"  # Unclosed paren
        "class :\n"  # Missing class name
        "    pass\n"
        "@\n"  # Incomplete decorator
        "def recovered_function():\n"
        '    """This function follows syntax garbage."""\n'
        "    return 1\n"
        "\n"
        "def normal_function(x):\n"
        "    return x\n"
    )
    chunks = extractor.parse_source(corrupted, file_path="garbage.py")
    # Must not crash!
    identifiers = [c.identifier for c in chunks]
    assert "normal_function" in identifiers


def test_unclosed_multiline_string(extractor):
    """Test unclosed multiline string syntax error."""
    code = (
        "def func_with_unclosed_string():\n"
        '    s = """Never ending string\n'
        "\n"
        "def second_func():\n"
        "    return 1\n"
    )
    # Must not throw unhandled exception
    chunks = extractor.parse_source(code, file_path="unclosed_str.py")
    assert isinstance(chunks, list)


def test_corrupted_raw_bytes_encoding(extractor):
    """Test raw bytes with non-utf-8 sequences."""
    raw_bytes = b"def valid_fn():\n    # bad bytes \xff\xfe\n    pass\n"
    chunks = extractor.extract_chunks(raw_bytes, file_path="bad_bytes.py", file_name="bad_bytes.py")
    assert len(chunks) == 1
    assert chunks[0].identifier == "valid_fn"


def test_docstring_only_body(extractor):
    """Test function and class bodies consisting only of a docstring (no pass)."""
    code = (
        "def doc_only():\n"
        '    """Only a docstring, no statements."""\n'
        "\n"
        "class DocOnlyClass:\n"
        '    """Class with only docstring."""\n'
    )
    chunks = extractor.parse_source(code, file_path="doc_only.py")
    assert len(chunks) == 2

    fn_chunk = chunks[0]
    assert fn_chunk.identifier == "doc_only"
    assert fn_chunk.docstring == "Only a docstring, no statements."
    assert fn_chunk.summary == "Only a docstring, no statements."

    cls_chunk = chunks[1]
    assert cls_chunk.identifier == "DocOnlyClass"
    assert cls_chunk.docstring == "Class with only docstring."


# =====================================================================
# 4. Weird, Complex, and Stacked Decorators
# =====================================================================

def test_stacked_and_exotic_decorators(extractor):
    """Test multiple decorators including calls, subscripts, attributes, and multiline expressions."""
    code = (
        "@dec1\n"
        "@dec2(arg1='val', arg2=[1, 2, 3])\n"
        "@module.submodule.decorator\n"
        "@registry['custom_handler']\n"
        "@decorator_factory(\n"
        "    foo='bar',\n"
        "    debug=True\n"
        ")\n"
        "def highly_decorated_fn(x: int) -> int:\n"
        '    """Decorated function."""\n'
        "    return x\n"
    )
    chunks = extractor.parse_source(code, file_path="decorators.py")
    assert len(chunks) == 1
    chunk = chunks[0]

    assert chunk.identifier == "highly_decorated_fn"
    assert chunk.startLine == 1  # Must start on the very first decorator line
    assert chunk.endLine == 11
    assert len(chunk.decorators) == 5
    assert chunk.decorators[0] == "@dec1"
    assert chunk.decorators[1].startswith("@dec2")
    assert chunk.decorators[2] == "@module.submodule.decorator"
    assert chunk.decorators[3] == "@registry['custom_handler']"
    assert chunk.decorators[4].startswith("@decorator_factory")
    assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)


def test_decorated_class_with_args(extractor):
    """Test class decorators with arguments."""
    code = (
        "@dataclass(frozen=True, slots=True)\n"
        "@custom_schema(version='2.0')\n"
        "class ConfigModel:\n"
        '    """Model config."""\n'
        "    pass\n"
    )
    chunks = extractor.parse_source(code, file_path="dec_class.py")
    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.astNodeType == "ClassDef"
    assert chunk.identifier == "ConfigModel"
    assert chunk.startLine == 1
    assert chunk.endLine == 5
    assert len(chunk.decorators) == 2
    assert chunk.decorators[0].startswith("@dataclass")
    assert chunk.decorators[1].startswith("@custom_schema")


# =====================================================================
# 5. Unicode and Multilingual Support (PEP 3131)
# =====================================================================

def test_unicode_identifiers_and_comments(extractor):
    """Test valid Python 3 Unicode identifiers and comments with emojis."""
    code = (
        "def 计算面积(半径: float) -> float:\n"
        '    """计算圆的面积 📐✨."""\n'
        "    return 3.14159 * 半径 ** 2\n"
        "\n"
        "class DonnéesUtilisateur:\n"
        '    """Gestion des données 🚀."""\n'
        "    def récupérer_nom(self) -> str:\n"
        "        return 'Jean'\n"
    )
    chunks = extractor.parse_source(code, file_path="unicode_test.py")
    assert len(chunks) == 3

    c0 = chunks[0]
    assert c0.identifier == "计算面积"
    assert c0.parameters == ["半径: float"]
    assert "📐✨" in c0.docstring

    c1 = chunks[1]
    assert c1.identifier == "DonnéesUtilisateur"
    assert c1.astNodeType == "ClassDef"

    c2 = chunks[2]
    assert c2.identifier == "DonnéesUtilisateur.récupérer_nom"


# =====================================================================
# 6. Docstring Cleansing Variants (PEP 257, raw, f-strings, etc.)
# =====================================================================

def test_docstring_cleansing_formats(extractor):
    """Test docstrings in various representations."""
    code = (
        'def f_multiline_indented():\n'
        '    """\n'
        '    This is the first line.\n'
        '\n'
        '    This is an indented paragraph:\n'
        '        - item 1\n'
        '        - item 2\n'
        '    """\n'
        '    pass\n'
        '\n'
        'def f_single_quote():\n'
        "    'Simple docstring with single quotes'\n"
        '    pass\n'
        '\n'
        'def f_raw():\n'
        '    r"""Regex pattern: [a-zA-Z_][a-zA-Z0-9_]*"""\n'
        '    pass\n'
        '\n'
        'def f_concatenated():\n'
        '    """Part one and """ """part two"""\n'
        '    pass\n'
    )
    chunks = extractor.parse_source(code, file_path="doc_formats.py")
    doc_map = {c.identifier: c.docstring for c in chunks}

    # inspect.cleandoc should normalize multi-line indent
    assert "This is the first line." in doc_map["f_multiline_indented"]
    assert "    - item 1" in doc_map["f_multiline_indented"]

    assert doc_map["f_single_quote"] == "Simple docstring with single quotes"
    assert doc_map["f_raw"] == "Regex pattern: [a-zA-Z_][a-zA-Z0-9_]*"
    assert "Part one and" in (doc_map["f_concatenated"] or "")


# =====================================================================
# 7. Line Coordinates and Invariants Across CRLF and LF
# =====================================================================

def test_crlf_line_endings_invariants(extractor):
    """Test that Windows CRLF line endings preserve line numbers and invariants."""
    code_crlf = (
        "@decorator\r\n"
        "def windows_func(x: int) -> int:\r\n"
        '    """Windows function with CRLF."""\r\n'
        "    y = x + 1\r\n"
        "    return y\r\n"
    )
    chunks = extractor.parse_source(code_crlf, file_path="crlf.py")
    assert len(chunks) == 1
    chunk = chunks[0]

    assert chunk.identifier == "windows_func"
    assert chunk.startLine == 1
    assert chunk.endLine == 5
    assert len(chunk.code.split("\n")) == (chunk.endLine - chunk.startLine + 1)
    assert chunk.docstring == "Windows function with CRLF."


def test_trailing_newlines_and_eof(extractor):
    """Test functions at EOF with multiple trailing newlines and no trailing newlines."""
    # No trailing newline
    code1 = "def fn_no_eof():\n    return True"
    chunks1 = extractor.parse_source(code1, file_path="eof1.py")
    assert len(chunks1) == 1
    assert chunks1[0].startLine == 1
    assert chunks1[0].endLine == 2
    assert len(chunks1[0].code.split("\n")) == (chunks1[0].endLine - chunks1[0].startLine + 1)

    # Multiple trailing newlines
    code2 = "def fn_multi_eof():\n    return True\n\n\n\n"
    chunks2 = extractor.parse_source(code2, file_path="eof2.py")
    assert len(chunks2) == 1
    assert chunks2[0].startLine == 1
    assert chunks2[0].endLine == 2
    assert len(chunks2[0].code.split("\n")) == (chunks2[0].endLine - chunks2[0].startLine + 1)


# =====================================================================
# 8. CodebaseScanner Robustness and Stress
# =====================================================================

def test_scanner_with_nonexistent_and_empty_dirs():
    """Test scanner gracefully handling missing or empty directories."""
    scanner = CodebaseScanner()
    assert scanner.find_python_files("non_existent_dir_12345") == []
    assert scanner.scan_directory("non_existent_dir_12345") == []

    with tempfile.TemporaryDirectory() as tmp:
        assert scanner.find_python_files(tmp) == []
        assert scanner.scan_directory(tmp) == []


def test_scanner_with_mixed_file_types_and_errors():
    """Test scanner on a directory with binary, text, syntax error, and valid python files."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1. Non-python files
        (tmp_path / "readme.txt").write_text("Not code", encoding="utf-8")
        (tmp_path / "data.json").write_text("{}", encoding="utf-8")
        (tmp_path / "binary.bin").write_bytes(b"\x00\x01\x02\x03\xff")

        # 2. Syntax-error infested python file
        (tmp_path / "broken.py").write_text("def broken(:\n  ????", encoding="utf-8")

        # 3. Empty python file
        (tmp_path / "empty.py").write_text("", encoding="utf-8")

        # 4. Valid python file
        (tmp_path / "valid.py").write_text("def valid_one(): pass\n", encoding="utf-8")

        # 5. Excluded folder
        node_modules = tmp_path / "node_modules"
        node_modules.mkdir()
        (node_modules / "pkg.py").write_text("def pkg(): pass\n", encoding="utf-8")

        scanner = CodebaseScanner()
        discovered = scanner.find_python_files(tmp_dir)
        discovered_names = [os.path.basename(p) for p in discovered]

        assert "valid.py" in discovered_names
        assert "broken.py" in discovered_names
        assert "empty.py" in discovered_names
        assert "pkg.py" not in discovered_names  # Excluded!
        assert "readme.txt" not in discovered_names
        assert "binary.bin" not in discovered_names

        # Scanning should not crash
        chunks = scanner.scan_directory(tmp_dir)
        chunk_names = [c.identifier for c in chunks]
        assert "valid_one" in chunk_names


# =====================================================================
# 9. Massive Scale: 100 Entities in Single File
# =====================================================================

def test_massive_file_with_100_functions(extractor):
    """Stress test extractor with a synthetic 100-function file."""
    lines = []
    for i in range(100):
        lines.append(f"@dec_{i}")
        lines.append(f"def func_{i}(x: int = {i}) -> int:")
        lines.append(f'    """Docstring for function {i}."""')
        lines.append(f"    return x + {i}")
        lines.append("")
    code = "\n".join(lines)

    chunks = extractor.parse_source(code, file_path="massive.py")
    assert len(chunks) == 100

    chunk_ids = set()
    for i, chunk in enumerate(chunks):
        assert chunk.identifier == f"func_{i}"
        assert chunk.astNodeType == "FunctionDef"
        assert chunk.decorators == [f"@dec_{i}"]
        assert chunk.docstring == f"Docstring for function {i}."
        assert chunk.parameters == [f"x: int = {i}"]
        # Invariant check
        expected_len = chunk.endLine - chunk.startLine + 1
        assert len(chunk.code.split("\n")) == expected_len
        # Ensure chunk IDs are unique
        assert chunk.id not in chunk_ids
        chunk_ids.add(chunk.id)


# =====================================================================
# 10. PEP 614 Arbitrary Decorator Expressions
# =====================================================================

def test_pep_614_arbitrary_decorators(extractor):
    """Test Python 3.9+ PEP 614 relaxed decorator expressions."""
    code = (
        "@handlers[0].dispatch\n"
        "@registry['user'].authenticate\n"
        "def custom_endpoint():\n"
        "    pass\n"
    )
    chunks = extractor.parse_source(code, file_path="pep614.py")
    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.identifier == "custom_endpoint"
    assert len(chunk.decorators) == 2
    assert chunk.decorators[0] == "@handlers[0].dispatch"
    assert chunk.decorators[1] == "@registry['user'].authenticate"
    assert chunk.startLine == 1
    assert chunk.endLine == 4


# =====================================================================
# 11. Property Getters, Setters, Deleters & Chunk ID Collision Resistance
# =====================================================================

def test_properties_getters_setters_unique_ids(extractor):
    """Test property getter and setter sharing the same qualified name."""
    code = (
        "class BankAccount:\n"
        "    @property\n"
        "    def balance(self) -> float:\n"
        '        """Current account balance."""\n'
        "        return self._balance\n"
        "\n"
        "    @balance.setter\n"
        "    def balance(self, value: float) -> None:\n"
        '        """Set account balance."""\n'
        "        self._balance = value\n"
    )
    chunks = extractor.parse_source(code, file_path="bank.py")
    assert len(chunks) == 3  # Class + getter + setter

    getter = chunks[1]
    setter = chunks[2]
    assert getter.identifier == "BankAccount.balance"
    assert setter.identifier == "BankAccount.balance"
    assert getter.decorators == ["@property"]
    assert setter.decorators == ["@balance.setter"]
    assert getter.startLine == 2
    assert setter.startLine == 7
    # Chunk IDs must NOT collide even if identifier is identical!
    assert getter.id != setter.id
    assert getter.id == "bank.py:BankAccount.balance:2"
    assert setter.id == "bank.py:BankAccount.balance:7"


# =====================================================================
# 12. Async Generators and Coroutines
# =====================================================================

def test_async_generator_extraction(extractor):
    """Test async generator functions with yield, async with, async for."""
    code = (
        "async def stream_ticker(symbol: str):\n"
        '    """Stream market data chunks."""\n'
        "    async for item in client.listen(symbol):\n"
        "        yield item\n"
    )
    chunks = extractor.parse_source(code, file_path="ticker.py")
    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.astNodeType == "AsyncFunctionDef"
    assert chunk.identifier == "stream_ticker"
    assert chunk.docstring == "Stream market data chunks."
    assert "client.listen" in chunk.calls


# =====================================================================
# 13. Parameter Defaults with Lambdas and Complex Expressions
# =====================================================================

def test_parameter_defaults_complex(extractor):
    """Test parameters with default lambdas, tuples, and dict literals."""
    code = (
        "def compute_handler(\n"
        "    fn = lambda x: x * 2,\n"
        "    options: dict = {'timeout': 30, 'retries': 3},\n"
        "    bounds: tuple = (0, 100)\n"
        ") -> None:\n"
        "    pass\n"
    )
    chunks = extractor.parse_source(code, file_path="defaults.py")
    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.identifier == "compute_handler"
    assert len(chunk.parameters) == 3
    assert chunk.parameters[0] == "fn = lambda x: x * 2"
    assert "options: dict =" in chunk.parameters[1]
    assert "bounds: tuple =" in chunk.parameters[2]


# =====================================================================
# 14. Path Normalization on Windows
# =====================================================================

def test_path_normalization_forward_slashes(extractor):
    """Test that file paths are always normalized to forward slashes."""
    code = "def sample(): pass"
    chunks = extractor.parse_source(code, file_path=r"subdir\subpackage\module.py")
    assert len(chunks) == 1
    chunk = chunks[0]
    assert "\\" not in chunk.filePath
    assert chunk.filePath == "subdir/subpackage/module.py"
    assert chunk.fileName == "module.py"
    assert chunk.id.startswith("subdir/subpackage/module.py:sample:")


# =====================================================================
# 15. Extreme Scale Stress Test: 500 Functions in a Single File
# =====================================================================

def test_extreme_scale_500_functions(extractor):
    """Stress test parser performance and memory with 500 function definitions."""
    lines = []
    for i in range(500):
        lines.append(f"def generated_func_{i}(p1: int, p2: str = 'val_{i}'):")
        lines.append(f'    """Docstring {i}."""')
        lines.append(f"    return p1 * {i}")
        lines.append("")
    code = "\n".join(lines)

    chunks = extractor.parse_source(code, file_path="scale_500.py")
    assert len(chunks) == 500

    # Verify first, middle, and last
    assert chunks[0].identifier == "generated_func_0"
    assert chunks[250].identifier == "generated_func_250"
    assert chunks[499].identifier == "generated_func_499"

    # Spot check invariants
    for c in (chunks[0], chunks[123], chunks[249], chunks[380], chunks[499]):
        assert len(c.code.split("\n")) == (c.endLine - c.startLine + 1)
