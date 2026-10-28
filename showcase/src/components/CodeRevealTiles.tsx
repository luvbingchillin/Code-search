import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { Eye, EyeOff, Sparkles, Terminal } from 'lucide-react';

interface TileData {
  id: number;
  row: number;
  col: number;
  symbol: string;
}

export const CodeRevealTiles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [forceRevealAll, setForceRevealAll] = useState(false);
  const [revealedPercent, setRevealedPercent] = useState(0);

  // Compiler-verified Python code to reveal underneath
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

  // Matrix dimensions: 8 columns x 6 rows = 48 tiles
  const COLS = 8;
  const ROWS = 6;
  const tiles: TileData[] = useMemo(() => {
    const symbols = [
      'def', 'class', '@app.get', 'async', 'tokens', 'wasm',
      'AST', 'WebGPU', 'privacy', 'tree', '0x1A', 'void',
      'import', 'typing', 'depends', 'return', 'yield', 'router'
    ];
    const list: TileData[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = r * COLS + c;
        list.push({
          id,
          row: r,
          col: c,
          symbol: symbols[id % symbols.length]
        });
      }
    }
    return list;
  }, []);

  // Update cursor coordinates relative to container bounding box
  const updatePointer = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setCursorPos({ x, y });
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updatePointer(e.clientX, e.clientY);
  };

  const handlePointerLeave = () => {
    setCursorPos(null);
  };

  // Touch move support
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Interaction Radius (in px)
  const HOVER_RADIUS = 140;

  // Track how many tiles are currently displaced/revealed
  useEffect(() => {
    if (forceRevealAll) {
      setRevealedPercent(100);
      return;
    }
    if (!cursorPos || !containerRef.current) {
      setRevealedPercent(0);
      return;
    }
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    let count = 0;

    for (const tile of tiles) {
      const tileCenterX = ((tile.col + 0.5) / COLS) * width;
      const tileCenterY = ((tile.row + 0.5) / ROWS) * height;
      const dist = Math.hypot(tileCenterX - cursorPos.x, tileCenterY - cursorPos.y);
      if (dist < HOVER_RADIUS) count++;
    }
    setRevealedPercent(Math.round((count / tiles.length) * 100));
  }, [cursorPos, forceRevealAll, tiles]);

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
            <h2 className="text-3xl sm:text-5xl font-black font-display text-[#0a1f10] uppercase tracking-tight mb-3 chande-tilt">
              Hover to Uncover Hidden Code Structures
            </h2>
            <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
              Arbitrary chunkers leave critical signatures, nested dependencies, and decorators concealed behind black-box boundaries. Move your cursor across the tiles to peel back the surface and reveal compiler-verified AST nodes.
            </p>
          </div>

          {/* Action & Stats Controls */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#0a1f10]/5 border border-[#0a1f10]/15 font-mono text-xs font-bold text-[#0a1f10]">
              <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
              <span>Revealed: {revealedPercent}%</span>
            </div>
            <button
              onClick={() => setForceRevealAll(!forceRevealAll)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0a1f10] hover:bg-[#143520] active:scale-95 border border-[#dad0a7]/30 text-[#68f12b] text-xs font-mono font-bold transition-all shadow-md"
            >
              {forceRevealAll ? (
                <>
                  <EyeOff className="w-4 h-4 text-[#68f12b]" />
                  <span>Conceal Tiles</span>
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
              <span>Glide pointer or touch to part the mosaic tiles</span>
            </div>
          </div>

          {/* Interactive Canvas Container */}
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onTouchMove={handleTouchMove}
            className="relative min-h-[380px] sm:min-h-[420px] p-6 sm:p-9 bg-[#030d06] cursor-crosshair overflow-hidden select-none"
          >
            {/* Underlying Python Code Layer (Illuminated Compiler Truth) */}
            <div className="font-mono text-xs sm:text-sm text-[#f4f3eb] leading-relaxed relative z-0 pointer-events-none">
              <pre>
                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              </pre>
            </div>

            {/* Matrix of Tactile Fragmenting Tiles Overlay */}
            <div
              className={`absolute inset-0 grid grid-cols-8 grid-rows-6 gap-1 p-2 sm:p-3 pointer-events-none z-10 transition-opacity duration-300 ${
                forceRevealAll ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {tiles.map((tile) => {
                let scale = 1;
                let opacity = 0.96;
                let translateX = 0;
                let translateY = 0;
                let isNear = false;

                if (cursorPos && containerRef.current) {
                  const width = containerRef.current.clientWidth;
                  const height = containerRef.current.clientHeight;

                  const tileCenterX = ((tile.col + 0.5) / COLS) * width;
                  const tileCenterY = ((tile.row + 0.5) / ROWS) * height;

                  const dx = tileCenterX - cursorPos.x;
                  const dy = tileCenterY - cursorPos.y;
                  const dist = Math.hypot(dx, dy);

                  if (dist < HOVER_RADIUS) {
                    isNear = true;
                    // Normalized distance from 0 (center) to 1 (outer rim)
                    const normDist = dist / HOVER_RADIUS;
                    // Chande smoothstep ease: infl from 1.0 (dead center) to 0.0 (periphery)
                    const t = 1.0 - normDist;
                    const infl = t * t * (3.0 - 2.0 * t);

                    // Shrink aggressively near center (scale down to 0.12)
                    scale = Math.max(0.12, 1.0 - infl * 0.88);

                    // Radial push deflection away from cursor
                    const pushFactor = infl * 26;
                    const awayX = dist > 1e-3 ? dx / dist : 0;
                    const awayY = dist > 1e-3 ? dy / dist : 0;
                    translateX = awayX * pushFactor;
                    translateY = awayY * pushFactor;

                    // Fade to reveal code directly underneath
                    opacity = Math.max(0, Math.pow(normDist, 1.6) - 0.08);
                  }
                }

                return (
                  <div
                    key={tile.id}
                    style={{
                      transform: `translate(${translateX.toFixed(1)}px, ${translateY.toFixed(1)}px) scale(${scale.toFixed(2)})`,
                      opacity: opacity.toFixed(2),
                      transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease'
                    }}
                    className={`rounded-xl bg-[#092211] border ${
                      isNear ? 'border-[#68f12b]/60 shadow-[0_0_12px_rgba(104,241,43,0.3)]' : 'border-[#68f12b]/15'
                    } flex flex-col items-center justify-center p-1 sm:p-2 text-center text-[#dad0a7]/60 shadow-inner group`}
                  >
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#68f12b]/80 tracking-wider">
                      №{tile.id < 10 ? `0${tile.id}` : tile.id}
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-[#dad0a7]/40 truncate">
                      {tile.symbol}
                    </span>
                  </div>
                );
              })}
            </div>
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
