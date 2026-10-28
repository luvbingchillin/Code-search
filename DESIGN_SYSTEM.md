# Global UI Knowledge Base & Agent Learning Document

> **Living Knowledge Base for Autonomous Agents:**  
> This document captures the design system, technical specifications, implementation blueprints, and architectural learnings established for the Code-Search showcase and frontend interfaces.  
> **Rule for all agents:** Consult this document before introducing UI changes, and record new patterns, discovered constraints, and design tokens here after implementation.

---

## 1. Design Philosophy & Aesthetic Identity
- **Design Language:** Neo-Tactile Brutalism & Editorial Analog Engineering (inspired by *chandebootcamp.com*).
- **Core Visual Contrast:** Warm aged tactile parchment (`#f4f3eb`) paired with deep forest moss (`#0a1f10`) and punctuated by high-voltage electric acid neon lime (`#68f12b`).
- **Tactile Feel:** Mechanical buttons with 2px down-press resistance, subtle hairline borders, perforated tear-away dividers, and physical surface elevations rather than flat software gradients.
- **Narrative Purpose:** Visually reinforce 100% edge privacy (the "watching eye" of cloud LLMs vs zero bytes leaving your machine) and AST structure clarity (revealing hidden dependencies beneath broken text chunks).

---

## 2. Typography Specification

