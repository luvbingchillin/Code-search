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
    <section className="relative pt-20 pb-24 md:pt-32 md:pb-36 border-b border-amber-900/20">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center">
        {/* Simple Plain-English Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#08281b] border border-amber-600/30 text-xs text-amber-200 font-medium mb-8">
          <span>100% Private Code Retrieval & Explanation</span>
          <span className="text-amber-500/40">•</span>
          <span>WebGPU + NemoIR Wasm</span>
        </div>

        {/* High-Impact Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#f4f7f4] leading-[1.1] mb-6">
          Stop Gambling on <br className="hidden sm:inline" />
          <span className="text-amber-200">Fragmented Codebases</span>
        </h1>

        {/* Clear Plain-English Subhead */}
        <p className="text-lg sm:text-xl text-[#9cb3a8] max-w-2xl mx-auto leading-relaxed mb-10">
          Most AI tools slice code arbitrarily—feeding cut-off fragments to the cloud and producing hallucinated explanations. <strong className="text-[#f4f7f4] font-semibold">Code-Search</strong> extracts complete syntax trees so an on-device AI can explain your architecture with compiler accuracy, running 100% locally on your laptop.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="github-hero-cta"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-7 py-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#04140d] font-semibold text-sm transition-colors"
          >
            <GithubIcon className="w-4 h-4" />
            <span>Explore on GitHub</span>
            <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
          </a>

          <a
            href="#comparison"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-[#072418] hover:bg-[#0b3323] border border-amber-600/25 text-[#f4f7f4] font-medium text-sm transition-colors"
          >
            See What Normal AI Breaks
          </a>
        </div>

        {/* Terminal Clone Snippet */}
        <div className="max-w-lg mx-auto">
          <div className="rounded-xl bg-[#03110b] border border-amber-900/30 p-3 sm:p-3.5 flex items-center justify-between font-mono text-xs sm:text-sm">
            <div className="flex items-center space-x-3 truncate mr-4 text-left">
              <span className="text-amber-500/80 select-none">$</span>
              <span className="text-[#9cb3a8] truncate">{cloneCmd}</span>
            </div>
            <button
              onClick={handleCopy}
              data-testid="copy-clone-btn"
              className="flex-shrink-0 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#072519] hover:bg-[#0c3926] border border-amber-600/30 text-amber-200 text-xs transition-colors"
              title="Copy clone command"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied</span>
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
        <div className="mt-14 text-left max-w-4xl mx-auto rounded-2xl brass-border overflow-hidden shadow-2xl border border-amber-600/30">
          {/* Chrome / Window Titlebar */}
          <div className="bg-[#03110a] px-4 py-3 border-b border-amber-900/30 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-[#9cb3a8] text-[11px] hidden sm:inline">Edge Developer Workspace — localhost:5173</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-amber-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Qwen2.5-Coder • WebGPU Shader Active</span>
            </div>
          </div>

          {/* Split Pane Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#051c12] divide-y lg:divide-y-0 lg:divide-x divide-amber-900/20 text-xs font-mono">
            {/* Left: Real-Time ReAct Agent Loop */}
            <div className="lg:col-span-5 p-5 bg-[#03110a]/60 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-amber-900/20">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  ReAct Agent State Loop
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[11px] border border-amber-800/40">
                  NemoIR Wasm
                </span>
              </div>

              {/* Loop States */}
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-[#072518] border border-amber-600/30">
                  <div className="flex items-center space-x-2 text-amber-300 font-semibold mb-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>01. Thinking (Query Decomposition)</span>
                  </div>
                  <p className="text-[11px] text-[#9cb3a8] font-sans">
                    Extracted intent: Locate routing initialization logic and path parameter parsing.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[#072518] border border-amber-600/30">
                  <div className="flex items-center space-x-2 text-emerald-300 font-semibold mb-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>02. Searching AST (Vector & Grammar)</span>
                  </div>
                  <p className="text-[11px] text-[#9cb3a8] font-sans">
                    LanceDB 0.84 cosine match + Tree-sitter node extraction: <code className="text-emerald-300">APIRoute.__init__</code> (Lines 52–98, 24ms).
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[#072518] border border-amber-600/30">
                  <div className="flex items-center space-x-2 text-cyan-300 font-semibold mb-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>03. Explaining (NemoIR Wasm Harness)</span>
                  </div>
                  <p className="text-[11px] text-[#9cb3a8] font-sans">
                    NemoIR enforces a safe 4,096 token cap while WebGPU generates a compiler-accurate explanation with zero cloud calls.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Syntax-Highlighted AST Viewer */}
            <div className="lg:col-span-7 p-5 bg-[#020c07] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-900/20 text-[11px]">
                  <span className="text-amber-200">
                    fastapi/routing.py &gt; Class: <strong className="text-emerald-300">APIRoute</strong> &gt; Function: <strong className="text-emerald-300">__init__</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                    AST: FunctionDef (Intact)
                  </span>
                </div>

                <div className="text-xs text-[#d1dfd6] leading-relaxed overflow-x-auto py-1">
                  <pre className="font-mono">
                    <span className="text-[#64748b]"># Tree-sitter preserved complete class method definition</span>{'\n'}
                    <span className="text-[#fbbf24] font-semibold">def</span> <span className="text-[#60a5fa]">__init__</span>(<span className="text-[#cbd5e1]">self, path: </span><span className="text-[#38bdf8]">str</span><span className="text-[#cbd5e1]">, endpoint: </span><span className="text-[#38bdf8]">Callable</span><span className="text-[#cbd5e1]">, *, response_model: </span><span className="text-[#38bdf8]">Any</span><span className="text-[#cbd5e1]"> = </span><span className="text-[#fb923c]">None</span>):{'\n'}
                    <span className="text-[#34d399] font-medium">    """Initialize route with compile-time path verification."""</span>{'\n'}
                    <span className="text-[#cbd5e1]">    self.path = path</span>{'\n'}
                    <span className="text-[#cbd5e1]">    self.endpoint = endpoint</span>{'\n'}
                    <span className="text-[#fbbf24] font-semibold">    return</span> <span className="text-[#38bdf8]">super</span>().<span className="text-[#60a5fa]">__init__</span>(path, endpoint)
                  </pre>
                </div>

                {/* AI Architectural Explanation Box */}
                <div className="mt-3 p-2.5 rounded-lg bg-[#041a10] border border-emerald-800/40 text-[11px] font-sans text-emerald-200">
                  <span className="font-bold text-amber-300 font-mono">AI Explanation: </span>
                  &quot;APIRoute initializes the route handler, binding the endpoint callable and validating parameter types before registering with the application router.&quot;
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-amber-900/20 flex items-center justify-between text-[11px] text-[#9cb3a8]">
                <span>Node Tokens: <strong className="text-amber-300 font-mono">412 tokens</strong></span>
                <span className="text-emerald-400 font-mono">Privacy: 0 bytes sent to cloud</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
