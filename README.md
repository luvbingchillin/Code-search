# Generative Code Retrieval: Search Engine for Open Source Software

An autonomous, privacy-first developer onboarding tool that retrieves and explains Python codebase architectures using Edge AI. 

This project evolved from the CodeOrient baseline to solve its three critical flaws: semantic fragmentation, cloud latency, and lack of data privacy.

## The Three Pillars of Architecture

1. **Tree-sitter AST Chunking (Ingestion)**
   Discards naive text splitters (like LangChain's RecursiveCharacterTextSplitter) in favor of Tree-sitter. This parses Python Abstract Syntax Trees (ASTs) to extract structurally complete entities (functions, classes), ensuring context remains intact for high multi-hop recall.

2. **NemoIR Agent Harness (Orchestration)**
   Utilizes a research compiler toolchain (`hkalexling/nemoir`) for structured agent workflows. Instead of standard JavaScript loops, NemoIR compiles `.nemo` workflows into WebAssembly to orchestrate a highly deterministic ReAct retrieval loop directly in the browser.

3. **WebLLM + WebGPU (Edge Inference)**
   Eliminates cloud latency and guarantees 100% IP privacy by running the generative agent entirely in the user's browser. We utilize WebLLM to run quantized Small Language Models (SLMs) like Qwen2.5-Coder directly on local hardware via WebGPU.

## Project Scope

- **Language Support:** Python codebases ONLY.
- **Scale:** Curated to 15-20 high-quality open-source repositories (e.g., FastAPI, LangChain).
- **Inference Constraints:** Hard-capped at 4,096 tokens to ensure browser VRAM stability. Pre-trained SLMs only.

## Directory Structure

* `/frontend`: The Vite + React + TypeScript edge UI. Features a split-pane layout with a chat interface on the left and a Python AST code viewer on the right. Includes integration hooks for WebLLM and NemoIR.
* `FYP_Report_CCDS25-0441.pdf`: Initial academic scoping and project plan documentation.

## Running the Frontend

Navigate to the frontend directory and start the local Vite development server:

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to interact with the UI.
