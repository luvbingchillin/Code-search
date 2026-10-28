import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface GraphNode {
  id: string;
  stepNum: string;
  name: string;
  role: string;
  x: number;
  y: number;
  summary: string;
  liveData: string;
}

export const ArchitectureFlow: React.FC = () => {
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const nodes: GraphNode[] = [
    {
      id: 'query',
      stepNum: '01',
      name: 'User Question',
      role: 'Browser Input',
      x: 75,
      y: 130,
      summary: 'You ask a question in plain English. The text stays completely inside your local browser memory with zero internet requests.',
      liveData: '"Where is HTTPAdapter initialized?"'
    },
    {
      id: 'nemoir',
      stepNum: '02',
      name: 'NemoIR Harness',
      role: 'Wasm Orchestrator',
      x: 235,
      y: 130,
      summary: 'A fast compiled WebAssembly harness coordinates the search steps and enforces memory safety so your browser never freezes.',
      liveData: 'State: Planning • NemoIR Token Budget: 4,096 safe'
    },
    {
      id: 'lancedb',
      stepNum: '03',
      name: 'LanceDB Vectors',
      role: 'Semantic Search',
      x: 425,
      y: 65,
      summary: 'Scans your locally stored vector database for files that semantically match the meaning of your question.',
      liveData: 'Matched: sessions.py (similarity 0.84)'
    },
    {
      id: 'treesitter',
      stepNum: '04',
      name: 'Tree-sitter AST',
      role: 'Syntax Parser',
      x: 425,
      y: 195,
      summary: 'Parses the actual Python grammar to extract the complete, intact function node without cutting through signatures or decorators.',
      liveData: 'Intact: HTTPAdapter.send (Lines 728–765)'
    },
    {
      id: 'multihop',
      stepNum: '05',
      name: 'Symbol Graph',
      role: 'Dependency Resolver',
      x: 615,
      y: 130,
      summary: 'Automatically follows how functions connect across modules: traces callers, helper utilities, and parent classes.',
      liveData: 'Resolved: sessions.py -> adapters.py -> pool'
    },
    {
      id: 'webgpu',
      stepNum: '06',
      name: 'WebGPU AI Model',
      role: 'Local SLM Engine',
      x: 800,
      y: 130,
      summary: 'Executes the AI model directly against your device graphics card (GPU) shaders to write the explanation with zero cloud leaks.',
      liveData: 'Running Qwen2.5-Coder locally on GPU'
    },
    {
      id: 'workspace',
      stepNum: '07',
      name: 'Split-Pane UI',
      role: 'Code & Explanation',
      x: 970,
      y: 130,
      summary: 'Presents the AI\'s compiler-accurate architectural explanation side-by-side with the verified, syntax-highlighted source code.',
      liveData: 'Explanation ready • Line-numbered code synced'
    }
  ];

  // Auto-play timer for query simulation across all 7 nodes
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveNodeIndex((prev) => (prev < nodes.length - 1 ? prev + 1 : 0));
      }, 2400);
    }
    return () => clearInterval(timer);
  }, [isPlaying, nodes.length]);

  const activeNode = nodes[activeNodeIndex];

  return (
    <section id="pipeline" className="py-24 md:py-32 border-b border-[#dad0a7]/30">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0a1f10]/5 border border-[#0a1f10]/15 text-xs font-mono font-bold text-[#0a1f10] uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
              <span>[ RUNTIME BLUEPRINT // DIRECTED PIPELINE ]</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black font-display text-[#0a1f10] uppercase tracking-tight mb-3">
              How The Machine Operates
            </h2>
            <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
              Watch information travel across the connected pipeline—from your question to verified code on your screen.
            </p>
          </div>

          {/* Animation Controls */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#0a1f10] hover:bg-[#143520] border border-[#dad0a7]/30 text-[#f4f3eb] text-xs font-mono font-bold transition-all shadow-md"
              title={isPlaying ? 'Pause graph animation' : 'Play graph animation'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-[#68f12b]" />
                  <span>Pause Graph</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#68f12b] fill-[#68f12b]" />
                  <span>Animate Graph</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setActiveNodeIndex(0);
                setIsPlaying(true);
              }}
              className="p-2 rounded-xl bg-[#0a1f10] text-[#dad0a7] hover:text-[#68f12b] border border-[#dad0a7]/30 transition-colors shadow-md"
              title="Restart from Step 1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Industrial Blueprint Canvas */}
        <div className="rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 p-5 sm:p-7 mb-8 overflow-hidden shadow-2xl relative select-none">
          {/* Subtle blueprint grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: 'radial-gradient(rgba(104, 241, 43, 0.2) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Desktop Canvas */}
          <div className="hidden md:block overflow-x-auto relative z-10">
            <div className="min-w-[1040px] h-[260px] relative">
              {/* SVG Canvas with Paths, Arrows, and Moving Glowing Particles */}
              <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 1060 260">
                <defs>
                  {/* Glowing filter for traveling data packets */}
                  <filter id="packet-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Directional Arrowheads */}
                  <marker
                    id="arrow-lime"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#68f12b" />
                  </marker>
                  <marker
                    id="arrow-muted"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#dad0a7" opacity="0.6" />
                  </marker>
                </defs>

                {/* 1 -> 2: Query into Wasm Agent */}
                <path
                  id="path-1-2"
                  d="M 130 130 L 177 130"
                  stroke="#68f12b"
                  strokeWidth="2"
                  className="flowing-wire opacity-80"
                  markerEnd="url(#arrow-lime)"
                />

                {/* 2 -> 3: Branch up to LanceDB Vectors */}
                <path
                  id="path-2-3"
                  d="M 292 130 C 330 130, 330 65, 362 65"
                  stroke="#dad0a7"
                  strokeWidth="2"
                  strokeOpacity="0.4"
                  className="flowing-wire"
                  markerEnd="url(#arrow-muted)"
                />

                {/* 2 -> 4: Branch down to Tree-sitter AST */}
                <path
                  id="path-2-4"
                  d="M 292 130 C 330 130, 330 195, 362 195"
                  stroke="#68f12b"
                  strokeWidth="2"
                  className="flowing-wire opacity-80"
                  markerEnd="url(#arrow-lime)"
                />

                {/* 3 <-> 4: Synchronization bridge between vectors & AST grammar */}
                <path
                  id="path-3-4"
                  d="M 425 99 L 425 161"
                  stroke="#68f12b"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="flowing-wire opacity-60"
                />

                {/* 3 -> 5: Converge from LanceDB into Symbol Graph */}
                <path
                  id="path-3-5"
                  d="M 487 65 C 520 65, 520 130, 552 130"
                  stroke="#dad0a7"
                  strokeWidth="2"
                  strokeOpacity="0.4"
                  className="flowing-wire"
                  markerEnd="url(#arrow-muted)"
                />

                {/* 4 -> 5: Converge from Tree-sitter into Symbol Graph */}
                <path
                  id="path-4-5"
                  d="M 487 195 C 520 195, 520 130, 552 130"
                  stroke="#68f12b"
                  strokeWidth="2"
                  className="flowing-wire opacity-80"
                  markerEnd="url(#arrow-lime)"
                />

                {/* 5 -> 6: Symbol Graph to WebGPU AI */}
                <path
                  id="path-5-6"
                  d="M 677 130 L 742 130"
                  stroke="#68f12b"
                  strokeWidth="2"
                  className="flowing-wire opacity-80"
                  markerEnd="url(#arrow-lime)"
                />

                {/* 6 -> 7: WebGPU AI into Split-Pane Workspace */}
                <path
                  id="path-6-7"
                  d="M 857 130 L 912 130"
                  stroke="#68f12b"
                  strokeWidth="2"
                  className="flowing-wire opacity-90"
                  markerEnd="url(#arrow-lime)"
                />

                {/* Moving Glowing Data Packets along Every Pathway */}
                {isPlaying && (
                  <>
                    <circle r="4" fill="#68f12b" filter="url(#packet-glow)">
                      <animateMotion path="M 130 130 L 177 130" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#dad0a7" filter="url(#packet-glow)">
                      <animateMotion path="M 292 130 C 330 130, 330 65, 362 65" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#68f12b" filter="url(#packet-glow)">
                      <animateMotion path="M 292 130 C 330 130, 330 195, 362 195" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="3" fill="#68f12b" filter="url(#packet-glow)">
                      <animateMotion path="M 425 99 L 425 161" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#dad0a7" filter="url(#packet-glow)">
                      <animateMotion path="M 487 65 C 520 65, 520 130, 552 130" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#68f12b" filter="url(#packet-glow)">
                      <animateMotion path="M 487 195 C 520 195, 520 130, 552 130" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#68f12b" filter="url(#packet-glow)">
                      <animateMotion path="M 677 130 L 742 130" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#68f12b" filter="url(#packet-glow)">
                      <animateMotion path="M 857 130 L 912 130" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </svg>

              {/* Connected Interactive Node Cards */}
              {nodes.map((node, idx) => {
                const isActive = activeNodeIndex === idx;
                const isPast = idx < activeNodeIndex;

                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      setActiveNodeIndex(idx);
                      setIsPlaying(false);
                    }}
                    data-testid={`pipeline-step-btn-${idx}`}
                    style={{ left: `${node.x - 55}px`, top: `${node.y - 34}px` }}
                    className={`absolute w-[110px] p-2.5 rounded-2xl text-center transition-all duration-300 border ${
                      isActive
                        ? 'bg-[#143520] border-[#68f12b] ring-2 ring-[#68f12b]/40 shadow-[0_0_24px_rgba(104,241,43,0.35)] scale-105 z-20'
                        : isPast
                        ? 'bg-[#0a1f10] border-[#dad0a7]/40 text-[#f4f3eb] z-10'
                        : 'bg-[#06150b] border-[#dad0a7]/20 text-[#dad0a7]/70 hover:border-[#68f12b]/40 z-10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-mono font-bold ${isActive ? 'text-[#68f12b]' : 'text-[#dad0a7]'}`}>
                        {node.stepNum}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isActive
                            ? 'bg-[#68f12b] animate-pulse shadow-[0_0_8px_#68f12b]'
                            : isPast
                            ? 'bg-[#68f12b]/60'
                            : 'bg-zinc-700'
                        }`}
                      />
                    </div>
                    <div className="text-xs font-bold text-[#f4f3eb] truncate">
                      {node.name}
                    </div>
                    <div className="text-[10px] font-mono text-[#dad0a7] truncate mt-0.5">
                      {node.role}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Responsive Stepper */}
          <div className="block md:hidden space-y-2 relative z-10">
            <div className="text-xs font-mono font-bold text-[#68f12b] uppercase tracking-wider pb-2 border-b border-[#dad0a7]/20">
              Interactive Execution Steps:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nodes.map((node, idx) => {
                const isActive = activeNodeIndex === idx;
                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      setActiveNodeIndex(idx);
                      setIsPlaying(false);
                    }}
                    className={`p-2.5 rounded-xl text-left transition-all border ${
                      isActive
                        ? 'bg-[#143520] border-[#68f12b] shadow-md ring-1 ring-[#68f12b]/40'
                        : 'bg-[#06150b] border-[#dad0a7]/20 text-[#dad0a7]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono font-bold text-[#68f12b]">
                        {node.stepNum}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#68f12b]' : 'bg-zinc-700'}`} />
                    </div>
                    <div className="text-xs font-bold text-[#f4f3eb] truncate">
                      {node.name}
                    </div>
                    <div className="text-[10px] font-mono text-[#dad0a7] truncate">
                      {node.role}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Packet Telemetry & Inspection Card */}
        <div className="rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 p-7 sm:p-8 text-[#f4f3eb] shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-dashed border-[#dad0a7]/20">
            <div>
              <div className="text-xs font-mono font-bold text-[#68f12b] uppercase tracking-wider mb-1">
                NODE {activeNode.stepNum} // {activeNode.role}
              </div>
              <h3 className="text-2xl font-black font-display uppercase tracking-tight text-[#f4f3eb]">
                {activeNode.name}
              </h3>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-[#06150b] border border-[#68f12b]/40 font-mono text-xs text-[#68f12b] shadow-inner">
              <span className="text-[#dad0a7] mr-1.5 select-none">PACKET:</span>
              <span>{activeNode.liveData}</span>
            </div>
          </div>

          <p className="text-sm sm:text-base text-[#dad0a7] font-sans leading-relaxed mb-6">
            {activeNode.summary}
          </p>

          <div className="flex items-center space-x-3 text-xs font-mono pt-3 border-t border-[#dad0a7]/15">
            <button
              onClick={() => {
                setActiveNodeIndex((prev) => (prev > 0 ? prev - 1 : nodes.length - 1));
                setIsPlaying(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#06150b] text-[#dad0a7] hover:text-[#f4f3eb] border border-[#dad0a7]/30 hover:border-[#68f12b]/40 transition-colors font-bold"
            >
              ← Previous Node
            </button>
            <button
              onClick={() => {
                setActiveNodeIndex((prev) => (prev < nodes.length - 1 ? prev + 1 : 0));
                setIsPlaying(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#68f12b] text-[#0a1f10] font-bold hover:bg-[#7aff3d] transition-colors shadow-[0_0_12px_rgba(104,241,43,0.3)]"
            >
              Next Node →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