Loaded via Google Fonts in [`showcase/index.html`](file:///c:/Users/kangy/Desktop/Fyp/showcase/index.html):
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Phudu:wght@500;600;700;800;900&display=swap" rel="stylesheet">
```

| Typeface | Tailwind Utility | Weights | Primary Role | Character & Formatting |
| :--- | :--- | :--- | :--- | :--- |
| **Phudu** | `font-display`, `h1`-`h4` | 600, 700, 800, 900 | Display Headlines | Neo-tactile brutalist headers, tight letter-spacing (`-0.01em`). |
| **Inter** | `font-sans` | 400, 500, 600 | Body & Prose | High-legibility UI body, navigation links, explanatory notes (`line-height: 1.6`). |
| **JetBrains Mono** | `font-mono` | 400, 500, 600 | Code & Telemetry | AST viewer, terminal commands, metric badges (`font-feature-settings: 'zero', 'calt'`). |

---

## 3. Color Tokens & Semantic Roles

```
[ Canvas: Parchment #f4f3eb ]  ───>  [ Primary Text: Deep Forest Moss #0a1f10 ]
             │                                        │
             ▼                                        ▼
[ Accent: Acid Lime #68f12b ]  ───>  [ Highlight Text: Deep Moss #0a1f10 ]
             │                                        │
             ▼                                        ▼
[ Border / Accent: Brass #dad0a7 ] ──> [ Card Surface: Pure White #ffffff / Dark Moss #0a1f10 ]
```

### Palette Cheat-Sheet
- **`#f4f3eb` (Parchment):** Main page background. Features a subtle `24px x 24px` radial dot grid: `radial-gradient(rgba(16, 42, 25, 0.08) 1px, transparent 0)`.
- **`#0a1f10` (Forest Moss):** Primary dark surface for cards, terminal background, headings, and high-contrast text.
- **`#68f12b` (Acid Neon Lime):** Primary action color, button fill, highlighter sweep, active pills, and glowing circuit accents.
- **`#7aff3d` (Acid Bright):** Hover state for buttons and clickable chips.
- **`#dad0a7` (Aged Brass):** Hairline borders on dark cards, muted subtitles, perforated line accents.
- **`#f8e7bf` (Sclera Cream):** Eye tracking sclera fill color.
- **`#ef4444` / `#f87171` (Alert Red):** Cloud privacy risk warnings and pulsing live radar rings.

### Code Syntax Highlighting Tokens (AST Code Blocks)
```css
.token.keyword     { color: #68f12b; font-weight: 700; } /* Acid Lime */
.token.function    { color: #6ee7b7; font-weight: 600; } /* Mint */
.token.class-name  { color: #67e8f9; font-weight: 600; } /* Cyan */
.token.string      { color: #fef08a; }                   /* Pale Yellow */
.token.comment     { color: #718096; font-style: italic; }/* Slate */
.token.operator    { color: #dad0a7; }                   /* Brass */
.token.decorator   { color: #f472b6; font-style: italic; }/* Pink */
```

---

## 4. Tactile Card Surfaces & Micro-Physics

### CSS Classes in [`showcase/src/index.css`](file:///c:/Users/kangy/Desktop/Fyp/showcase/src/index.css)
- **`.chande-dark`:** Deep moss card (`bg: #0a1f10`, `text: #f4f3eb`, `border: 1px solid rgba(218, 208, 167, 0.22)`, shadow `0 8px 30px rgba(10,31,16,0.12)`).
- **`.chande-light`:** White card on parchment (`bg: #ffffff`, `text: #0a1f10`, `border: 1px solid rgba(16, 42, 25, 0.14)`).
- **`.chande-card-hover`:** Elevates card on hover (`translateY(-4px)` with shadow `0 20px 40px rgba(10, 31, 16, 0.25)` and border glow `rgba(104, 241, 43, 0.55)`).
- **`.acid-btn`:** High-contrast button with snappy active click physics (`translateY(2px) scale(0.98)`).
- **`.chande-perforated` / `.chande-perforated-dark`:** `2px dashed` dividing lines giving a physical, tearable coupon appearance.

---

## 5. Key Interactive Animations & Blueprints

### 1. Hover-Activated Green Highlighter Sweep (`.highlight-sweep`)
* **File:** [`showcase/src/index.css`](file:///c:/Users/kangy/Desktop/Fyp/showcase/src/index.css)
* **Mechanic:** The green highlighter bar is hidden at rest (`scaleX(0)` with `transform-origin: left center`). On hover, it expands smoothly to `scaleX(1)` in `0.4s cubic-bezier(0.16, 1, 0.3, 1)`, and text transitions to deep moss (`#0a1f10`).
* **Usage:** Wrap any emphasized phrase inside display headings:
  ```html
  <h2>Stop Gambling on <span class="highlight-sweep">Fragmented Codebases</span></h2>
  ```

### 2. Autonomous Tracking Eye (`TrackingEye.tsx`)
* **File:** [`showcase/src/components/TrackingEye.tsx`](file:///c:/Users/kangy/Desktop/Fyp/showcase/src/components/TrackingEye.tsx)
* **Location:** Embedded in Pillar 01 (*100% Edge-Computed Privacy*).
* **Architecture:**
  - SVG coordinate frame: $W: 70$, $H: 42$, center $(34.2, 21.1)$, radii $(28.9, 15.3)$.
  - **Unified Pupil Group:** The pupil circle, neon green iris ring (`#68f12b`), and specular glint (`#ffffff`) are placed together inside `<g ref={pupilGroupRef}>`.
  - **Lerp Damping:** Coordinates update in RAF via `current += (target - current) * 0.18`.
  - **Autonomous Behaviors:** Eyelid spring bounce on mount (`700ms`), natural blinks every 4–7s, and an autonomous 3-point scan cycle (left $\to$ right $\to$ center) after 2.5s of mouse inactivity.

### 3. First-Screen Mosaic Field Canvas (`MosaicTileReveal.tsx`)
* **File:** [`showcase/src/components/MosaicTileReveal.tsx`](file:///c:/Users/kangy/Desktop/Fyp/showcase/src/components/MosaicTileReveal.tsx)
* **Location:** Embedded in Pillar 03 (*Sees the Full Picture*).
* **Architecture:**
  - Canvas layer rendering a grid of $22\text{px} \times 22\text{px}$ rounded square tiles ($4\text{px}$ corner radius, $2.5\text{px}$ gap).
  - 9-stop gradient ramp (`#07160c` $\to$ `#134721` $\to$ `#309d47` $\to$ `#68f12b`).
  - Tactile center studs and hairline gloss bevel reflex (`rgba(233, 255, 209, 0.2)`).
  - **Scatter Physics:** When the mouse approaches ($R < 95\text{px}$), tiles push away radially ($22\text{px} \times \text{influence}$) and dissolve (`scale: 0.08`, `alpha: 0`), revealing the multi-hop dependency graph beneath (`sessions.py -> adapters.HTTPAdapter -> pool.urlopen()`).
  - Smooth spring return with `0.22` velocity damping when cursor leaves.

### 4. Animated Wire & Pulse Indicators
* **Flowing Circuit Wire (`.flowing-wire`):** `stroke-dasharray: 6 6` animated infinitely via `flowDash` ($1.4\text{s}$) to demonstrate pipeline data movement.
* **Pulse Glow (`.animate-pulse-glow`):** Breathing acid lime box-shadow alternating between 8px and 24px blur for live edge-processing state indicators.

---

## 6. Critical Agent Learnings & Gotchas

> [!IMPORTANT]
> **Key Lessons Learned During Development — Avoid These Pitfalls:**

1. **JSDOM Canvas Protection in Vitest:**
   - *Problem:* JSDOM does not implement HTML5 Canvas `getContext('2d')`. Running Vitest tests on components containing `<canvas>` will spam warnings or fail tests.
   - *Fix:* Always guard canvas rendering loops with:
     ```ts
     if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;
     ```
2. **SVG Transform Synchronization:**
   - *Problem:* Attempting to translate SVG children (e.g., pupil and iris) with separate CSS styles or React state caused desynchronization and lag.
   - *Fix:* Group all translating SVG sub-elements in a single `<g ref={groupRef}>` and set `groupRef.current.style.transform` directly inside the `requestAnimationFrame` loop.
3. **Web Animation API Checks in Node / Vitest:**
   - *Problem:* `element.animate()` is missing in JSDOM, causing `TypeError: lidRef.current.animate is not a function`.
   - *Fix:* Always check `if (lidRef.current && typeof lidRef.current.animate === 'function')` before invoking WAAPI animations.
4. **Hover vs Permanent Highlighting:**
   - *Problem:* Static `.is-visible` classes on highlighted text create visual fatigue.
   - *Fix:* The highlighter bar must stay hidden at rest and sweep out dynamically only on `:hover`.
5. **No Scroll-Velocity Tilt Jitter:**
   - *Problem:* Skewing headings based on scroll velocity creates perceived layout jitter and distracts from content readability.
   - *Fix:* Avoid continuous scroll-skew transforms on text; use stable layout with rich hover micro-interactions instead.

---

## 7. How to Update This Document
When you build new features or modify UI:
1. Append new color hex codes to **Section 3** if introducing new semantic states.
2. Add animation physics parameters (damping, radius, duration) to **Section 5**.
3. Document any newly encountered testing or browser quirks in **Section 6 (Learnings & Gotchas)**.
