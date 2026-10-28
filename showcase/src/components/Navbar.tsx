import React, { useState, useEffect } from 'react';
import { ExternalLink, Menu, X, Code2 } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

export const GITHUB_REPO_URL = 'https://github.com/luvbingchillin/Code-search';

export const Navbar: React.FC = () => {
  const [activeSection, setActiveSection] = useState('hero');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);

      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100);
      }

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
        className={`max-w-5xl mx-auto rounded-full transition-all duration-300 pointer-events-auto flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border relative overflow-hidden ${
          scrolled
            ? 'bg-[#0a1f10]/95 backdrop-blur-md border-[#dad0a7]/30 shadow-[0_12px_36px_rgba(10,31,16,0.25)]'
            : 'bg-[#0a1f10]/90 backdrop-blur-sm border-[#dad0a7]/20 shadow-md'
        }`}
      >
        {/* Hairline Reading Progress Indicator */}
        <div className="absolute top-0 left-6 right-6 h-[2px] overflow-hidden rounded-t-full pointer-events-none">
          <div
            className="h-full bg-[#68f12b] transition-all duration-100 shadow-[0_0_8px_#68f12b]"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
        {/* Brand Emblem & Context */}
        <a href="#" className="flex items-center space-x-3 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#143520] border border-[#68f12b]/40 shadow-inner group-hover:border-[#68f12b] transition-colors">
            <Code2 className="w-4 h-4 text-[#68f12b]" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold tracking-tight text-[#f4f3eb] font-display uppercase">
              CODE-SEARCH
            </span>
            <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#143520] text-[#68f12b] border border-[#68f12b]/30 text-[11px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#68f12b] animate-pulse" />
              <span>100% EDGE AI</span>
            </span>
          </div>
        </a>

        {/* Desktop Floating Capsule Chapter Navigation */}
        <nav className="hidden md:flex items-center space-x-1 bg-[#05140b] p-1 rounded-full border border-[#dad0a7]/20 text-xs font-mono">
          {navChapters.map((chap) => {
            const isActive = activeSection === chap.id;
            return (
              <a
                key={chap.id}
                href={`#${chap.id}`}
                className={`relative px-3 py-1 rounded-full transition-all duration-200 flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#68f12b] text-[#0a1f10] font-bold shadow-sm'
                    : 'text-[#dad0a7] hover:text-[#f4f3eb] hover:bg-[#143520]'
                }`}
              >
                <span className={isActive ? 'text-[#0a1f10]/70 text-[11px]' : 'text-[#68f12b]/80 text-[11px]'}>
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
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#143520] hover:bg-[#1b442a] border border-[#68f12b]/40 text-[#f4f3eb] text-xs font-medium transition-all shadow-sm group"
          >
            <GithubIcon className="w-3.5 h-3.5 text-[#68f12b]" />
            <span className="font-mono">GitHub</span>
            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-[#143520] border border-[#dad0a7]/30 text-[#68f12b] hover:text-[#ffffff]"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden max-w-sm mx-auto mt-2 p-3 rounded-2xl bg-[#0a1f10]/98 backdrop-blur-lg border border-[#dad0a7]/30 shadow-2xl pointer-events-auto animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-[#dad0a7]/20">
            <span className="text-xs font-mono font-medium text-[#dad0a7] uppercase tracking-widest">
              Navigation Chapters
            </span>
            <span className="text-[11px] font-mono text-[#68f12b] bg-[#143520] px-2 py-0.5 rounded-full border border-[#68f12b]/30">
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
                      ? 'bg-[#68f12b] text-[#0a1f10] font-bold'
                      : 'text-[#dad0a7] hover:text-[#f4f3eb] hover:bg-[#143520]'
                  }`}
                >
                  <span>{chap.label}</span>
                  <span className={isActive ? 'text-[#0a1f10]/70 text-[11px]' : 'text-[#68f12b] text-[11px]'}>
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
