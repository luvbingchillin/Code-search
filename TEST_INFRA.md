# E2E Test Infra: Edge AI Frontend

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on internal implementation details.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise + Workload Testing.
- Test runner: Vitest with React Testing Library and JSDOM. Command: `npm test` (or `npx vitest run`).

## Feature Inventory Mapping
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workload) |
|---|---------|--------|:-----------------:|:-----------------:|:---------------------:|:-----------------:|
| 1 | Split-Pane UI Layout | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | Python AST Code Viewer | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | ReAct Loop State Machine | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Edge AI Hooks & Scaffolding | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ✓ | ✓ |

## Test Architecture
- Setup file: `frontend/src/test/setup.ts` (stubs for ResizeObserver, matchMedia, clipboard, navigator.gpu)
- Test directory: `frontend/src/test/`
- Test suites:
  1. `SplitPaneLayout.test.tsx` (Verifies presence and responsiveness of left chat pane and right code viewer pane)
  2. `AgenticLoopState.test.tsx` (Verifies explicit ReAct loop states: "Thinking", "Searching AST", "Synthesizing", "Complete", "Error")
  3. `CodeViewerPane.test.tsx` (Verifies Python AST syntax highlighting, line numbers matching AST startLine, tab switching, and copy button)
  4. `EdgeAIHooks.test.tsx` (Verifies useWebLLM, useNemoIR, useReActAgent hook capabilities and fallbacks)

## Acceptance Criteria Thresholds
- All 4 test suites pass with 100% exit code 0.
- `npm run build` completes with zero TypeScript errors.
