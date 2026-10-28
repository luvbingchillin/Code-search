import React from 'react';
import { ExternalLink } from 'lucide-react';
import { GITHUB_REPO_URL } from './Navbar';
import { GithubIcon } from './GithubIcon';

export const Footer: React.FC = () => {
  return (
    <footer className="py-16 md:py-20 bg-[#03110a] border-t border-amber-900/20 text-[#9cb3a8] text-xs">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#072418] border border-amber-600/40">
                <span className="text-[10px] font-bold text-amber-300">0</span>
              </div>
              <span className="text-sm font-bold tracking-tight text-[#f4f7f4]">
                CODE-SEARCH
              </span>
            </div>
            <p className="text-xs text-[#9cb3a8] leading-relaxed max-w-sm mb-4">
              A private, on-device search engine for understanding software codebases without leaking code to the cloud.
            </p>
            <div>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="github-footer-link"
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#062015] hover:bg-[#0a2e1f] border border-amber-600/30 text-amber-200 text-xs font-mono transition-colors"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>luvbingchillin/Code-search</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <div className="text-xs font-mono font-semibold text-amber-300/90 uppercase tracking-wider mb-3">
              Navigation
            </div>
            <ul className="space-y-2 text-[#9cb3a8]">
              <li>
                <a href="#architecture" className="hover:text-[#f4f7f4] transition-colors">
                  Key Advantages
                </a>
              </li>
              <li>
                <a href="#comparison" className="hover:text-[#f4f7f4] transition-colors">
                  Code Comparison
                </a>
              </li>
              <li>
                <a href="#benchmarks" className="hover:text-[#f4f7f4] transition-colors">
                  Accuracy Benchmark
                </a>
              </li>
              <li>
                <a href="#pipeline" className="hover:text-[#f4f7f4] transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#quickstart" className="hover:text-[#f4f7f4] transition-colors">
                  Get Started
                </a>
              </li>
            </ul>
          </div>

          {/* Project Details */}
          <div>
            <div className="text-xs font-mono font-semibold text-amber-300/90 uppercase tracking-wider mb-3">
              Project Info
            </div>
            <ul className="space-y-2 text-[#9cb3a8]">
              <li>Final Year Project (FYP)</li>
              <li>Runs 100% in Web Browser</li>
              <li>Open Source MIT License</li>
              <li>Zero External Cloud Transmission</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-amber-900/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-[#9cb3a8]/60">
          <div>
            © 2026 Code-Search. Free and open source under MIT License.
          </div>
          <div>
            100% Private On-Device Search
          </div>
        </div>
      </div>
    </footer>
  );
};
