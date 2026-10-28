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
    <section id="quickstart" className="py-24 md:py-32 border-b border-amber-900/20">
      <div className="max-w-4xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest mb-2">
            Installation
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f7f4] tracking-tight mb-3">
            Ready to Run on Your Machine
          </h2>
          <p className="text-base text-[#9cb3a8] leading-relaxed">
            Download the open-source repository and run the private code search engine locally in four simple terminal commands.
          </p>
        </div>

        {/* Terminal Card */}
        <div className="rounded-xl brass-border overflow-hidden">
          {/* Header Bar */}
          <div className="px-5 py-3 bg-[#03110a] border-b border-amber-900/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 text-xs font-mono">
              <button
                onClick={() => setActiveTab('frontend')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'frontend'
                    ? 'bg-amber-400 text-[#04140d] font-bold'
                    : 'text-[#9cb3a8] hover:text-[#f4f7f4]'
                }`}
              >
                1. Web Interface
              </button>
              <button
                onClick={() => setActiveTab('backend')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'backend'
                    ? 'bg-amber-400 text-[#04140d] font-bold'
                    : 'text-[#9cb3a8] hover:text-[#f4f7f4]'
                }`}
              >
                2. Code Indexing
              </button>
              <button
                onClick={() => setActiveTab('benchmark')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'benchmark'
                    ? 'bg-amber-400 text-[#04140d] font-bold'
                    : 'text-[#9cb3a8] hover:text-[#f4f7f4]'
                }`}
              >
                3. Accuracy Tests
              </button>
            </div>

            <button
              onClick={() => handleCopy(activeTab)}
              data-testid="copy-terminal-btn"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#082a1b] hover:bg-[#0c3824] border border-amber-600/30 text-amber-200 text-xs font-mono transition-colors"
            >
              {copiedKey === activeTab ? (
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

          {/* Terminal Code Body */}
          <div className="p-5 bg-[#03110a] font-mono text-xs sm:text-sm text-emerald-200/90 overflow-x-auto leading-relaxed">
            <pre>
              <code>{snippets[activeTab]}</code>
            </pre>
          </div>

          {/* Footer Bar */}
          <div className="px-5 py-3.5 bg-[#04160e] border-t border-amber-900/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <span className="text-[#9cb3a8] text-xs">
              Runs in Chrome or Edge (WebGPU enabled) • No cloud subscription required
            </span>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-amber-300 hover:text-amber-200 font-medium transition-colors"
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
