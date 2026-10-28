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
    <section id="pipeline" className="py-24 md:py-32 border-b border-amber-900/20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <div className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest mb-2">
              Interactive Execution Graph
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f7f4] tracking-tight mb-2">
              How The Machine Operates
            </h2>
            <p className="text-base text-[#9cb3a8] leading-relaxed">
              Watch information travel across the connected pipeline—from your question to verified code on your screen.
            </p>
          </div>

          {/* Animation Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#082a1b] hover:bg-[#0c3824] border border-amber-600/30 text-amber-200 text-xs font-mono transition-colors shadow-sm"
              title={isPlaying ? 'Pause graph animation' : 'Play graph animation'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>Pause Graph</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Animate Graph</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setActiveNodeIndex(0);
                setIsPlaying(true);
              }}
              className="p-1.5 rounded-full bg-[#03130b] text-[#9cb3a8] hover:text-[#f4f7f4] border border-amber-900/30 transition-colors"
              title="Restart from Step 1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Directed Node Graph Canvas */}
        <div className="rounded-xl brass-border p-4 sm:p-6 mb-8 overflow-hidden bg-[#03110a] relative select-none">
          {/* Desktop Canvas */}
          <div className="hidden md:block overflow-x-auto">
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
                    id="arrow-amber"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#d97706" />
                  </marker>
                  <marker
                    id="arrow-green"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
                  </marker>
                </defs>

                {/* 1 -> 2: Query into Wasm Agent */}
                <path
                  id="path-1-2"
                  d="M 130 130 L 177 130"
                  stroke="#d97706"
                  strokeWidth="2"
                  className="flowing-wire opacity-60"
                  markerEnd="url(#arrow-amber)"
                />

                {/* 2 -> 3: Branch up to LanceDB Vectors */}
                <path
                  id="path-2-3"
                  d="M 292 130 C 330 130, 330 65, 362 65"
                  stroke="#d97706"
                  strokeWidth="2"
                  className="flowing-wire opacity-60"
                  markerEnd="url(#arrow-amber)"
                />

                {/* 2 -> 4: Branch down to Tree-sitter AST */}
                <path
                  id="path-2-4"
                  d="M 292 130 C 330 130, 330 195, 362 195"
                  stroke="#d97706"
                  strokeWidth="2"
                  className="flowing-wire opacity-60"
                  markerEnd="url(#arrow-amber)"
                />

                {/* 3 <-> 4: Synchronization bridge between vectors & AST grammar */}
                <path
                  id="path-3-4"
                  d="M 425 99 L 425 161"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="flowing-wire opacity-50"
                />

                {/* 3 -> 5: Converge from LanceDB into Symbol Graph */}
                <path
                  id="path-3-5"
                  d="M 487 65 C 520 65, 520 130, 552 130"
                  stroke="#d97706"
                  strokeWidth="2"
                  className="flowing-wire opacity-60"
                  markerEnd="url(#arrow-amber)"
                />

                {/* 4 -> 5: Converge from Tree-sitter into Symbol Graph */}
                <path
                  id="path-4-5"
                  d="M 487 195 C 520 195, 520 130, 552 130"
                  stroke="#d97706"
                  strokeWidth="2"
                  className="flowing-wire opacity-60"
                  markerEnd="url(#arrow-amber)"
                />

                {/* 5 -> 6: Symbol Graph to WebGPU AI */}
                <path
                  id="path-5-6"
                  d="M 677 130 L 742 130"
                  stroke="#d97706"
                  strokeWidth="2"
                  className="flowing-wire opacity-60"
                  markerEnd="url(#arrow-amber)"
                />

                {/* 6 -> 7: WebGPU AI into Split-Pane Workspace */}
                <path
                  id="path-6-7"
                  d="M 857 130 L 912 130"
                  stroke="#10b981"
                  strokeWidth="2"
                  className="flowing-wire opacity-80"
                  markerEnd="url(#arrow-green)"
                />

                {/* Moving Glowing Data Packets along Every Pathway */}
                {isPlaying && (
                  <>
                    <circle r="4" fill="#fef08a" filter="url(#packet-glow)">
                      <animateMotion path="M 130 130 L 177 130" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#fef08a" filter="url(#packet-glow)">
                      <animateMotion path="M 292 130 C 330 130, 330 65, 362 65" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#fef08a" filter="url(#packet-glow)">
                      <animateMotion path="M 292 130 C 330 130, 330 195, 362 195" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="3" fill="#34d399" filter="url(#packet-glow)">
                      <animateMotion path="M 425 99 L 425 161" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#fef08a" filter="url(#packet-glow)">
                      <animateMotion path="M 487 65 C 520 65, 520 130, 552 130" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#fef08a" filter="url(#packet-glow)">
                      <animateMotion path="M 487 195 C 520 195, 520 130, 552 130" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#fef08a" filter="url(#packet-glow)">
                      <animateMotion path="M 677 130 L 742 130" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="4" fill="#6ee7b7" filter="url(#packet-glow)">
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
                    className={`absolute w-[110px] p-2.5 rounded-xl text-center transition-all duration-300 border ${
                      isActive
                        ? 'bg-[#092b1c] border-amber-400 ring-2 ring-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-105 z-20'
                        : isPast
                        ? 'bg-[#051a11] border-emerald-700/60 text-[#d1dfd6] z-10'
                        : 'bg-[#04140d] border-amber-900/30 text-[#9cb3a8]/70 hover:border-amber-700/60 z-10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-mono font-bold ${isActive ? 'text-amber-300' : 'text-amber-400/60'}`}>
                        {node.stepNum}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isActive
                            ? 'bg-amber-400 animate-pulse'
                            : isPast
                            ? 'bg-emerald-400'
                            : 'bg-zinc-700'
                        }`}
                      />
                    </div>
                    <div className="text-xs font-bold text-[#f4f7f4] truncate">
                      {node.name}
                    </div>
                    <div className="text-[10px] font-mono text-amber-300/80 truncate mt-0.5">
                      {node.role}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Responsive Stepper (Zero Horizontal Scroll Trapping) */}
          <div className="block md:hidden space-y-2">
            <div className="text-xs font-mono text-amber-400/80 pb-2 border-b border-amber-900/20">
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
                    className={`p-2.5 rounded-lg text-left transition-all border ${
                      isActive
                        ? 'bg-[#092b1c] border-amber-400 shadow-md ring-1 ring-amber-400/30'
                        : 'bg-[#04140d] border-amber-900/30 text-[#9cb3a8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        {node.stepNum}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-400' : 'bg-zinc-700'}`} />
                    </div>
                    <div className="text-xs font-bold text-[#f4f7f4] truncate">
                      {node.name}
                    </div>
                    <div className="text-[10px] font-mono text-[#9cb3a8] truncate">
                      {node.role}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Packet Telemetry & Inspection Card */}
        <div className="rounded-xl brass-border p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-amber-900/20">
            <div>
              <div className="text-xs font-mono text-amber-400 mb-1">
                Node {activeNode.stepNum} — {activeNode.role}
              </div>
              <h3 className="text-xl font-bold text-[#f4f7f4]">
                {activeNode.name}
              </h3>
            </div>

            <div className="px-3 py-1 rounded-md bg-[#03130b] border border-amber-600/30 font-mono text-xs text-amber-200">
              <span className="text-amber-400/60 mr-1.5 select-none">PACKET DATA:</span>
              <span>{activeNode.liveData}</span>
            </div>
          </div>

          <p className="text-sm text-[#9cb3a8] leading-relaxed mb-4">
            {activeNode.summary}
          </p>

          <div className="flex items-center space-x-2 text-xs font-mono pt-2 border-t border-amber-900/15">
            <button
              onClick={() => {
                setActiveNodeIndex((prev) => (prev > 0 ? prev - 1 : nodes.length - 1));
                setIsPlaying(false);
              }}
              className="px-3 py-1.5 rounded bg-[#03130b] text-[#9cb3a8] hover:text-[#f4f7f4] border border-amber-900/30 transition-colors"
            >
              ← Previous Node
            </button>
            <button
              onClick={() => {
                setActiveNodeIndex((prev) => (prev < nodes.length - 1 ? prev + 1 : 0));
                setIsPlaying(false);
              }}
              className="px-3 py-1.5 rounded bg-amber-400 text-[#04140d] font-bold hover:bg-amber-300 transition-colors"
            >
              Next Node →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
