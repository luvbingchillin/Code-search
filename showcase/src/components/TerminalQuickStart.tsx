import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { GITHUB_REPO_URL } from './Navbar';
import { GithubIcon } from './GithubIcon';

export const TerminalQuickStart: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'frontend' | 'backend' | 'benchmark'>('frontend');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const snippets = {
    frontend: `# 1. Clone the project repository
git clone https://github.com/luvbingchillin/Code-search.git
cd Code-search/frontend

# 2. Install dependencies
npm install

# 3. Start the application
npm run dev

# 4. Open http://localhost:5173 in Chrome or Edge`,
    backend: `# 1. Navigate to the Python indexing backend
cd Code-search/backend

# 2. Set up a Python environment
python -m venv venv
source venv/bin/activate  # On Windows: .\\venv\\Scripts\\activate

# 3. Install requirements & index a codebase
pip install -e .
python scripts/ingest_repo.py --target sample_codebase/`,
    benchmark: `# 1. Navigate to the evaluation folder
cd Code-search/benchmark

# 2. Run the accuracy benchmark
python run_retrieval_benchmark.py`
  };

  const handleCopy = (tab: 'frontend' | 'backend' | 'benchmark') => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopiedKey(tab);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section id="quickstart" className="py-24 md:py-32 border-b border-[#dad0a7]/30">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0a1f10]/5 border border-[#0a1f10]/15 text-xs font-mono font-bold text-[#0a1f10] uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-[#68f12b]" />
            <span>[ LOCAL RUNTIME // TERMINAL INSTRUCTIONS ]</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black font-display text-[#0a1f10] uppercase tracking-tight mb-3">
            Ready to Run on Your Machine
          </h2>
          <p className="text-base sm:text-lg text-[#0a1f10]/75 leading-relaxed font-sans">
            Download the open-source repository and run the private code search engine locally in four simple terminal commands.
          </p>
        </div>

        {/* Industrial Hardware Terminal Casing */}
        <div className="rounded-3xl bg-[#0a1f10] border border-[#dad0a7]/30 overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="px-6 py-4 bg-[#06150b] border-b border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs font-mono">
              <button
                onClick={() => setActiveTab('frontend')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === 'frontend'
                    ? 'bg-[#68f12b] text-[#0a1f10] shadow-[0_0_12px_rgba(104,241,43,0.3)]'
                    : 'text-[#dad0a7] hover:text-[#f4f3eb]'
                }`}
              >
                1. Web Interface
              </button>
              <button
                onClick={() => setActiveTab('backend')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === 'backend'
                    ? 'bg-[#68f12b] text-[#0a1f10] shadow-[0_0_12px_rgba(104,241,43,0.3)]'
                    : 'text-[#dad0a7] hover:text-[#f4f3eb]'
                }`}
              >
                2. Code Indexing
              </button>
              <button
                onClick={() => setActiveTab('benchmark')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === 'benchmark'
                    ? 'bg-[#68f12b] text-[#0a1f10] shadow-[0_0_12px_rgba(104,241,43,0.3)]'
                    : 'text-[#dad0a7] hover:text-[#f4f3eb]'
                }`}
              >
                3. Accuracy Tests
              </button>
            </div>

            <button
              onClick={() => handleCopy(activeTab)}
              data-testid="copy-terminal-btn"
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-[#143520] hover:bg-[#1e4a2d] border border-[#68f12b]/40 text-[#68f12b] text-xs font-mono font-bold transition-all shadow-sm"
            >
              {copiedKey === activeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#68f12b]" />
                  <span className="text-[#68f12b] font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 opacity-70" />
                  <span>Copy Commands</span>
                </>
              )}
            </button>
          </div>

          {/* Terminal Code Body */}
          <div className="p-6 bg-[#040e07] font-mono text-xs sm:text-sm text-[#68f12b] overflow-x-auto leading-relaxed">
            <pre>
              <code>{snippets[activeTab]}</code>
            </pre>
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-4 bg-[#06150b] border-t border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <span className="text-[#dad0a7] text-xs font-mono">
              Runs in Chrome or Edge (WebGPU enabled) • No cloud subscription required
            </span>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-[#68f12b] hover:underline font-mono font-bold transition-colors"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub Repository</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
