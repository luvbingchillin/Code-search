# Project: Frontend Edge AI Interface for Generative Code Retrieval Search Engine

## Architecture
A developer-grade desktop split-pane web application built with React 19, TypeScript, and Vite 6.
- **Left Pane (Chat & Agentic Loop)**: Developer queries the codebase. Features real-time visual tracking of the Edge AI ReAct loop states (`Idle`, `Thinking`, `Searching AST`, `Synthesizing`, `Complete`, `Error`), message history with interactive AST citations, and query suggestions.
- **Right Pane (Python AST Code Viewer)**: Displays retrieved AST code chunks with Python syntax highlighting via PrismJS, aligned line numbering matching original file `startLine`, chunk selection tabs, AST node metadata inspector (parameters, decorators, docstring), and clipboard copy.
- **Edge AI Scaffolding Layer**: Modular hooks (`useWebLLM`, `useNemoIR`, `useReActAgent`) with clean interfaces for WebGPU-accelerated WebLLM and WebAssembly `.nemo` vector retrieval workflows, paired with a resilient local simulator for zero-delay development and testing.
- **Automated Verification Harness**: Vitest + React Testing Library + JSDOM with ResizeObserver and WebGPU mocks verifying pane layouts, ReAct state transitions, Python syntax rendering, and zero-error TypeScript builds.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Project Scaffolding & Tooling | Vite + React 19 + TypeScript + Tailwind v4 + Vitest setup | M1 | Survey Fast 1 |
| F2 | Split-Pane Layout Container | Resizable split layout with left chat pane & right code viewer pane | M1 | Survey Fast 3 |
| F3 | Developer Chat Interface | Interactive chat history, prompt input, suggestion chips, send/stop | M2 | Survey Fast 3 |
| F4 | Python AST Code Viewer | PrismJS Python syntax highlighting, aligned line numbers, node type tags | M2 | Survey Fast 3 |
| F5 | Chunk Tabs & AST Inspector | Tabbed chunk selection, AST metadata drawer, copy-to-clipboard | M2 | Survey Fast 2 & 3 |
| F6 | ReAct Loop State Machine | Explicit states: "Thinking", "Searching AST", "Synthesizing", visual stepper | M3 | Survey Fast 2 & 3 |
| F7 | Edge AI Hooks Architecture | `useWebLLM`, `useNemoIR`, `useReActAgent` hooks with mock fallback | M3 | Survey Fast 1 & 2 |
| F8 | AST Chunk Benchmark Fixtures | Realistic FastAPI & LangChain AST code chunks with citations | M3 | Survey Fast 2 |
| F9 | Automated Acceptance Test Suite | Vitest/RTL tests verifying panes, state transitions, syntax & hooks | M4 | Survey Fast 3 |
| F10 | Clean TypeScript Build | `tsc -b` and `vite build` zero-error completion | M4 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Scaffolding & Split-Pane Layout | F1, F2: Package setup, Tailwind v4, SplitPaneLayout container, base shell | none | DONE |
| M2 | Chat UI & Python AST Code Viewer | F3, F4, F5: Chat input, message list, PrismJS Python viewer, chunk tabs | M1 | DONE |
| M3 | Edge AI State Machine & Hooks | F6, F7, F8: ReAct loop stepper, useWebLLM, useNemoIR, useReActAgent, AST data | M1 | DONE |
| M4 | Acceptance Verification & Build | F9, F10: Vitest suites, E2E validation, npm run build check | M2, M3 | DONE |

## Interface Contracts

### Data Model: `AstCodeChunk`
```typescript
export type AstNodeType = 'FunctionDef' | 'AsyncFunctionDef' | 'ClassDef' | 'Module' | 'Assign';

export interface AstCodeChunk {
  id: string;
  filePath: string;
  fileName: string;
  astNodeType: AstNodeType;
  identifier: string; // functionName or className
  startLine: number;
  endLine: number;
  code: string;
  relevanceScore: number; // 0.0 - 1.0
  docstring?: string;
  parameters?: string[];
  decorators?: string[];
}
```

### State Model: `ReActState` & `AgentStatus`
```typescript
export type ReActState = 'Idle' | 'Thinking' | 'Searching AST' | 'Synthesizing' | 'Complete' | 'Error';

export interface AgentStatus {
  state: ReActState;
  currentStepMessage: string;
  elapsedMs: number;
  activeChunkCount: number;
  error?: string;
}
```

### Hooks Contracts
- `useWebLLM()`: `{ status: 'unloaded' | 'loading' | 'ready'; progress: number; generate: (prompt: string) => Promise<string>; initEngine: () => Promise<void> }`
- `useNemoIR()`: `{ isReady: boolean; searchAstChunks: (query: string) => Promise<AstCodeChunk[]> }`
- `useReActAgent()`: `{ agentStatus: AgentStatus; messages: ChatMessage[]; activeChunks: AstCodeChunk[]; selectedChunkId: string | null; submitQuery: (query: string) => Promise<void>; cancelQuery: () => void; setSelectedChunkId: (id: string) => void }`

## Code Layout
Target directory: `c:/Users/kangy/Desktop/Fyp/frontend`
```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   └── index.ts
    ├── components/
    │   ├── layout/
    │   │   ├── Header.tsx
    │   │   └── SplitPaneLayout.tsx
    │   ├── chat/
    │   │   ├── ChatPane.tsx
    │   │   ├── AgenticLoopBanner.tsx
    │   │   ├── MessageList.tsx
    │   │   ├── QuerySuggestions.tsx
    │   │   └── ChatInput.tsx
    │   └── viewer/
    │       ├── CodeViewerPane.tsx
    │       ├── CodeViewerHeader.tsx
    │       ├── ChunkSelectorTabs.tsx
    │       ├── CodeDisplay.tsx
    │       └── ASTMetadataInspector.tsx
    ├── hooks/
    │   ├── useWebLLM.ts
    │   ├── useNemoIR.ts
    │   └── useReActAgent.ts
    ├── services/
    │   ├── mockAstData.ts
    │   └── agentSimulator.ts
    └── test/
        ├── setup.ts
        ├── SplitPaneLayout.test.tsx
        ├── AgenticLoopState.test.tsx
        ├── CodeViewerPane.test.tsx
        └── EdgeAIHooks.test.tsx
```

## DOM Test ID Conventions
- Container: `data-testid="split-pane-layout"`
- Left Pane: `data-testid="chat-pane"`
- Right Pane: `data-testid="code-viewer-pane"`
- Chat Input: `data-testid="chat-input-textarea"`
- Chat Send: `data-testid="chat-send-btn"`
- Agentic Banner: `data-testid="agentic-loop-banner"`
- Agentic State Label: `data-testid="agentic-state-label"`
- Code Display: `data-testid="code-display"`
- Copy Code Button: `data-testid="copy-code-btn"`
- Chunk Tabs: `data-testid="chunk-tab-{id}"`
- Line Numbers: `data-testid="line-number"`
