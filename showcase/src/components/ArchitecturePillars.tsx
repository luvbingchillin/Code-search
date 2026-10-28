import React from 'react';

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
        'Your code never leaves your computer. No cloud servers, no third-party data tracking, and zero risk of your intellectual property leaking.',
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
    <section id="architecture" className="py-24 md:py-32 border-b border-amber-900/20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest mb-2">
            Why It Works Better
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f7f4] tracking-tight mb-4">
            Four Core Advantages
          </h2>
          <p className="text-base text-[#9cb3a8] leading-relaxed">
            Engineered from the ground up to eliminate privacy leaks, broken snippets, and browser freezes.
          </p>
        </div>

        {/* Clean, Uniform Cards (No expanding, no jank, perfectly balanced) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {pillars.map((pillar) => (
            <div
              key={pillar.number}
              data-testid={`pillar-card-${pillar.number}`}
              className="rounded-xl brass-border p-7 sm:p-8 flex flex-col justify-between"
            >
              <div>
                {/* Header row: Index & Category Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {pillar.number}
                  </span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#03130b] text-[#9cb3a8] border border-amber-900/30">
                    {pillar.techTitle}
                  </span>
                </div>

                {/* Bold, Impactful Title */}
                <h3 className="text-xl sm:text-2xl font-bold text-[#f4f7f4] mb-3">
                  {pillar.simpleTitle}
                </h3>

                {/* Plain-English Explanation */}
                <p className="text-sm text-[#9cb3a8] leading-relaxed mb-6">
                  {pillar.simpleDescription}
                </p>
              </div>

              {/* Bottom Impact Highlight */}
              <div className="pt-4 border-t border-amber-900/15 flex items-center space-x-2 text-xs font-medium text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{pillar.impactHighlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
