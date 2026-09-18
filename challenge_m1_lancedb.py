"""Adversarial Challenge Verification Script for Milestone 1 (LanceDB Repo Ingestion).

Query backend/data/lancedb/ast_chunks.lance directly using Python and lancedb.
Empirically verify coordinate invariants, identifier validity, AST node types,
and module coverage for fixtures/requests.
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Any
import lancedb
import numpy as np


def run_adversarial_challenge():
    project_root = Path(__file__).resolve().parent
    db_path = project_root / "backend" / "data" / "lancedb"
    fixtures_dir = project_root / "fixtures" / "requests"

    print("=" * 80)
    print("RUNNING ADVERSARIAL CHALLENGE FOR MILESTONE 1")
    print(f"Project root: {project_root}")
    print(f"LanceDB path: {db_path}")
    print(f"Fixtures path: {fixtures_dir}")
    print("=" * 80)

    # 1. Connect to LanceDB
    assert db_path.exists(), f"LanceDB directory does not exist: {db_path}"
    sys.path.insert(0, str(project_root / "backend"))
    db = lancedb.connect(str(db_path))
    tables = db.list_tables()
    table_names = tables.tables if hasattr(tables, "tables") else list(tables)
    print(f"[Check 1] Tables found in LanceDB: {table_names}")
    assert "ast_chunks" in table_names, "Table 'ast_chunks' not found in LanceDB!"

    tbl = db.open_table("ast_chunks")
    total_count = len(tbl)
    print(f"[Check 1] Total row count in 'ast_chunks': {total_count}")
    assert total_count == 284, f"Expected 284 rows, got {total_count}"

    # Query all chunks as PyArrow table / list of dicts
    arrow_tbl = tbl.to_arrow()
    pydict_data = tbl.to_pandas().to_dict(orient="records")
    print(f"[Check 1] Successfully loaded {len(pydict_data)} records via pandas/arrow.")

    # 2. Empirically verify coordinate invariants on all chunks
    print("\n" + "=" * 80)
    print("TASK 2: COORDINATE INVARIANTS & SCHEMA VERIFICATION")
    print("=" * 80)

    allowed_node_types = {"FunctionDef", "AsyncFunctionDef", "ClassDef", "Module", "Assign"}
    node_type_counts: Dict[str, int] = {}

    exact_line_matches = 0
    approx_line_matches = 0
    line_mismatches = []
    invalid_identifiers = []
    invalid_node_types = []
    invalid_coordinates = []
    vector_issues = []
    chunk_ids = set()
    duplicate_ids = []

    for idx, chunk in enumerate(pydict_data):
        c_id = chunk.get("id")
        if c_id in chunk_ids:
            duplicate_ids.append(c_id)
        chunk_ids.add(c_id)

        # Coordinate checks
        start_line = chunk.get("startLine")
        end_line = chunk.get("endLine")
        if not isinstance(start_line, int) or not isinstance(end_line, int) or start_line < 1 or end_line < start_line:
            invalid_coordinates.append((idx, c_id, start_line, end_line))

        # Code length vs (endLine - startLine + 1)
        code = chunk.get("code") or ""
        code_lines = len(code.splitlines())
        coord_span = end_line - start_line + 1

        if code_lines == coord_span:
            exact_line_matches += 1
        elif abs(code_lines - coord_span) <= 1:
            approx_line_matches += 1
        else:
            line_mismatches.append({
                "id": c_id,
                "file": chunk.get("filePath"),
                "identifier": chunk.get("identifier"),
                "startLine": start_line,
                "endLine": end_line,
                "coord_span": coord_span,
                "code_lines": code_lines,
                "delta": code_lines - coord_span,
            })

        # Identifier check
        identifier = chunk.get("identifier")
        if not isinstance(identifier, str) or not identifier.strip():
            invalid_identifiers.append((idx, c_id, identifier))

        # Node type check
        node_type = chunk.get("astNodeType")
        node_type_counts[node_type] = node_type_counts.get(node_type, 0) + 1
        if node_type not in allowed_node_types:
            invalid_node_types.append((idx, c_id, node_type))

        # Vector check
        vec = chunk.get("vector")
        if vec is None:
            vector_issues.append((c_id, "Vector is None"))
        else:
            arr = np.array(vec, dtype=np.float32)
            if len(arr) != 384:
                vector_issues.append((c_id, f"Invalid vector length: {len(arr)}"))
            elif np.isnan(arr).any() or np.isinf(arr).any():
                vector_issues.append((c_id, "Vector contains NaN or Inf"))

    print(f"Duplicate IDs: {len(duplicate_ids)}")
    print(f"Invalid Coordinates: {len(invalid_coordinates)}")
    print(f"Node Type Distribution: {node_type_counts}")
    print(f"Invalid Node Types: {len(invalid_node_types)}")
    print(f"Invalid Identifiers: {len(invalid_identifiers)}")
    print(f"Vector Issues: {len(vector_issues)}")
    print(f"Exact line matches (code_lines == end - start + 1): {exact_line_matches}/{total_count} ({exact_line_matches/total_count*100:.1f}%)")
    print(f"Approx line matches (|code_lines - (end - start + 1)| <= 1): {approx_line_matches}/{total_count}")
    print(f"Larger line mismatches: {len(line_mismatches)}")
    if line_mismatches:
        print("Mismatches sample (up to 5):")
        for m in line_mismatches[:5]:
            print(f"  - {m['id']}: coord_span={m['coord_span']} vs code_lines={m['code_lines']} (delta={m['delta']})")

    # 3. Verify all 18 modules in fixtures/requests
    print("\n" + "=" * 80)
    print("TASK 3: FIXTURES/REQUESTS MODULE COVERAGE")
    print("=" * 80)

    fixture_files = sorted([f.name for f in fixtures_dir.glob("*.py")])
    print(f"Total .py files in fixtures/requests: {len(fixture_files)}")
    assert len(fixture_files) == 18, f"Expected 18 modules, found {len(fixture_files)}: {fixture_files}"

    module_chunk_counts: Dict[str, int] = {f: 0 for f in fixture_files}
    for chunk in pydict_data:
        file_name = chunk.get("fileName")
        file_path = chunk.get("filePath")
        # Match by fileName or relative filePath
        matched = False
        if file_name in module_chunk_counts:
            module_chunk_counts[file_name] += 1
            matched = True
        elif file_path:
            base = Path(file_path).name
            if base in module_chunk_counts:
                module_chunk_counts[base] += 1
                matched = True

    print("Chunk count per module:")
    zero_chunk_modules = []
    for f in fixture_files:
        cnt = module_chunk_counts[f]
        print(f"  {f:25s}: {cnt:3d} chunks")
        if cnt == 0:
            zero_chunk_modules.append(f)

    if zero_chunk_modules:
        print(f"\nModules with 0 chunks: {zero_chunk_modules}")
        # Investigate why 0 chunks
        for zf in zero_chunk_modules:
            p = fixtures_dir / zf
            with open(p, "r", encoding="utf-8") as file:
                lines = file.readlines()
            print(f"  Inspecting {zf} ({len(lines)} lines):")
            sample = [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")][:5]
            print(f"    Sample code: {sample}")

    # 4. Source file verbatim match test
    print("\n" + "=" * 80)
    print("TASK 4: VERBATIM SOURCE SLICE DIFFERENTIAL VERIFICATION")
    print("=" * 80)
    verbatim_matches = 0
    verbatim_diffs = []
    for chunk in pydict_data[:50]: # Sample 50 chunks for deep verbatim check
        file_name = chunk.get("fileName")
        src_path = fixtures_dir / file_name
        if src_path.exists():
            with open(src_path, "r", encoding="utf-8", errors="replace") as f:
                file_lines = f.read().splitlines()
            s = chunk["startLine"] - 1
            e = chunk["endLine"]
            expected_slice = "\n".join(file_lines[s:e])
            actual_code = chunk["code"]
            if expected_slice == actual_code:
                verbatim_matches += 1
            else:
                verbatim_diffs.append((chunk["id"], len(expected_slice), len(actual_code)))

    print(f"Verbatim slice checks on 50 samples: {verbatim_matches}/50 exact matches")
    if verbatim_diffs:
        print(f"Verbatim differences found: {len(verbatim_diffs)}")

    # 5. AST Parseability and Pydantic Model Validation
    print("\n" + "=" * 80)
    print("TASK 5: AST PARSEABILITY & PYDANTIC VALIDATION")
    print("=" * 80)
    import ast
    import textwrap
    from app.models.chunk import AstCodeChunk

    ast_parse_errors = []
    pydantic_errors = []
    for c in pydict_data:
        # Check Pydantic validation
        try:
            chunk_copy = dict(c)
            # drop lance internal metadata if any
            chunk_copy.pop("_distance", None)
            AstCodeChunk.model_validate(chunk_copy)
        except Exception as e:
            pydantic_errors.append((c.get("id"), str(e)))

        # Check Python AST parseability
        dedented = textwrap.dedent(c.get("code", ""))
        try:
            ast.parse(dedented)
        except Exception as e:
            ast_parse_errors.append((c.get("id"), str(e)))

    print(f"Pydantic model validation errors: {len(pydantic_errors)}")
    if pydantic_errors:
        for err in pydantic_errors[:5]:
            print(f"  - {err}")
    print(f"ast.parse() errors on dedented code: {len(ast_parse_errors)}")
    if ast_parse_errors:
        for err in ast_parse_errors[:5]:
            print(f"  - {err}")

    # 6. Search capability verification
    print("\n" + "=" * 80)
    print("TASK 6: DIRECT LANCEDB QUERY CAPABILITY")
    print("=" * 80)
    exact_res = tbl.search().where("identifier = 'Session.request'").to_list()
    print(f"Direct where('identifier = Session.request'): {len(exact_res)} hit(s)")
    if exact_res:
        hit = exact_res[0]
        print(f"  ID: {hit['id']}")
        print(f"  Type: {hit['astNodeType']}")
        print(f"  File: {hit['filePath']} (lines {hit['startLine']}-{hit['endLine']})")
        print(f"  Parameters: {hit['parameters']}")
        print(f"  Summary: {hit['summary']}")

    vec_search_res = tbl.search(exact_res[0]["vector"]).limit(3).to_list()
    print(f"\nVector search using Session.request vector (top 3):")
    for r in vec_search_res:
        print(f"  Hit: {r['identifier']} ({r['filePath']}:{r['startLine']}) - distance: {r.get('_distance')}")

    print("\n" + "=" * 80)
    print("CHALLENGE AUDIT SUMMARY")
    print("=" * 80)
    status = "APPROVE"
    reasons = []

    if total_count != 284:
        status = "REJECT"
        reasons.append(f"Chunk count is {total_count}, expected 284.")
    if duplicate_ids:
        status = "REJECT"
        reasons.append(f"Found {len(duplicate_ids)} duplicate IDs.")
    if invalid_identifiers:
        status = "REJECT"
        reasons.append(f"Found {len(invalid_identifiers)} invalid identifiers.")
    if invalid_node_types:
        status = "REJECT"
        reasons.append(f"Found {len(invalid_node_types)} invalid node types.")
    if invalid_coordinates:
        status = "REJECT"
        reasons.append(f"Found {len(invalid_coordinates)} invalid coordinate tuples.")
    if vector_issues:
        status = "REJECT"
        reasons.append(f"Found {len(vector_issues)} vector issues.")

    print(f"VERDICT: {status}")
    if reasons:
        print("REASONS FOR REJECTION:")
        for r in reasons:
            print(f"  - {r}")
    else:
        print("All core invariants verified successfully.")


if __name__ == "__main__":
    run_adversarial_challenge()
