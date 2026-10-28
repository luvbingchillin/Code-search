import React from 'react';
import { ExternalLink } from 'lucide-react';
import { GITHUB_REPO_URL } from './Navbar';
import { GithubIcon } from './GithubIcon';

export const Footer: React.FC = () => {
  return (
    <footer className="py-16 md:py-24 bg-[#0a1f10] border-t border-[#dad0a7]/30 text-[#dad0a7] text-xs">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#68f12b] flex items-center justify-center text-[#0a1f10] font-black font-display text-base shadow-[0_0_12px_rgba(104,241,43,0.3)]">
                &gt;_
              </div>
              <span className="font-display font-black text-lg tracking-wider text-[#f4f3eb] uppercase">
                CODE-SEARCH
              </span>
            </div>
            <p className="text-sm text-[#dad0a7] leading-relaxed max-w-sm mb-6 font-sans">
              A private, on-device search and architectural explanation engine for understanding software codebases without leaking your code to cloud servers.
            </p>
            <div>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="github-footer-link"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#143520] hover:bg-[#1e4a2d] border border-[#68f12b]/40 text-[#68f12b] text-xs font-mono font-bold transition-all shadow-sm"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>luvbingchillin/Code-search</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <div className="text-xs font-mono font-bold text-[#68f12b] uppercase tracking-wider mb-4">
              Navigation
            </div>
            <ul className="space-y-2.5 text-[#dad0a7] font-sans text-sm">
              <li>
                <a href="#architecture" className="hover:text-[#68f12b] transition-colors">
                  Key Advantages
                </a>
              </li>
              <li>
                <a href="#comparison" className="hover:text-[#68f12b] transition-colors">
                  Code Comparison
                </a>
              </li>
              <li>
                <a href="#pipeline" className="hover:text-[#68f12b] transition-colors">
                  Execution Flow
                </a>
              </li>
              <li>
                <a href="#quickstart" className="hover:text-[#68f12b] transition-colors">
                  Terminal Quick Start
                </a>
              </li>
            </ul>
          </div>

          {/* Project Details */}
          <div>
            <div className="text-xs font-mono font-bold text-[#68f12b] uppercase tracking-wider mb-4">
              Architecture Spec
            </div>
            <ul className="space-y-2.5 text-[#dad0a7] font-mono text-xs">
              <li>Final Year Project (FYP)</li>
              <li>Pure Browser (React 19 / Vite 6)</li>
              <li>WebGPU SLM (Qwen2.5-Coder)</li>
              <li>NemoIR Wasm Loop Governor</li>
              <li>Zero External Cloud Transmission</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-dashed border-[#dad0a7]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] font-mono text-[#dad0a7]/60">
          <div>
            © 2026 CODE-SEARCH. OPEN SOURCE UNDER MIT LICENSE.
          </div>
          <div className="text-[#68f12b] font-bold">
            100% PRIVATE EDGE-COMPUTED PRIVACY
          </div>
        </div>
      </div>
    </footer>
  );
};
