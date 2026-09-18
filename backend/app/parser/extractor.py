"""Python AST Extractor using Tree-sitter 0.26 / Python 0.25.

Extracts structurally complete AST code chunks (classes, functions, async functions,
methods) with docstrings, parameters, decorators, coordinates, imports, and calls.
"""

import ast
import inspect
import os
from typing import List, Optional

import tree_sitter
import tree_sitter_python

from app.models.chunk import AstCodeChunk, AstNodeType

# Modern Tree-sitter 0.26 initialization
PY_LANGUAGE = tree_sitter.Language(tree_sitter_python.language())


class PythonAstExtractor:
    """Extracts structurally complete AstCodeChunk instances from Python source code."""

    def __init__(self) -> None:
        """Initialize the Tree-sitter parser with the Python grammar."""
        self.parser = tree_sitter.Parser(PY_LANGUAGE)

    def parse_file(self, file_path: str, repo_root: str = "") -> List[AstCodeChunk]:
        """Parse a Python source file from disk and return extracted code chunks.

        Args:
            file_path: Absolute or relative path to the Python file.
            repo_root: Optional repository root path for computing normalized relative paths.

        Returns:
            List of AstCodeChunk objects extracted from the file.
        """
        with open(file_path, "rb") as f:
            source_bytes = f.read()

        if repo_root:
            rel_path = os.path.relpath(file_path, repo_root).replace("\\", "/")
        else:
            rel_path = os.path.normpath(file_path).replace("\\", "/")

        file_name = os.path.basename(file_path)
        return self.extract_chunks(source_bytes, file_path=rel_path, file_name=file_name)

    def parse_source(
        self,
        source_code: str,
        file_path: str = "snippet.py",
        file_name: Optional[str] = None,
    ) -> List[AstCodeChunk]:
        """Parse Python source code provided as a string.

        Args:
            source_code: Python source code string.
            file_path: Optional relative file path identifier.
            file_name: Optional file name identifier.

        Returns:
            List of AstCodeChunk objects extracted from the source string.
        """
        source_bytes = source_code.encode("utf-8")
        norm_file_path = file_path.replace("\\", "/")
        actual_file_name = file_name or os.path.basename(norm_file_path) or "snippet.py"
        return self.extract_chunks(source_bytes, file_path=norm_file_path, file_name=actual_file_name)

    def extract_chunks(
        self,
        source_bytes: bytes,
        file_path: str,
        file_name: str,
    ) -> List[AstCodeChunk]:
        """Extract all AST code chunks from raw source bytes.

        Args:
            source_bytes: UTF-8 encoded Python source bytes.
            file_path: Normalized relative file path.
            file_name: Base file name.

        Returns:
            List of AstCodeChunk objects.
        """
        tree = self.parser.parse(source_bytes)
        source_text = source_bytes.decode("utf-8", errors="replace")
        source_lines = source_text.splitlines()
        file_imports = self._extract_imports(tree.root_node)

        chunks: List[AstCodeChunk] = []
        self._traverse(
            node=tree.root_node,
            source_lines=source_lines,
            file_path=file_path,
            file_name=file_name,
            file_imports=file_imports,
            chunks=chunks,
            parent_scope=[],
        )
        return chunks

    def _traverse(
        self,
        node: tree_sitter.Node,
        source_lines: List[str],
        file_path: str,
        file_name: str,
        file_imports: List[str],
        chunks: List[AstCodeChunk],
        parent_scope: List[str],
    ) -> None:
        """Recursively traverse the AST to extract definitions while handling decorators."""
        if node.type == "decorated_definition":
            decorators = [
                c.text.decode("utf-8").strip()
                for c in node.children
                if c.type == "decorator"
            ]
            inner_def = next(
                (c for c in node.children if c.type in ("function_definition", "class_definition")),
                None,
            )
            if inner_def:
                self._process_node(
                    def_node=inner_def,
                    outer_node=node,
                    decorators=decorators,
                    source_lines=source_lines,
                    file_path=file_path,
                    file_name=file_name,
                    file_imports=file_imports,
                    chunks=chunks,
                    parent_scope=parent_scope,
                )
            return

        if node.type in ("function_definition", "class_definition"):
            # If already enclosed by a decorated_definition, do not process standalone
            if node.parent and node.parent.type == "decorated_definition":
                return
            self._process_node(
                def_node=node,
                outer_node=node,
                decorators=[],
                source_lines=source_lines,
                file_path=file_path,
                file_name=file_name,
                file_imports=file_imports,
                chunks=chunks,
                parent_scope=parent_scope,
            )
            return

        for child in node.children:
            self._traverse(
                node=child,
                source_lines=source_lines,
                file_path=file_path,
                file_name=file_name,
                file_imports=file_imports,
                chunks=chunks,
                parent_scope=parent_scope,
            )

    def _process_node(
        self,
        def_node: tree_sitter.Node,
        outer_node: tree_sitter.Node,
        decorators: List[str],
        source_lines: List[str],
        file_path: str,
        file_name: str,
        file_imports: List[str],
        chunks: List[AstCodeChunk],
        parent_scope: List[str],
    ) -> None:
        """Process a function or class definition node into an AstCodeChunk."""
        name_node = def_node.child_by_field_name("name")
        if not name_node:
            # Skip malformed or anonymous definitions (e.g. syntax errors without a name)
            return

        name = name_node.text.decode("utf-8").strip()
        is_class = def_node.type == "class_definition"
        is_async = any(c.type == "async" for c in def_node.children)

        ast_type: AstNodeType = "ClassDef" if is_class else ("AsyncFunctionDef" if is_async else "FunctionDef")
        qualified_name = ".".join(parent_scope + [name])

        start_row = outer_node.start_point[0]
        end_row = outer_node.end_point[0]

        # If end_point column is 0 and spans multiple lines, end is exclusive of current line
        if outer_node.end_point[1] == 0 and end_row > start_row:
            end_row -= 1

        start_line = start_row + 1
        end_line = end_row + 1

        # Preserve verbatim source lines and uniform indentation from column 0
        code_lines = source_lines[start_row : end_row + 1]
        code_text = "\n".join(code_lines)

        # Extract parameters for functions / methods
        parameters: List[str] = []
        if not is_class:
            params_node = def_node.child_by_field_name("parameters")
            if params_node:
                valid_param_types = {
                    "identifier",
                    "typed_parameter",
                    "default_parameter",
                    "typed_default_parameter",
                    "list_splat_pattern",
                    "dictionary_splat_pattern",
                }
                for p in params_node.named_children:
                    if p.type in valid_param_types:
                        parameters.append(p.text.decode("utf-8").strip())

        # Extract docstring
        docstring: Optional[str] = None
        body_node = def_node.child_by_field_name("body")
        if body_node and body_node.named_child_count > 0:
            first_stmt = body_node.named_children[0]
            if first_stmt.type == "expression_statement" and first_stmt.named_child_count > 0:
                expr = first_stmt.named_children[0]
                if expr.type in ("string", "concatenated_string"):
                    raw_doc = expr.text.decode("utf-8")
                    docstring = self._clean_docstring(raw_doc)

        # Extract calls within body
        calls = self._extract_calls(body_node) if body_node else []

        # Generate summary (first non-empty line of docstring or fallback)
        summary: Optional[str] = None
        if docstring:
            for line in docstring.splitlines():
                stripped = line.strip()
                if stripped:
                    summary = stripped
                    break
        if not summary:
            summary = f"{ast_type} {qualified_name}"

        chunk_id = f"{file_path}:{qualified_name}:{start_line}"

        chunk = AstCodeChunk(
            id=chunk_id,
            filePath=file_path,
            fileName=file_name,
            astNodeType=ast_type,
            identifier=qualified_name,
            startLine=start_line,
            endLine=end_line,
            code=code_text,
            relevanceScore=0.0,
            docstring=docstring,
            parameters=parameters,
            decorators=decorators,
            language="python",
            repoFullName="local",
            summary=summary,
            imports=file_imports,
            calls=calls,
        )
        chunks.append(chunk)

        # Recursively traverse nested definitions in the body with updated scope
        if body_node:
            new_scope = parent_scope + [name]
            for child in body_node.children:
                self._traverse(
                    node=child,
                    source_lines=source_lines,
                    file_path=file_path,
                    file_name=file_name,
                    file_imports=file_imports,
                    chunks=chunks,
                    parent_scope=new_scope,
                )

    def _clean_docstring(self, raw_text: str) -> Optional[str]:
        """Clean docstring by removing quotation delimiters and normalizing indentation."""
        if not raw_text:
            return None

        # Attempt standard ast.literal_eval
        try:
            val = ast.literal_eval(raw_text)
            if isinstance(val, str):
                return inspect.cleandoc(val)
        except Exception:
            pass

        # Fallback for raw strings or complex string literals
        cleaned = raw_text.strip()
        for prefix in ("r", "R", "u", "U", "f", "F", "b", "B", "rf", "fr", "rb", "br"):
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix) :]
                break

        for q in ('"""', "'''", '"', "'"):
            if cleaned.startswith(q) and cleaned.endswith(q) and len(cleaned) >= 2 * len(q):
                cleaned = cleaned[len(q) : -len(q)]
                break

        return inspect.cleandoc(cleaned)

    def _extract_calls(self, body_node: tree_sitter.Node) -> List[str]:
        """Recursively extract function and method calls made inside a body node."""
        calls: List[str] = []

        def _walk(n: tree_sitter.Node) -> None:
            if n.type == "call":
                fn_node = n.child_by_field_name("function")
                if fn_node:
                    calls.append(fn_node.text.decode("utf-8").strip())
            for c in n.children:
                _walk(c)

        _walk(body_node)
        return list(dict.fromkeys(calls))

    def _extract_imports(self, root_node: tree_sitter.Node) -> List[str]:
        """Extract top-level and module-level import statements."""
        imports: List[str] = []
        for n in root_node.children:
            if n.type == "import_statement":
                for c in n.children:
                    if c.type == "dotted_name":
                        imports.append(c.text.decode("utf-8").strip())
                    elif c.type == "aliased_import":
                        name_node = c.child_by_field_name("name")
                        if name_node:
                            imports.append(name_node.text.decode("utf-8").strip())
            elif n.type == "import_from_statement":
                mod = n.child_by_field_name("module_name")
                if mod:
                    imports.append(mod.text.decode("utf-8").strip())
        return list(dict.fromkeys(imports))
