# Code-Search Showcase & Landing Page

A dedicated, high-impact developer product showcase and explanation website for the **Generative Code Retrieval Search Engine** Final Year Project (FYP).

The site is themed with a bespoke **Casino Roulette Table** aesthetic (Monte Carlo roulette felt green, roulette red, wheel gold/brass, and crisp ivory typography), framing standard sliding-window chunkers as an unpredictable *gamble* (0.67% integrity, severe hallucination risk) and Tree-sitter AST + NemoIR WebAssembly as the *deterministic winning strategy* (100% integrity, 0 cloud leaks).

---

## 🌟 Core Features & Sections

1. **Header & Navigation**:
   - Roulette Zero logo emblem with gold foil accents.
   - Quick navigation to Architecture, AST vs. Naive, Benchmarks, Edge Pipeline, and Quickstart.
   - Direct, accessible link button to the [GitHub Repository](https://github.com/luvbingchillin/Code-search).

2. **Hero Section**:
   - High-stakes typography: *"Stop Gambling on Fragmented Codebases"*.
   - Value propositions: 100% On-Device Privacy, Tree-sitter Structural AST Ingestion, and NemoIR WebAssembly Guardrails.
   - Dual Call-to-Action buttons (GitHub Repository and Empirical Benchmarks).
   - One-click copyable Git clone snippet (`git clone https://github.com/luvbingchillin/Code-search.git`).
   - Four quick betting placarded stat highlights.

3. **Four Architectural Pillars**:
   - **Pillar 01: 100% Edge-Computed Privacy**: WebGPU shaders executing local quantized SLMs (Qwen2.5-Coder) with zero cloud telemetry.
   - **Pillar 02: Structural AST Ingestion Engine**: Tree-sitter Python parser extracting complete `FunctionDef` and `ClassDef` nodes with 100% SBIR.
   - **Pillar 03: Autonomous Multi-Hop Graph Traversal**: Resolves caller-callee dependencies across Python files before answering.
   - **Pillar 04: Deterministic Wasm Agentic Loop**: Compiled NemoIR WebAssembly state machine enforcing a hard 4,096 token limit to protect browser VRAM.

4. **The Chunker's Gamble: Side-by-Side AST vs. Naive Chunking Visualizer**:
   - Compare realistic code snippets from `fastapi/routing.py` and `requests/sessions.py`.
   - Side-by-side split view or individual view tabs highlighting sliced signatures, orphaned parameters, and dangling blocks vs. complete, syntactically whole AST nodes.

5. **Empirical Benchmarks & Query Audit Table**:
   - Key scorecards: **100.0% vs. 0.67% SBIR** (+99.33%), **0.5833 vs. 0.5522 MRR** (+5.6%), Recall@1, Recall@5, and 24.15ms latency.
   - Query category breakdown table (Architectural Flow, Entity Locating, Utility Logic).
   - Interactive, searchable, and filterable **Query-Level Audit Table** auditing all 30 queries from `benchmark/BENCHMARK_REPORT.md`.

6. **The Edge Pipeline: Interactive Flow**:
   - 6-step visual walkthrough from Developer Query Ingestion to WebGPU Synthesis and Split-Pane Code Inspection.

7. **Quickstart & Local Deployment**:
   - Tabbed copyable commands for launching the React 19 Edge UI, running the Python AST ingestion pipeline, and executing the benchmark suite.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- WebGPU-compatible browser (Google Chrome 113+, Microsoft Edge 113+)

### Local Development
```bash
cd showcase
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run Automated Tests
```bash
npm test
```

### Production Build
```bash
npm run build
```
The optimized static bundle will be built into `dist/`.

### Preview Production Build
```bash
npm run preview
```

---

## 🎨 Theme Details
- **Felt Green**: `#04160e` / `#051a11` / `#0a2d1d`
- **Roulette Red**: `#dc2626` / `#ef4444` / `#b91c1c`
- **Wheel Gold / Brass**: `#eab308` / `#f59e0b` / `#ca8a04`
- **Ivory**: `#fefce8` / `#fffbeb`
- **Fonts**: `Cinzel` (Luxury serif display), `Plus Jakarta Sans` (Clean interface sans), `JetBrains Mono` (Terminal & code).
