# Generative Code Retrieval: Search Engine for Open Source Software

An autonomous, privacy-first developer onboarding tool that retrieves and explains Python codebase architectures using Edge AI. 

This project evolved from the CodeOrient baseline to solve its three critical flaws: semantic fragmentation, cloud latency, and lack of data privacy.

## Features

- **100% Edge-Computed Privacy**: Zero cloud API dependencies. All inference, AST embedding, and vector retrieval execute locally on user hardware.
- **Dual-Tier WebGPU SLM Architecture**:
  - `⚡ Turbo 0.5B` (`Qwen2.5-Coder-0.5B`): Ultra-fast ~3–5s inference for rapid exploration.
  - `🎯 Precision 1.5B` (`Qwen2.5-Coder-1.5B`): Deep multi-hop technical reasoning.
  - One-click tier switching directly from the header with background WGSL compute shader warmup (Time to First Token < 1.5s).
- **Structural AST-Driven Ingestion**: Tree-sitter Python parser extracting complete function/class nodes with decorators, docstrings, and call-graph metadata to eliminate semantic fragmentation.
- **Index-Time Architecture Manifests**: Pre-computed architectural summaries delivering instant (< 5ms) codebase overview retrieval for `/overview` queries.
- **Autonomous Multi-Hop Retrieval**: The agent traverses internal dependency call graphs, enabling users to click AST badge references and navigate deep call stacks.
- **Deterministic Agentic Loop**: WebAssembly workflows (`@nemoir/compiler-wasm`) coordinate the ReAct loop (`Thinking` $\to$ `Searching AST` $\to$ `Synthesizing` $\to$ `Complete`) with bounded token budgeting.
- **Split-Pane Developer Workspace**: Neo-tactile brutalist interface featuring an interactive chat pane, dynamic query suggestions, a hierarchical file & symbol explorer, and a PrismJS AST code viewer with aligned file line numbers.

## Tech Stack

**Frontend (Edge Inference & UI)**
- **Core Framework**: React 19, TypeScript, Vite 6
- **Styling**: TailwindCSS v4 with Neo-Tactile Brutalist Design Tokens (Phudu / Inter / JetBrains Mono)
- **Edge Inference Engine**: `@mlc-ai/web-llm` (WebGPU quantized SLM execution)
- **Agent Orchestration**: `@nemoir/compiler-wasm`, `@nemoir/web-runtime`, `@nemoir/web-ui`
- **Code Visualization**: PrismJS (Python syntax highlighting with token-preserving keyword search)
- **Automated Testing**: Vitest 3, React Testing Library (547 automated tests)

**Backend (Retrieval & Ingestion Engine)**
- **Language & Framework**: Python 3.12, FastAPI, Uvicorn
- **AST Parser**: Tree-sitter (`tree-sitter-python`)
- **Embeddings**: SentenceTransformers (`all-MiniLM-L6-v2`, 384 dimensions)
- **Vector Storage**: LanceDB (primary columnar vector storage) & SQLite Vector Store (testing fallback)
- **Automated Testing**: Pytest 9 (306 automated tests)

## Getting Started

### Prerequisites
- Node.js (v18 or higher) & npm
- Python 3.10+ (Python 3.12 recommended) with pip
- A WebGPU-compatible browser (Google Chrome 113+, Microsoft Edge 113+)

---

### Running the Backend Server
1. Navigate to the backend directory and install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the FastAPI retrieval server on port 8000:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *(On startup, the server automatically initializes LanceDB at `data/lancedb` and pre-warms embedding weights.)*

---

### Running the Frontend Application
1. Navigate into the `frontend/` directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:5173`.

---

### Showcase & Interactive Demo Website
A dedicated showcase website featuring the **Casino Roulette Table** theme, interactive AST vs. naive chunking comparisons, and benchmark scorecards is located in `showcase/`:
```bash
cd showcase
npm install
npm run dev
```

---

## Testing & Quality Assurance

CodeSeek AI features a comprehensive regression and adversarial test suite with **853 passed tests** across frontend and backend:

- **Frontend Vitest Suite** (547 tests):
  ```bash
  cd frontend
  npm test
  ```
- **Backend Pytest Suite** (306 tests):
  ```bash
  pytest backend/app/tests
  ```

---

## Usage Workflow

1. **Connect & Index Codebases**:
   - Click the **Repositories** button in the header.
   - Choose a pre-indexed codebase (`psf/requests`, `sample_codebase`) or enter a local filesystem directory to scan and ingest new Python source files.
2. **Select Inference Model Tier**:
   - In the header, toggle between `⚡ Turbo 0.5B` (recommended for ultra-fast exploration) and `🎯 Precision 1.5B` (for deep logic analysis).
   - Click **WebLLM: Click to Load** to initialize the WebGPU engine.
3. **Query Code Architecture**:
   - Ask overview questions (e.g. *"what does this codebase do"*, `"/overview"`) or specific logic questions (e.g. *"How does Session.send handle retries?"*).
4. **Inspect Structural AST**:
   - The right-hand pane renders exact syntax-highlighted AST functions and classes, with docstrings, decorators, parameters, and interactive callee navigation badges.
