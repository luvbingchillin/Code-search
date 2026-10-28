# Project Memory & Architecture Directives

## Core Technical Focus (Current FYP Scope)
- **Deployment Target:** Maintain **Pure Browser Web Application** (React 19, TypeScript, Vite 6) communicating with local Python FastAPI backend (`localhost:8000`).
- **Core Pillars:**
  - 100% Edge-Computed Privacy: Zero cloud API calls; local SLM inference via WebLLM (WebGPU, e.g., Qwen2.5-Coder).
  - Structural AST Ingestion: Tree-sitter Python parser extracting complete function/class nodes to prevent semantic fragmentation.
  - Deterministic Agentic Loop: NemoIR compiled WebAssembly orchestrating ReAct loop states (`Thinking`, `Searching AST`, `Synthesizing`) with hard 4,096 token caps.
  - Developer Workspace: Split-pane UI with real-time ReAct loop tracker and syntax-highlighted Python AST viewer.

## Strategic Decision: Browser vs. Electron
- **Current Decision:** Do **not** spend time rewriting/bundling into Electron during the active FYP development phase. Maintain the decoupled browser SPA/PWA architecture.
- **FYP Dissertation Plan:** Formulate the Browser vs. Electron comparison as a dedicated discussion on architectural trade-offs:
  - Contrast browser sandbox constraints (File System Access API, WebGPU browser memory caps) against native desktop capabilities (direct OS filesystem access, embedded Python sidecar, VS Code/IDE URI handlers, Model Context Protocol).
  - Present Electron as the formal **"Productionization & Future Work"** roadmap.

## Upcoming Milestone & Meeting
- **Nov / Dec Zoom Meeting:** Scheduled with supervisor, fellow students, and **Alex (NemoIR creator/developer)**.
- **Deliverables to Prepare:**
  - Polished demo of the browser split-pane interface and ReAct state transitions.
  - Verification of `useNemoIR` WebAssembly workflow execution and token budgeting.
  - Concrete benchmark metrics: retrieval latency, token consumption, and AST chunk precision.

## Living UI Knowledge Base & Agent Learning Directives
- **Master Reference Document:** [`DESIGN_SYSTEM.md`](file:///c:/Users/kangy/Desktop/Fyp/DESIGN_SYSTEM.md)
- **Agent Protocol:** Any agent modifying or adding UI components in `showcase/` or `frontend/` must read and follow [`DESIGN_SYSTEM.md`](file:///c:/Users/kangy/Desktop/Fyp/DESIGN_SYSTEM.md).
- **Continuous Learning:** When new design patterns, color tokens, animations, or testing quirks are discovered or introduced, agents must record them in non-verbose summaries directly inside [`DESIGN_SYSTEM.md`](file:///c:/Users/kangy/Desktop/Fyp/DESIGN_SYSTEM.md).

