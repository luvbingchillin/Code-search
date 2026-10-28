---
target: frontend/src/App.tsx
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:C:\\Users\\kangy\\Desktop\\Fyp\\frontend\\src\\App.tsx"
target_fingerprint: "sha256:0e3feff9dc488424ecdc8f63704a10ab6defcb754b3116ea5bcff9ca7e8754cc"
target_path: "C:\\Users\\kangy\\Desktop\\Fyp\\frontend\\src\\App.tsx"
timestamp: 2026-10-20T14-41-48Z
slug: frontend-src-app-tsx
---
# Design Critique: CodeSeek AI Frontend

Method: dual-agent (A: d72445a2-d0d6-4fa6-950e-8d233f148e2e · B: 82061453-ebed-456e-9be8-215eb151005f)
Target: `frontend/src/App.tsx` (Split-Pane Developer Workspace)

---

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | **2** | Dual redundant status banners; 1.5GB WebLLM model download lacks progress bar / percentage. |
| 2 | Match System / Real World | **2** | Heavy compiler/runtime jargon ("Wasm SIMD", "FunctionDef", "ReAct Loop", "Token Stream") alienates junior developers. |
| 3 | User Control and Freedom | **2** | No session reset, no clear conversation history, cannot close individual tabs. |
| 4 | Consistency and Standards | **2** | Global `select-none` on root blocks copying text; unparsed raw markdown in chat; dual banners have divergent labels. |
| 5 | Error Prevention | **3** | Input and suggestion chips disabled during search, but query can be submitted when WebLLM is in error state. |
| 6 | Recognition Rather Than Recall | **3** | Great AST citation pills; however, no repository directory tree forces users to recall file hierarchy. |
| 7 | Flexibility and Efficiency of Use | **1** | Zero keyboard shortcuts (`Cmd+K`, tab switching, drawer toggling); all actions require repeated clicks. |
| 8 | Aesthetic and Minimalist Design | **1** | Severe visual clutter: left pane stacked with dual banners, two timers, two stop buttons, and raw token streams. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | **2** | Silent/cryptic WebLLM error state badge in header without diagnostic guidance or recovery steps. |
| 10 | Help and Documentation | **1** | No onboarding guidance, no tooltip explanations for AST terms, and no help modal explaining how Edge AI works. |
| **Total** | | **19 / 40** | **Poor (Major UX overhaul required)** |

---

### Design Specificity Verdict

**LLM Assessment:**
The interface exhibits an authentic code-intelligence foundation undermined by generic AI chatbot tropes and uncurated prototype scaffolding. The bi-directional AST citation bridge (chat pills linking to syntax-highlighted code chunks) and the AST metadata drawer (decorators, parameter signatures, and docstrings) are tailored for code exploration. However, the conversational pane falls into standard rounded-bubble chat patterns with unparsed raw text, while the left pane's upper half is consumed by two competing, stacked ReAct loop widgets (`AgenticLoopBanner` and `AgentRunner`) displaying duplicate timers, duplicate progress badges, and duplicate cancel buttons.

**Deterministic Scan Findings (4 Issues):**
1. `ai-color-palette` (Warning) — `frontend/src/components/layout/Header.tsx:15`: Generic purple/indigo AI gradient badge (`from-purple-600 to-indigo-500`), signaling an off-the-shelf AI demo rather than an authoritative developer tool.
2. `gray-on-color` (Warning) — `frontend/src/components/chat/ChatInput.tsx:77`: `text-gray-500` on `bg-purple-600` causing low-contrast button text in disabled/active states.
3. `bounce-easing` (Advisory) — `frontend/src/components/chat/AgenticLoopBanner.tsx:74`: `animate-bounce` on the search icon feels playful and dated rather than high-performance.
4. `bounce-easing` (Advisory) — `frontend/src/components/agent/AgentRunner.tsx:190`: Duplicate `animate-bounce` on the secondary search state icon.

**Visual Overlays & Browser Verification:**
Automated browser inspection (Playwright headless Chromium on `http://localhost:4173/`) confirmed successful page mounting, responsive split-pane drag handles, and DOM preflight injection. No live overlay injection was performed in human mode.

---

### Overall Impression
The core split-pane layout and AST code citation mechanism are technically impressive, but the user experience currently feels like an internal engineering debug harness rather than a developer tool. Consolidating the dual ReAct widgets, removing global text selection lockouts, and adding Markdown rendering will elevate this from an academic prototype to a release-grade developer product.

---

