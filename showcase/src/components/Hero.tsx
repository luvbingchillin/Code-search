import React, { useState } from 'react';
import { Copy, Check, ArrowRight } from 'lucide-react';
import { GITHUB_REPO_URL } from './Navbar';
import { GithubIcon } from './GithubIcon';

export const Hero: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const cloneCmd = 'git clone https://github.com/luvbingchillin/Code-search.git';

  const handleCopy = () => {
    navigator.clipboard.writeText(cloneCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative pt-20 pb-24 md:pt-32 md:pb-36 border-b border-[#0a1f10]/10">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center">
        {/* Simple Plain-English Badge (Ticket Stamp Style) */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-[#0a1f10] text-[#f4f3eb] border border-[#dad0a7]/30 text-xs font-mono font-bold shadow-md mb-8">
          <span className="w-2 h-2 rounded-full bg-[#68f12b] animate-pulse" />
          <span>100% PRIVATE RETRIEVAL & EXPLANATION</span>
          <span className="text-[#dad0a7]/40">•</span>
          <span className="text-[#68f12b]">WEBGPU + NEMOIR</span>
        </div>

        {/* High-Impact Headline in Phudu */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#0a1f10] font-display uppercase leading-[1.08] mb-6">
          Stop Gambling on <br className="hidden sm:inline" />
          <span className="highlight-sweep is-visible">Fragmented Codebases</span>
        </h1>

        {/* Clear Plain-English Subhead */}
        <p className="text-lg sm:text-xl text-[#243d2c] max-w-2xl mx-auto leading-relaxed mb-10">
          Most AI tools slice code arbitrarily—feeding cut-off fragments to the cloud and producing hallucinated explanations. <strong className="text-[#0a1f10] font-semibold">Code-Search</strong> extracts complete syntax trees so an on-device AI can explain your architecture with compiler accuracy, running 100% locally on your laptop.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="github-hero-cta"
            className="w-full sm:w-auto acid-btn px-7 py-3.5 rounded-xl font-bold text-sm inline-flex items-center justify-center space-x-2.5 shadow-md"
          >
            <GithubIcon className="w-4 h-4" />
            <span>Explore on GitHub</span>
            <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
          </a>

          <a
            href="#comparison"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[#ffffff] hover:bg-[#edece4] border border-[#0a1f10]/20 text-[#0a1f10] font-bold text-sm transition-colors shadow-sm"
          >
            See What Normal AI Breaks
          </a>
        </div>

        {/* Terminal Clone Snippet (Hardware Specimen Style) */}
        <div className="max-w-lg mx-auto">
          <div className="rounded-2xl bg-[#0a1f10] border border-[#dad0a7]/30 p-3 sm:p-4 flex items-center justify-between font-mono text-xs sm:text-sm text-[#f4f3eb] shadow-xl">
            <div className="flex items-center space-x-3 truncate mr-4 text-left">
              <span className="text-[#68f12b] select-none font-bold">$</span>
              <span className="text-[#dad0a7] truncate">{cloneCmd}</span>
            </div>
            <button
              onClick={handleCopy}
              data-testid="copy-clone-btn"
              className="flex-shrink-0 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#143520] hover:bg-[#1f4a2f] border border-[#68f12b]/40 text-[#f4f3eb] text-xs transition-colors"
              title="Copy clone command"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#68f12b]" />
                  <span className="text-[#68f12b] font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 opacity-70" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real Product Preview: Split-Pane Developer Workspace */}
        <div className="mt-14 text-left max-w-4xl mx-auto rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 overflow-hidden shadow-2xl chande-card-hover">
          {/* Chrome / Window Titlebar */}
          <div className="bg-[#06150b] px-4 py-3 border-b border-[#dad0a7]/20 flex items-center justify-between font-mono text-xs text-[#f4f3eb]">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#68f12b] inline-block" />
              <span className="ml-2 text-[#dad0a7] text-[11px] hidden sm:inline">Edge Developer Workspace — localhost:5173</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#68f12b] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#68f12b] animate-pulse" />
              <span>Qwen2.5-Coder • WebGPU Active</span>
            </div>
          </div>

          {/* Split Pane Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#081c0e] divide-y lg:divide-y-0 lg:divide-x divide-[#dad0a7]/15 text-xs font-mono">
            {/* Left: Real-Time ReAct Agent Loop */}
            <div className="lg:col-span-5 p-5 bg-[#06150b]/80 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#dad0a7]/20">
                <span className="text-[11px] font-bold text-[#68f12b] uppercase tracking-wider">
                  ReAct Agent State Loop
                </span>
                <span className="px-2 py-0.5 rounded bg-[#143520] text-[#68f12b] text-[11px] font-bold border border-[#68f12b]/30">
                  NemoIR Wasm
                </span>
              </div>

              {/* Loop States */}
              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-[#0d2614] border border-[#dad0a7]/20">
                  <div className="flex items-center space-x-2 text-[#68f12b] font-bold mb-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#68f12b]" />
                    <span>01. Thinking (Query Decomposition)</span>
                  </div>
                  <p className="text-[11px] text-[#dad0a7] font-sans">
                    Extracted intent: Locate routing initialization logic and path parameter parsing.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0d2614] border border-[#dad0a7]/20">
                  <div className="flex items-center space-x-2 text-[#68f12b] font-bold mb-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#68f12b]" />
                    <span>02. Searching AST (Vector & Grammar)</span>
                  </div>
                  <p className="text-[11px] text-[#dad0a7] font-sans">
                    LanceDB 0.84 cosine match + Tree-sitter node extraction: <code className="text-[#68f12b]">APIRoute.__init__</code> (Lines 52–98, 24ms).
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0d2614] border border-[#68f12b]/40 shadow-inner">
                  <div className="flex items-center space-x-2 text-[#68f12b] font-bold mb-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#68f12b] animate-pulse" />
                    <span>03. Explaining (NemoIR Wasm Harness)</span>
                  </div>
                  <p className="text-[11px] text-[#dad0a7] font-sans">
                    NemoIR enforces a safe 4,096 token cap while WebGPU generates a compiler-accurate explanation with zero cloud calls.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Syntax-Highlighted AST Viewer */}
            <div className="lg:col-span-7 p-5 bg-[#030d06] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#dad0a7]/20 text-[11px]">
                  <span className="text-[#dad0a7]">
                    fastapi/routing.py &gt; Class: <strong className="text-[#68f12b]">APIRoute</strong> &gt; Function: <strong className="text-[#68f12b]">__init__</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#143520] text-[#68f12b] border border-[#68f12b]/40 font-bold">
                    AST: FunctionDef (Intact)
                  </span>
                </div>

                <div className="text-xs text-[#f4f3eb] leading-relaxed overflow-x-auto py-1">
                  <pre className="font-mono">
                    <span className="text-[#718096]"># Tree-sitter preserved complete class method definition</span>{'\n'}
                    <span className="text-[#68f12b] font-bold">def</span> <span className="text-[#6ee7b7]">__init__</span>(<span className="text-[#cbd5e1]">self, path: </span><span className="text-[#67e8f9]">str</span><span className="text-[#cbd5e1]">, endpoint: </span><span className="text-[#67e8f9]">Callable</span><span className="text-[#cbd5e1]">, *, response_model: </span><span className="text-[#67e8f9]">Any</span><span className="text-[#cbd5e1]"> = </span><span className="text-[#fb923c]">None</span>):{'\n'}
                    <span className="text-[#fef08a] font-medium">    """Initialize route with compile-time path verification."""</span>{'\n'}
                    <span className="text-[#cbd5e1]">    self.path = path</span>{'\n'}
                    <span className="text-[#cbd5e1]">    self.endpoint = endpoint</span>{'\n'}
                    <span className="text-[#68f12b] font-bold">    return</span> <span className="text-[#67e8f9]">super</span>().<span className="text-[#6ee7b7]">__init__</span>(path, endpoint)
                  </pre>
                </div>

                {/* AI Architectural Explanation Box */}
                <div className="mt-3 p-3 rounded-xl bg-[#092211] border border-[#68f12b]/40 text-[11px] font-sans text-[#f4f3eb] shadow-inner">
                  <span className="font-bold text-[#68f12b] font-mono">AI Explanation: </span>
                  &quot;APIRoute initializes the route handler, binding the endpoint callable and validating parameter types before registering with the application router.&quot;
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#dad0a7]/20 flex items-center justify-between text-[11px] text-[#dad0a7]">
                <span>Node Tokens: <strong className="text-[#68f12b] font-mono">412 tokens</strong></span>
                <span className="text-[#68f12b] font-mono font-bold">Privacy: 0 bytes sent to cloud</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
