import React, { useState, useEffect } from 'react';
import { ExternalLink, Menu, X, Code2 } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

export const GITHUB_REPO_URL = 'https://github.com/luvbingchillin/Code-search';

export const Navbar: React.FC = () => {
  const [activeSection, setActiveSection] = useState('hero');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);

      const sections = ['architecture', 'comparison', 'pipeline', 'quickstart'];
      const scrollPos = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sections[i]);
          return;
        }
      }
      setActiveSection('hero');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navChapters = [
    { id: 'architecture', label: 'Advantages', num: '01' },
    { id: 'comparison', label: 'Code & AI Diff', num: '02' },
    { id: 'pipeline', label: 'Graph Engine', num: '03' },
    { id: 'quickstart', label: 'Deploy', num: '04' }
  ];

  return (
    <div className="sticky top-0 z-50 pt-3 sm:pt-4 px-4 pointer-events-none">
      <header
        className={`max-w-5xl mx-auto rounded-full transition-all duration-300 pointer-events-auto flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border ${
          scrolled
            ? 'bg-[#04140d]/85 backdrop-blur-md border-amber-600/30 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
            : 'bg-[#061e14]/70 backdrop-blur-sm border-amber-900/30'
        }`}
      >
        {/* Brand Emblem & Context */}
        <a href="#" className="flex items-center space-x-3 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#072418] border border-amber-600/50 shadow-inner group-hover:border-amber-400 transition-colors">
            <Code2 className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold tracking-tight text-[#f4f7f4] font-display">
              CODE-SEARCH
            </span>
            <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>100% Edge AI</span>
            </span>
          </div>
        </a>

        {/* Desktop Floating Capsule Chapter Navigation */}
        <nav className="hidden md:flex items-center space-x-1 bg-[#03110a] p-1 rounded-full border border-amber-900/30 text-xs font-mono">
          {navChapters.map((chap) => {
            const isActive = activeSection === chap.id;
            return (
              <a
                key={chap.id}
                href={`#${chap.id}`}
                className={`relative px-3 py-1 rounded-full transition-all duration-200 flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-amber-400 text-[#04140d] font-bold shadow-sm'
                    : 'text-[#9cb3a8] hover:text-[#f4f7f4] hover:bg-[#072418]/60'
                }`}
              >
                <span className={isActive ? 'text-[#04140d]/70 text-[11px]' : 'text-amber-400/60 text-[11px]'}>
                  {chap.num}
                </span>
                <span>{chap.label}</span>
              </a>
            );
          })}
        </nav>

        {/* GitHub Link Capsule & Mobile Menu Trigger */}
        <div className="flex items-center space-x-2">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="github-nav-link"
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#072418] to-[#0a3322] hover:to-[#0d442c] border border-amber-600/40 text-amber-200 text-xs font-medium transition-all shadow-sm group"
          >
            <GithubIcon className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-mono">GitHub</span>
            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-[#072418] border border-amber-900/40 text-amber-300 hover:text-amber-200"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden max-w-sm mx-auto mt-2 p-3 rounded-2xl bg-[#051a11]/95 backdrop-blur-lg border border-amber-600/30 shadow-2xl pointer-events-auto animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-amber-900/30">
            <span className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest">
              Navigation Chapters
            </span>
            <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/40">
              100% Edge AI
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 font-mono text-xs">
            {navChapters.map((chap) => {
              const isActive = activeSection === chap.id;
              return (
                <a
                  key={chap.id}
                  href={`#${chap.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-amber-400 text-[#04140d] font-bold'
                      : 'text-[#9cb3a8] hover:text-[#f4f7f4] hover:bg-[#072418]'
                  }`}
                >
                  <span>{chap.label}</span>
                  <span className={isActive ? 'text-[#04140d]/70 text-[11px]' : 'text-amber-400/60 text-[11px]'}>
                    {chap.num}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