### What's Working
1. **Bi-Directional AST Citation Navigation:** Clicking citation badges inside conversational responses immediately focuses the exact code chunk in the right pane with aligned line numbers and PrismJS syntax highlighting.
2. **Deep AST Structural Inspector:** The bottom metadata drawer effectively exposes Python function decorators, formal parameters, and docstrings without leaving the code canvas.
3. **Fluid Resizable Split-Pane:** The draggable split layout provides responsive, clamped (25%–75%) viewport adjustment with intuitive cursor states.

---

### Priority Issues (P0–P3)

#### [P0] Global Text Selection Lockout (`select-none` on Root)
- **Why it matters:** Line 16 of `App.tsx` applies `select-none` to the root container. Users cannot highlight or copy text from code explanations, reasoning steps, or metadata badges.
- **Fix:** Remove `select-none` from `App.tsx`. Restrict `select-none` strictly to draggable handles, tab buttons, and chrome icons.
- **Suggested command:** `/impeccable harden`

#### [P1] Redundant Dual ReAct Loop Widgets (Frankenstein Scaffolding)
- **Why it matters:** `ChatPane.tsx` stacks both `AgenticLoopBanner` and `AgentRunner` vertically. They consume over 50% of the left viewport with duplicate state badges, duplicate timers, and duplicate stop buttons, pushing chat messages below the fold.
- **Fix:** Consolidate into a single compact 1-line execution status strip. Keep granular token streams and execution steps hidden behind a collapsible "Trace" drawer.
- **Suggested command:** `/impeccable distill`

#### [P2] Unparsed Markdown & Raw Code in Chat Messages
- **Why it matters:** `MessageList.tsx` renders chat responses as raw text (`whitespace-pre-wrap`). Bold syntax (`**CodeSeek AI**`), backticks, and code blocks appear as unstyled plain text, diminishing readability.
- **Fix:** Add a lightweight Markdown parser with syntax highlighting and one-click code copy buttons in assistant responses.
- **Suggested command:** `/impeccable typeset`

#### [P2] Opaque WebLLM Cold-Start & Model Download
- **Why it matters:** Loading a 1.5GB SLM into WebGPU takes 15–60s on first run with only a static `WebLLM: loading` badge in the header. Users assume the tab has crashed.
- **Fix:** Add a progress bar or modal displaying download percentage, megabytes transferred, and an explicit privacy assurance ("100% On-Device WebGPU Inference").
- **Suggested command:** `/impeccable onboard`

---

### Persona Red Flags

- **Alex (Impatient Power User):**
  - *No Keyboard Accelerators:* Cannot press `Cmd+K` or `/` to search, cannot navigate chunk tabs via arrow keys, and cannot dismiss panels with `Esc`.
  - *Viewport Wastage:* Alex is forced to look at uncollapsible suggestion chips and giant debug banners that crowd out code reading.
- **Jordan (Confused First-Timer):**
  - *Jargon Barrier:* Confronted with "Wasm SIMD", "ReAct Loop", and "AsyncFunctionDef" with zero tooltips or explanations.
  - *No Repository Anchor:* Cannot tell which open-source repository is loaded, what files exist, or how to load their own codebase.
- **Sam (Accessibility-Dependent User):**
  - *Low Contrast & Micro-Text:* Text at `10px` and `11px` in subdued grays (`text-gray-500` on `#030712`) fails WCAG AA 4.5:1 contrast standards.
  - *Missing Focus Rings:* Custom tabs and citation buttons lack high-contrast `:focus-visible` rings for keyboard-only navigation.

---

### Minor Observations
1. **Misleading Status Color:** `Header.tsx` hardcodes `text-emerald-400` on WebLLM status, rendering errors in green (`WebLLM: error`).
2. **Persistent Suggestion Chips:** The 4 query suggestions never dismiss or collapse after the conversation begins, permanently consuming vertical space.
3. **No Scroll Affordance on Tabs:** `ChunkSelectorTabs.tsx` hides scrollbars (`no-scrollbar`) without providing left/right navigation arrows for overflowing tabs.

---

### Questions to Consider
- *What if the left pane abandoned the standard chatbot bubble metaphor entirely, transforming into an interactive "Code Exploration Notebook" alongside the code?*
- *What if the ReAct loop was not an administrative header banner at all, but an inline "thinking trace" inside the assistant's message bubble that automatically collapses into a clean summary once verified?*
- *What if the code viewer featured an interactive AST mini-map, allowing developers to jump from a function up to its enclosing class, module, and package hierarchy with a single click?*
