import React, { useState, useRef, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { Eye, EyeOff, Sparkles } from 'lucide-react';

interface TileState {
  id: number;
  row: number;
  col: number;
  symbol: string;
}

export const CodeRevealTiles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [forceRevealAll, setForceRevealAll] = useState(false);

  // Hidden code to be revealed
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

  // Generate 8 columns x 6 rows = 48 tiles
  const COLS = 8;
  const ROWS = 6;
  const tiles: TileState[] = useMemo(() => {
    const symbols = ['def', 'class', '@app', 'import', 'tokens', 'wasm', 'ast', 'gpu', 'priv', 'tree', '0x1A', 'void'];
    const list: TileState[] = [];
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
  };

  // Radius for mouse interaction (in pixels)
  const HOVER_RADIUS = 130;

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
              Hover to Uncover Hidden Code Structures
            </h2>
            <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
              Arbitrary chunkers leave critical signatures, nested dependencies, and decorators concealed behind black-box boundaries. Move your cursor across the tiles to peel back the surface and reveal compiler-verified AST nodes.
            </p>
          </div>

          {/* Interaction Trigger Buttons */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setForceRevealAll(!forceRevealAll)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#0a1f10] hover:bg-[#143520] border border-[#dad0a7]/30 text-[#68f12b] text-xs font-mono font-bold transition-all shadow-md"
            >
              {forceRevealAll ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>Conceal Tiles</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Reveal All Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Interactive Tile Canvas Container */}
        <div className="rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 overflow-hidden shadow-2xl relative">
          {/* Header Bar */}
          <div className="px-6 py-4 bg-[#06150b] border-b border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#68f12b] animate-pulse" />
              <span className="text-[#f4f3eb] font-bold">
                AST X-RAY INSPECTION: fastapi/routing_v2.py
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#dad0a7]">
              <Sparkles className="w-3.5 h-3.5 text-[#68f12b]" />
              <span>Hover anywhere across the grid to dissolve tiles</span>
            </div>
          </div>

          {/* Workspace Area: Code Layer + Tile Grid Layer */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative min-h-[360px] sm:min-h-[400px] p-6 sm:p-8 bg-[#040e07] cursor-crosshair overflow-hidden select-none"
          >
            {/* Underlying Highlighted Python Code (The "Truth") */}
            <div className="font-mono text-xs sm:text-sm text-[#f4f3eb] leading-relaxed relative z-0 pointer-events-none">
              <pre>
                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              </pre>
            </div>

            {/* Matrix of Tiles (Obscuring the Code) */}
            <div
              className={`absolute inset-0 grid grid-cols-8 grid-rows-6 gap-1 p-2 sm:p-3 pointer-events-none z-10 transition-opacity duration-500 ${
                forceRevealAll ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {tiles.map((tile) => {
                let scale = 1;
                let opacity = 0.95;
                let translateX = 0;
                let translateY = 0;

                if (cursorPos && containerRef.current) {
                  const width = containerRef.current.clientWidth;
                  const height = containerRef.current.clientHeight;

                  const tileCenterX = ((tile.col + 0.5) / COLS) * width;
                  const tileCenterY = ((tile.row + 0.5) / ROWS) * height;

                  const dx = tileCenterX - cursorPos.x;
                  const dy = tileCenterY - cursorPos.y;
                  const dist = Math.hypot(dx, dy);

                  if (dist < HOVER_RADIUS) {
                    const ratio = dist / HOVER_RADIUS; // 0 (center) to 1 (edge)
                    // Closer to mouse = much smaller, pushed away, transparent
                    scale = 0.2 + ratio * 0.7;
                    opacity = Math.max(0, ratio * ratio - 0.1);
                    const pushFactor = (1 - ratio) * 18;
                    translateX = (dx / (dist || 1)) * pushFactor;
                    translateY = (dy / (dist || 1)) * pushFactor;
                  }
                }

                return (
                  <div
                    key={tile.id}
                    style={{
                      transform: `translate(${translateX.toFixed(1)}px, ${translateY.toFixed(1)}px) scale(${scale.toFixed(2)})`,
                      opacity: opacity.toFixed(2),
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease'
                    }}
                    className="rounded-xl bg-[#092211] border border-[#68f12b]/20 flex flex-col items-center justify-center p-2 text-center text-[#dad0a7]/60 shadow-inner group"
                  >
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#68f12b]/70 tracking-wider">
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
          <div className="px-6 py-3.5 bg-[#06150b] border-t border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-[#dad0a7]">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
              <span>Tree-sitter AST preserves decorator chains &amp; type contracts</span>
            </span>
            <span className="text-[#68f12b] font-bold">
              100% Compiler-Verified Node
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
