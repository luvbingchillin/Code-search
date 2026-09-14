# Generative Code Retrieval: Search Engine for Open Source Software

An autonomous, privacy-first developer onboarding tool that retrieves and explains Python codebase architectures using Edge AI. 

This project evolved from the CodeOrient baseline to solve its three critical flaws: semantic fragmentation, cloud latency, and lack of data privacy.

## Features

- **100% Edge-Computed Privacy**: No code is ever sent to cloud APIs (OpenAI/Anthropic). All inference and retrieval happen locally on your hardware.
- **AST-Driven Ingestion**: Utilizes Tree-sitter instead of naive text splitters to extract structurally complete functions and classes, completely eliminating semantic fragmentation.
- **Autonomous Multi-Hop Retrieval**: The agent intelligently traverses the structural codebase graph to resolve internal dependencies before synthesizing an answer.
- **Deterministic Agentic Loop**: Compiled WebAssembly workflows (NemoIR) strictly manage the ReAct loop and enforce a hard 4,096 token limit to prevent browser VRAM crashes.
- **Split-Pane UI Workspace**: A seamless React interface allowing developers to chat with the agent while simultaneously inspecting the exact syntax-highlighted AST chunks being referenced.

## Tech Stack

**Frontend (Edge Inference & UI)**
- **Core Framework**: React 19, TypeScript, Vite 6
- **Styling**: TailwindCSS
- **Edge Inference Engine**: WebLLM (executing quantized SLMs like Qwen2.5-Coder via WebGPU)
- **Agent Orchestration**: NemoIR (WebAssembly ReAct loops)
- **Code Visualization**: PrismJS (Python syntax highlighting)
- **Automated Testing**: Vitest, React Testing Library

**Backend (Offline Ingestion Pipeline)**
- **Language**: Python
- **AST Parser**: Tree-sitter (`tree-sitter-python`)
- **Embeddings**: SentenceTransformers (e.g., `all-MiniLM-L6-v2`)
- **Vector Storage**: Local Vector DB (LanceDB / ChromaDB)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A WebGPU-compatible browser (e.g., Chrome, Edge) for local SLM execution

### Installation
1. Clone the repository to your local machine.
2. Navigate into the frontend directory and install the dependencies:
   ```bash
   cd frontend
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open your browser and navigate to `http://localhost:5173`.
2. **Initialize Local Ingestion (Future Feature)**: Use the Python backend CLI to parse and ingest a local Python repository (e.g., FastAPI) using Tree-sitter.
3. **Query the Codebase**: In the left-hand Chat Pane, ask an architectural question (e.g., *"How is the authentication middleware structured?"*).
4. **Monitor the Agent**: Watch the Agentic Loop Banner track the local agent's state as it transitions between *Thinking*, *Searching AST*, and *Synthesizing*.
5. **Inspect the Code**: View the exact Python AST chunks the agent retrieved in the right-hand Code Viewer Pane, complete with accurate source line numbers and multi-hop tabs.
