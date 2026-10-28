import React, { useRef, useEffect, useState } from 'react';

export const MosaicTileReveal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false
  });

  useEffect(() => {
    // Avoid JSDOM canvas warnings during automated testing
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

    let animId = 0;
    let width = 0;
    let height = 0;

    // Chande Mosaic Colors from window.CHANDE_FIELD.config
    const chandePalette = [
      '#07160c',
      '#0a2212',
      '#0e3218',
      '#134721',
      '#195f2d',
      '#21793a',
      '#309d47',
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
    }

    let tiles: Tile[] = [];
    const TILE_SIZE = 22; // Small square mosaic tiles from Chande first screen
    const GAP = 2.5;
    const RADIUS = 4;
    const HOVER_RADIUS = 95;

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

          const colRatio = c / cols;
          const colorIdx = Math.floor(colRatio * (chandePalette.length - 1));
          const color = chandePalette[colorIdx % chandePalette.length];
          const studColor = colRatio > 0.5 ? '#68f12b' : '#309d47';

          tiles.push({
            baseX: x,
            baseY: y,
            currX: x,
            currY: y,
            scale: 1,
            alpha: 1,
            color,
            studColor
          });
        }
      }
    };

    initTiles();

    const handleResize = () => {
      initTiles();
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active;

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];

        let targetX = t.baseX;
        let targetY = t.baseY;
        let targetScale = 1;
        let targetAlpha = 0.98;

        if (mouseActive) {
          const dx = (t.baseX + TILE_SIZE / 2) - mx;
          const dy = (t.baseY + TILE_SIZE / 2) - my;
          const dist = Math.hypot(dx, dy);

          if (dist < HOVER_RADIUS) {
            const norm = dist / HOVER_RADIUS;
            const infl = (1 - norm) * (1 - norm);

            // Radial scatter push
            const push = infl * 22;
            const dirX = dist > 1e-3 ? dx / dist : 0;
            const dirY = dist > 1e-3 ? dy / dist : 0;
            targetX += dirX * push;
            targetY += dirY * push;

            // Shrink and dissolve under cursor
            targetScale = Math.max(0.08, norm * norm);
            targetAlpha = Math.max(0, Math.pow(norm, 2.0) - 0.05);
          }
        }

        t.currX += (targetX - t.currX) * 0.22;
        t.currY += (targetY - t.currY) * 0.22;
        t.scale += (targetScale - t.scale) * 0.22;
        t.alpha += (targetAlpha - t.alpha) * 0.25;

        if (t.alpha <= 0.02 || t.scale <= 0.05) continue;

        const size = TILE_SIZE * t.scale;
        const rad = RADIUS * t.scale;
        const renderX = t.currX + (TILE_SIZE - size) / 2;
        const renderY = t.currY + (TILE_SIZE - size) / 2;

        ctx.save();
        ctx.globalAlpha = t.alpha;

        // 1. Draw rounded tile
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(renderX, renderY, size, size, Math.max(1, rad));
        } else {
          ctx.rect(renderX, renderY, size, size);
        }
        ctx.fillStyle = t.color;
        ctx.fill();

        // 2. Bevel hairline highlight
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(233, 255, 209, 0.2)';
        ctx.stroke();

        // 3. Central stud / dot
        if (size > 12) {
          const studX = renderX + size / 2;
          const studY = renderY + size / 2;
          const studR = Math.max(1, 1.8 * t.scale);

          ctx.beginPath();
          ctx.arc(studX, studY, studR, 0, Math.PI * 2);
          ctx.fillStyle = t.studColor;
          ctx.globalAlpha = t.alpha * 0.75;
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true
    };
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    mouseRef.current.active = false;
    setIsHovered(false);
  };

  return (
    <div className="mb-6 pt-1">
      {/* Narrative Telemetry Label */}
      <div className="flex items-center justify-between mb-2 text-[10px] font-mono">
        <span className="text-[#68f12b] font-bold uppercase tracking-wider flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#68f12b] animate-pulse" />
          <span>HOVER MOSAIC TILES TO REVEAL FULL PICTURE</span>
        </span>
        <span className="text-[#dad0a7]/60">
          {isHovered ? 'Scatter active' : 'Tiles flush'}
        </span>
      </div>

      {/* Frame Container */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative h-28 rounded-2xl bg-[#040e07] border border-[#68f12b]/30 overflow-hidden cursor-crosshair select-none shadow-inner"
      >
        {/* Hidden Multi-Hop Dependency Code Underneath */}
        <div className="absolute inset-0 p-3.5 font-mono text-[11px] text-[#f4f3eb] leading-relaxed flex flex-col justify-center pointer-events-none z-0">
          <div className="text-[#68f12b] font-bold text-[10px] uppercase tracking-wider mb-1">
            ✓ Full Dependency Graph Uncovered:
          </div>
          <div className="text-[#6ee7b7] truncate">
            sessions.py <span className="text-[#dad0a7]">&rarr;</span> adapters.HTTPAdapter <span className="text-[#dad0a7]">&rarr;</span> pool.urlopen()
          </div>
          <div className="text-[#dad0a7]/75 text-[10px] mt-1 truncate">
            Resolves 3-hop inheritance chain across 4 modules without truncation.
          </div>
        </div>

        {/* Chande Mosaic Canvas Layer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-auto z-10"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};
