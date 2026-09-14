# E2E Test Suite Ready

## Test Runner
- Command: `npm test` (or `npx vitest run` in `c:/Users/kangy/Desktop/Fyp/frontend`)
- Expected: all 49 tests pass with exit code 0
- Build check: `npm run build` exits with code 0

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 20 | SplitPaneLayout, AgenticLoopState, CodeViewerPane, EdgeAIHooks |
| 2. Boundary & Corner | 14 | Line number boundaries (1, 42, 100, 450), empty/null chunks, single lines |
| 3. Cross-Feature | 8 | Tab switching, chat citations linking to viewer, ReAct query loop |
| 4. Real-World Application & Stress | 7 | Adversarial stress, regex/XSS safety, rapid query concurrency, cancel mid-loop |
| **Total** | **49** | All 49 automated test cases passing |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Status |
|---------|:------:|:------:|:------:|:------:|:------:|
| Split-Pane UI Layout (`data-testid="split-pane-layout"`) | ✓ | ✓ | ✓ | ✓ | PASS |
| Left Chat Pane (`data-testid="chat-pane"`) | ✓ | ✓ | ✓ | ✓ | PASS |
| Right Python AST Code Viewer (`data-testid="code-viewer-pane"`) | ✓ | ✓ | ✓ | ✓ | PASS |
| PrismJS Python Syntax Highlighting (`data-testid="code-display"`) | ✓ | ✓ | ✓ | ✓ | PASS |
| Aligned Line Numbers (`data-testid="line-number"`) | ✓ | ✓ | ✓ | ✓ | PASS |
| ReAct Loop States ("Thinking", "Searching AST", etc.) | ✓ | ✓ | ✓ | ✓ | PASS |
| Edge AI Hooks (`useWebLLM`, `useNemoIR`, `useReActAgent`) | ✓ | ✓ | ✓ | ✓ | PASS |
| Clean TypeScript Production Build (`tsc && vite build`) | ✓ | ✓ | ✓ | ✓ | PASS |
