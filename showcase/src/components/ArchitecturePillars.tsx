import React from 'react';
import { TrackingEye } from './TrackingEye';

interface PillarData {
  number: string;
  simpleTitle: string;
  techTitle: string;
  simpleDescription: string;
  impactHighlight: string;
}

export const ArchitecturePillars: React.FC = () => {
  const pillars: PillarData[] = [
    {
      number: '01',
      simpleTitle: '100% Private to You',
      techTitle: '100% Edge-Computed Privacy',
      simpleDescription:
        'Your code never leaves your computer. No cloud servers, no third-party data tracking, and zero risk of your intellectual property leaking to outside models.',
      impactHighlight: 'Zero external cloud transmission'
    },
    {
      number: '02',
      simpleTitle: 'Hallucination-Free Explanations',
      techTitle: 'Structural AST Ingestion Engine',
      simpleDescription:
        'Normal AI guesses and hallucinates because it tries to explain cut-off fragments. Tree-sitter feeds complete code structures to the AI so its architectural breakdowns are compiler-accurate.',
      impactHighlight: '100% complete functions feed clean context to the AI'
    },
    {
      number: '03',
      simpleTitle: 'Sees the Full Picture',
      techTitle: 'Autonomous Multi-Hop Graph Traversal',
      simpleDescription:
        'Code lives in interconnected webs, not isolated files. The assistant automatically traces connected helpers and parent classes across folders.',
      impactHighlight: 'Follows real code dependencies across files'
    },
    {
      number: '04',
      simpleTitle: 'Fast & Crash-Proof in Your Browser',
      techTitle: 'Deterministic Wasm Agentic Loop',
      simpleDescription:
        'Prevents the AI from getting stuck in endless thinking loops or freezing your web browser, using a fast NemoIR WebAssembly harness with a strict 4,096 token safety cap.',
      impactHighlight: 'NemoIR Wasm protects browser memory with strict token caps'
    }
  ];

  return (
    <section id="architecture" className="py-24 md:py-32 border-b border-[#dad0a7]/30">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0a1f10]/5 border border-[#0a1f10]/15 text-xs font-mono font-bold text-[#0a1f10] uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
            <span>[ SPECIMEN ANALYSIS // CORE PILLARS ]</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black font-display text-[#0a1f10] uppercase tracking-tight mb-4 chande-tilt">
            Four Core Advantages
          </h2>
          <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
            Engineered from the ground up to eliminate cloud privacy leaks, broken code fragments, and browser memory crashes.
          </p>
        </div>

        {/* Tactile Chande-Style Specimen Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {pillars.map((pillar) => (
            <div
              key={pillar.number}
              data-testid={`pillar-card-${pillar.number}`}
              className="rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 p-8 sm:p-9 flex flex-col justify-between text-[#f4f3eb] shadow-xl chande-card-hover relative group overflow-hidden"
            >
              {/* Subtle radial dot texture overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(rgba(244, 243, 235, 0.15) 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              />

              <div className="relative z-10">
                {/* Header row: Index & Category Badge */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-dashed border-[#dad0a7]/20">
                  <div className="flex items-center space-x-2 font-mono text-xs font-bold text-[#68f12b]">
                    <span>№</span>
                    <span className="text-base tracking-wider">{pillar.number}</span>
                    <span className="text-[#dad0a7]/40">//</span>
                    <span className="text-[11px] text-[#dad0a7] uppercase tracking-wider">SPECIMEN</span>
                  </div>
                  <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#143520] text-[#68f12b] border border-[#68f12b]/40 font-semibold tracking-wide">
                    {pillar.techTitle}
                  </span>
                </div>

                {/* Bold Headline in Phudu Display */}
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-tight text-[#f4f3eb] mb-3 group-hover:text-[#68f12b] transition-colors">
                  {pillar.simpleTitle}
                </h3>

                {/* Plain-English Explanation */}
                <p className="text-sm sm:text-base text-[#dad0a7] font-sans leading-relaxed mb-6">
                  {pillar.simpleDescription}
                </p>

                {/* Interactive Tracking Eye inside Pillar 01 */}
                {pillar.number === '01' && (
                  <div className="mb-6 pt-1">
                    <TrackingEye
                      label="CLOUD AI EYE IS WATCHING"
                      sublabel="Notice how external AI tracks you • Local SLM keeps code 100% blind to cloud"
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* Bottom Impact Highlight with Electric Lime Dot */}
              <div className="relative z-10 pt-4 border-t border-[#dad0a7]/15 flex items-center space-x-2.5 text-xs font-mono font-medium text-[#68f12b]">
                <span className="w-2 h-2 rounded-full bg-[#68f12b] shadow-[0_0_8px_#68f12b]" />
                <span>{pillar.impactHighlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
