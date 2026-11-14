# Test Infrastructure: Edge AI Frontend & Retrieval Backend

## Test Philosophy
- Multi-tier requirement-driven verification across frontend (JSDOM/Vitest) and backend (Pytest).
- Methodology: Category-Partition + Boundary Value Analysis + Adversarial Stress + Scale Testing.
- Test runners:
  - Frontend: `npm --prefix frontend test` (Vitest 3, RTL, JSDOM)
  - Backend: `pytest backend/app/tests` (Pytest 9)

## Full Test Suite Inventory (853 Tests Total)
- **Frontend Suites** (`frontend/src/test/`, 38 files, 547 tests):
  - `AgenticLoopState.test.tsx`, `AgentRunner.test.tsx`, `AgentRunnerChallenger.test.tsx`
  - `CodeViewerPane.test.tsx`, `CodeSearchChallenger.test.tsx`, `ASTMetadataInspector.test.tsx`
  - `WebLLMIntegration.test.tsx`, `WebLLMChallenger2.test.tsx`, `EdgeAIHooks.test.tsx`
  - `Header.test.tsx`, `HeaderChallenger1.test.tsx`, `HeaderComponentIntegrationChallenger2.test.tsx`
  - `ConnectRepoModal.test.tsx`, `RepoFileTree.test.tsx`, `RepoManagerHub.test.tsx`
  - `NemoCompiler.test.ts`, `NemoCompilerStress.test.ts`, `NemoCompilerChallenger2.test.ts`
  - `UXFlowsRefinement.test.tsx`, `SlashCommandsAndIntent.test.tsx`
  - `IntegrationM2StressChallenger.test.tsx`, `RepoScopingChallenger.test.tsx`
- **Backend Suites** (`backend/app/tests/`, 306 tests):
  - `test_acceptance.py`: Core Tree-sitter AST and LanceDB vector store contracts.
  - `test_adversarial.py`, `test_adversarial_http.py`: Malformed JSON, CRLF, exotic decorators, SQLi immunity.
  - `test_api.py`, `test_repos_api.py`: FastAPI endpoints, repo tree, and architecture manifests.
  - `test_vector_store.py`, `test_scale_differential.py`: LanceDB ANN indexing, SQLite fallback, throughput.

## Acceptance Criteria Thresholds
- All 853 tests pass with 100% green exit code 0.
- `npm --prefix frontend run build` completes with zero TypeScript or packaging errors.
