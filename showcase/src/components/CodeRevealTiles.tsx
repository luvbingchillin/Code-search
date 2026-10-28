import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { Eye, EyeOff, Sparkles, Terminal } from 'lucide-react';

export const CodeRevealTiles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [forceRevealAll, setForceRevealAll] = useState(false);
  const [revealedPercent, setRevealedPercent] = useState(0);

  // Python AST Code to reveal
  const hiddenCode = `@app.get(
    "/api/v2/analyze/{repository_id}",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    tags=["AstEngine", "PrivacyAudit"],
    dependencies=[Depends(verify_local_edge_token)]
)
def extract_complete_ast(
    repository_id: str,
    depth: int = Query(default=3, ge=1, le=10),
    harness: WasmMemoryGovernor = Depends(get_nemoir_governor)
) -> AnalysisResponse:
    """Extract complete syntax tree and verify compiler boundaries."""
    node = treesitter.parse_function(symbol="APIRoute.__init__")
    
    # NemoIR Wasm Harness guarantees hard 4,096 token ceiling
    if harness.token_budget_exceeded(node.tokens):
        raise WasmMemoryGovernorException("Budget breach prevented")
        
    explanation = webgpu_slm.synthesize(
        prompt=f"Explain {node.identifier} with compiler-accuracy",
        context=node.source_code,
        zero_cloud_transmission=True
    )
    return AnalysisResponse(status="success", payload=explanation)`;

  const highlightedCode = useMemo(() => {
    try {
      return Prism.highlight(hiddenCode, Prism.languages.python, 'python');
    } catch {
      return hiddenCode;
    }
  }, [hiddenCode]);

  // Pointer state for canvas
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false
  });

  // Canvas drawing loop with Chande Bootcamp's exact mosaic specifications
  useEffect(() => {
    // Avoid JSDOM canvas warning during tests
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    // Safety fallback for JSDOM/older environments where roundRect is not defined
    if (typeof ctx.roundRect !== 'function') {
      (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number) => void }).roundRect = function(x: number, y: number, w: number, h: number) {
        ctx!.rect(x, y, w, h);
      };
    }

    let animId = 0;
    let width = 0;
    let height = 0;

    // Chande Mosaic Palette
    // Colors: #0a1f10 (obsidian), #0f6b2a (forest), #68f12b (acid lime), #e9ffd1 (mint highlight)
    const chandePalette = [
      '#08180d',
      '#0b2313',
      '#0f351a',
      '#154a24',
      '#1c6130',
      '#247d3d',
      '#35a34e',
      '#5cf11e',
      '#68f12b'
    ];

    interface Tile {
      baseX: number;
      baseY: number;
      currX: number;
      currY: number;
      scale: number;
      alpha: number;
      color: string;
      studColor: string;
      phase: number;
    }

    let tiles: Tile[] = [];
    const TILE_SIZE = 26; // Exact square tile size from Chande hero
    const GAP = 3;
    const RADIUS = 5;
    const HOVER_RADIUS = 135;

    const initTiles = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = container.clientWidth;
      height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      const step = TILE_SIZE + GAP;
      const cols = Math.ceil(width / step) + 1;
      const rows = Math.ceil(height / step) + 1;

      tiles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * step;
          const y = r * step;

          // Slats color ramp across columns matching Chande hero field
          const colRatio = (c / cols);
          const colorIdx = Math.floor(colRatio * (chandePalette.length - 1));
          const color = chandePalette[colorIdx % chandePalette.length];
          const studColor = colRatio > 0.6 ? '#68f12b' : '#35a34e';

          tiles.push({
            baseX: x,
            baseY: y,
            currX: x,
            currY: y,
            scale: 1,
            alpha: 1,
            color,
            studColor,
            phase: (c * 0.12 + r * 0.08)
          });
        }
      }
    };

    initTiles();

    const handleResize = () => {
      initTiles();
    };
    window.addEventListener('resize', handleResize);

    // Animation Render Loop
    let time = 0;
    const render = () => {
      time += 0.03;
      ctx.clearRect(0, 0, width, height);

      let openedCount = 0;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active && !forceRevealAll;

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];

        // Target state based on hover scatter
        let targetX = t.baseX;
        let targetY = t.baseY;
        let targetScale = 1;
        let targetAlpha = forceRevealAll ? 0 : 0.98;

        if (mouseActive) {
          const dx = (t.baseX + TILE_SIZE / 2) - mx;
          const dy = (t.baseY + TILE_SIZE / 2) - my;
          const dist = Math.hypot(dx, dy);

          if (dist < HOVER_RADIUS) {
            openedCount++;
            const norm = dist / HOVER_RADIUS; // 0 (dead center) to 1 (rim)
            const infl = (1 - norm) * (1 - norm); // Quadratic drop-off

            // Radial scatter push
            const push = infl * 28;
            const dirX = dist > 1e-3 ? dx / dist : 0;
            const dirY = dist > 1e-3 ? dy / dist : 0;
            targetX += dirX * push;
            targetY += dirY * push;

            // Aggressive shrink & dissolve directly under cursor
            targetScale = Math.max(0.08, norm * norm);
            targetAlpha = Math.max(0, Math.pow(norm, 2.2) - 0.05);
          }
        }

        // Spring-damping interpolation
        t.currX += (targetX - t.currX) * 0.22;
        t.currY += (targetY - t.currY) * 0.22;
        t.scale += (targetScale - t.scale) * 0.22;
        t.alpha += (targetAlpha - t.alpha) * 0.25;

        // Skip drawing invisible tiles for max performance
        if (t.alpha <= 0.02 || t.scale <= 0.05) continue;

        const size = TILE_SIZE * t.scale;
        const rad = RADIUS * t.scale;
        const renderX = t.currX + (TILE_SIZE - size) / 2;
        const renderY = t.currY + (TILE_SIZE - size) / 2;

        ctx.save();
        ctx.globalAlpha = t.alpha;

        // 1. Draw rounded tile body
        ctx.beginPath();
        ctx.roundRect(renderX, renderY, size, size, Math.max(1, rad));
        ctx.fillStyle = t.color;
        ctx.fill();

        // 2. Bevel hairline highlight on top-left edge (Chande bevel: 0.32)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(233, 255, 209, 0.18)';
        ctx.stroke();

        // 3. Central stud / dot on tile (Chande studs: 0.56)
        if (size > 14) {
          const studX = renderX + size / 2;
          const studY = renderY + size / 2;
          const studR = Math.max(1, 2 * t.scale);

          ctx.beginPath();
          ctx.arc(studX, studY, studR, 0, Math.PI * 2);
          ctx.fillStyle = t.studColor;
          ctx.globalAlpha = t.alpha * 0.7;
          ctx.fill();
        }

        ctx.restore();
      }

      // Update telemetry pill
      if (forceRevealAll) {
        setRevealedPercent(100);
      } else if (tiles.length > 0) {
        setRevealedPercent(Math.min(100, Math.round((openedCount / (tiles.length * 0.25)) * 100)));
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [forceRevealAll]);

  // Pointer event handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true
    };
  };

  const handlePointerLeave = () => {
    mouseRef.current.active = false;
  };

  return (
    <section id="reveal-tiles" className="py-24 md:py-32 border-b border-[#dad0a7]/30">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0a1f10]/5 border border-[#0a1f10]/15 text-xs font-mono font-bold text-[#0a1f10] uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
              <span>[ STRUCTURAL X-RAY // INTERACTIVE CODE REVEAL ]</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black font-display text-[#0a1f10] uppercase tracking-tight mb-3">
              Hover to Uncover <span className="highlight-sweep is-visible">Hidden Code Structures</span>
            </h2>
            <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
              Arbitrary chunkers leave critical signatures, nested dependencies, and decorators concealed behind black-box boundaries. Move your cursor across the Chande mosaic tiles to part the surface and reveal compiler-verified AST nodes.
            </p>
          </div>

          {/* Action & Stats Controls */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#0a1f10]/5 border border-[#0a1f10]/15 font-mono text-xs font-bold text-[#0a1f10]">
              <span className="w-2 h-2 rounded-full bg-[#68f12b] shadow-[0_0_6px_#68f12b]" />
              <span>Revealed: {revealedPercent}%</span>
            </div>
            <button
              onClick={() => setForceRevealAll(!forceRevealAll)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0a1f10] hover:bg-[#143520] active:scale-95 border border-[#dad0a7]/30 text-[#68f12b] text-xs font-mono font-bold transition-all shadow-md"
            >
              {forceRevealAll ? (
                <>
                  <EyeOff className="w-4 h-4 text-[#68f12b]" />
                  <span>Conceal Mosaic Tiles</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-[#68f12b]" />
                  <span>Reveal All Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Industrial Hardware Reveal Casing */}
        <div className="rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 overflow-hidden shadow-2xl relative group">
          {/* Hardware Header Bar */}
          <div className="px-6 py-4 bg-[#06150b] border-b border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#68f12b] shadow-[0_0_8px_#68f12b]" />
              <span className="text-[#f4f3eb] font-bold tracking-wide">
                AST X-RAY INSPECTION: fastapi/routing_v2.py
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#dad0a7]">
              <Sparkles className="w-3.5 h-3.5 text-[#68f12b]" />
              <span>Glide pointer across the green mosaic tiles to dissolve them</span>
            </div>
          </div>

          {/* Interactive Canvas Container */}
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className="relative min-h-[400px] sm:min-h-[440px] p-6 sm:p-9 bg-[#030d06] cursor-crosshair overflow-hidden select-none"
          >
            {/* Underlying Python Code Layer (Illuminated Compiler Truth) */}
            <div className="font-mono text-xs sm:text-sm text-[#f4f3eb] leading-relaxed relative z-0 pointer-events-none">
              <pre>
                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              </pre>
            </div>

            {/* Chande Mosaic Canvas Layer (The exact mosaic tiles from the landing page first screen) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-auto z-10"
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-4 bg-[#06150b] border-t border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-[#dad0a7]">
            <span className="flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-[#68f12b]" />
              <span>Tree-sitter AST preserves decorator chains &amp; type contracts</span>
            </span>
            <span className="text-[#68f12b] font-bold">
              100% COMPILER-VERIFIED NODE
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
