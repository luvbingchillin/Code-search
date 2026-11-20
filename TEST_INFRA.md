# Test Infrastructure: Edge AI Frontend & Retrieval Backend

## Test Philosophy
- Multi-tier requirement-driven verification across frontend (JSDOM/Vitest) and backend (Pytest).
- Methodology: Category-Partition + Boundary Value Analysis + Adversarial Stress + Scale Testing.
- Test runners:
  - Frontend: `npm --prefix frontend test` (Vitest 3, RTL, JSDOM)
  - Backend: `pytest backend/app/tests` (Pytest 9)

## Full Test Suite Inventory (831 Tests Total)
- **Frontend Suites** (`frontend/src/test/`, 35 files, 511 tests):
  - Consolidated component suites: `Header.test.tsx`, `QuerySuggestions.test.tsx`, `WebLLMIntegration.test.tsx`
  - 3D Strata suites: `StrataCanvas.test.tsx`, `StrataLayout.test.ts`, `StrataIntegration.test.tsx`, `StrataUIIntegration.test.tsx`
  - Core agent suites: `AgenticLoopState.test.tsx`, `AgentRunner.test.tsx`, `AgentRunnerChallenger.test.tsx`
  - Code viewer suites: `CodeViewerPane.test.tsx`, `CodeSearchChallenger.test.tsx`, `ASTMetadataInspector.test.tsx`
  - Repository suites: `ConnectRepoModal.test.tsx`, `RepoFileTree.test.tsx`, `RepoManagerHub.test.tsx`
  - Compiler suites: `NemoCompiler.test.ts`, `NemoCompilerStress.test.ts`, `NemoCompilerChallenger2.test.ts`
  - UX flow suites: `UXFlowsRefinement.test.tsx`, `SlashCommandsAndIntent.test.tsx`
  - Integration suites: `IntegrationM2StressChallenger.test.tsx`, `RepoScopingChallenger.test.tsx`, `SequentialImprovementsE2E.test.tsx`
- **Backend Suites** (`backend/app/tests/`, 14 files, 320 tests):
  - `test_strata_api.py`: 3D Strata graph endpoints, tier classification (0–3), call edge resolution.
  - `test_acceptance.py`: Core Tree-sitter AST and LanceDB vector store contracts.
  - `test_adversarial.py`, `test_adversarial_http.py`: Malformed JSON, CRLF, exotic decorators, SQLi immunity.
  - `test_api.py`, `test_repos_api.py`: FastAPI endpoints, repo tree, and architecture manifests.
  - `test_vector_store.py`, `test_scale_differential.py`: LanceDB ANN indexing, SQLite fallback, throughput.

## Acceptance Criteria Thresholds
- All 831 tests pass with 100% green exit code 0.
- `npm --prefix frontend run build` completes with zero TypeScript or packaging errors.
