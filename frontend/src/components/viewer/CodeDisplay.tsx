import React, { useMemo, useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { FolderCode, FolderPlus, FolderTree, Loader2 } from 'lucide-react';
import { AstCodeChunk } from '../../types';

interface CodeDisplayProps {
  chunk: AstCodeChunk | null;
  onOpenConnectRepo?: () => void;
  searchTerm?: string;
  onMatchCountChange?: (count: number) => void;
  currentMatchIndex?: number;
  hasActiveRepo?: boolean;
  onToggleExplorer?: () => void;
  isFullFileMode?: boolean;
  fullFileContent?: string | null;
  isLoadingFullFile?: boolean;
}

const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

export const CodeDisplay: React.FC<CodeDisplayProps> = ({
  chunk,
  onOpenConnectRepo,
  searchTerm = '',
  onMatchCountChange,
  currentMatchIndex = 0,
  hasActiveRepo = false,
  onToggleExplorer,
  isFullFileMode = false,
  fullFileContent = null,
  isLoadingFullFile = false,
}) => {
  const codeContainerRef = useRef<HTMLDivElement | null>(null);
  const showingFullFile = Boolean(isFullFileMode && fullFileContent !== null);
  const displayCode = showingFullFile ? fullFileContent || '' : chunk?.code || '';
  const startLineOffset = showingFullFile ? 1 : chunk?.startLine ?? 1;

  const lines = useMemo(() => {
    return chunk ? displayCode.split('\n') : [];
  }, [chunk, displayCode]);

  const highlightedHtml = useMemo(() => {
    if (!displayCode) return '';
    try {
      if (Prism.languages.python) {
        return Prism.highlight(displayCode, Prism.languages.python, 'python');
      }
      return displayCode;
    } catch (err) {
      console.error('Prism Python highlighting error:', err);
      return displayCode;
    }
  }, [displayCode]);

  const { safeHtml, matchCount } = useMemo(() => {
    if (!highlightedHtml || !searchTerm || !searchTerm.trim()) {
      return { safeHtml: highlightedHtml, matchCount: 0 };
    }
    try {
      const term = searchTerm.trim();
      const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
      let count = 0;
      const parts = highlightedHtml.split(/(<[^>]+>)/g);
      for (let i = 0; i < parts.length; i += 2) {
        const matches = parts[i].match(regex);
        if (matches) {
          count += matches.length;
          parts[i] = parts[i].replace(
            regex,
            '<mark class="bg-amber-400/30 text-amber-200 border-b border-amber-400 font-semibold px-0.5 rounded">$1</mark>'
          );
        }
      }
      return { safeHtml: parts.join(''), matchCount: count };
    } catch (err) {
      console.error('Code search highlight error:', err);
      return { safeHtml: highlightedHtml, matchCount: 0 };
    }
  }, [highlightedHtml, searchTerm]);

  useEffect(() => {
    onMatchCountChange?.(matchCount);
  }, [matchCount, onMatchCountChange]);

  // Highlight and auto-scroll to active search match when stepping Next/Prev
  useEffect(() => {
    if (!codeContainerRef.current) return;
    const marks = codeContainerRef.current.querySelectorAll<HTMLElement>('mark');
    marks.forEach((m, idx) => {
      if (marks.length > 1 && idx === currentMatchIndex) {
        m.style.outline = '2px solid #38bdf8';
        m.style.outlineOffset = '1px';
      } else {
        m.style.outline = '';
        m.style.outlineOffset = '';
      }
    });
    if (!searchTerm.trim() || matchCount === 0) return;
    const activeMark = marks[currentMatchIndex];
    if (activeMark && typeof activeMark.scrollIntoView === 'function') {
      activeMark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentMatchIndex, matchCount, searchTerm]);

  // Auto-scroll to the active symbol's start line when entering Full File mode
  useEffect(() => {
    if (!showingFullFile || !chunk || !codeContainerRef.current) return;
    const targetLineEl = codeContainerRef.current.querySelector<HTMLElement>(
      `[data-line-number="${chunk.startLine}"]`
    );
    if (targetLineEl && typeof targetLineEl.scrollIntoView === 'function') {
      targetLineEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [showingFullFile, chunk?.id, chunk?.startLine]);

  if (!chunk) {
    if (hasActiveRepo) {
      return (
        <div
          data-testid="code-display"
          className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#070a12] select-none"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 shadow-inner text-emerald-400">
            <FolderCode className="w-7 h-7 opacity-80" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1 font-sans">
            No open code tabs
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
            Select a Python file or symbol from the Explorer sidebar on the left, or ask a question in chat.
            <span className="sr-only">No AST code tabs open</span>
          </p>
          {onToggleExplorer && (
            <button
              type="button"
              data-testid="empty-state-open-explorer-btn"
              onClick={onToggleExplorer}
              className="px-3.5 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium transition-colors shadow-md shadow-sky-950/40 flex items-center space-x-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 emil-press"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Open File Explorer</span>
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        data-testid="code-display"
        className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#070a12] select-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 shadow-inner text-sky-400">
          <FolderCode className="w-7 h-7 opacity-80" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1 font-sans">
          No code file selected
        </h3>
        <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
          No repository connected. Connect a local repository to index its functions and classes, or submit a search query in the chat.
          <span className="sr-only">No AST code chunk selected.</span>
        </p>
        {onOpenConnectRepo && (
            <button
              type="button"
              data-testid="empty-state-connect-repo-btn"
              onClick={onOpenConnectRepo}
              className="px-3.5 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium transition-colors shadow-md shadow-sky-950/40 flex items-center space-x-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 emil-press active:scale-95"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Connect Repository</span>
            </button>
        )}
      </div>
    );
  }

  if (isFullFileMode && isLoadingFullFile) {
    return (
      <div
        data-testid="code-display"
        className="flex-1 flex items-center justify-center p-8 bg-[#070a12] text-xs font-mono text-slate-400 space-x-2"
      >
        <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
        <span>Loading full source file ({chunk.filePath})...</span>
      </div>
    );
  }

  return (
    <div
      ref={codeContainerRef}
      data-testid="code-display"
      className="flex-1 overflow-auto bg-[#070a12] font-mono text-xs sm:text-sm leading-6 flex"
    >
      {/* Aligned Line Numbers Gutter with High Contrast Border */}
      <div
        data-testid="code-line-numbers"
        className="select-none py-3 px-3.5 text-right text-slate-400 bg-[#06090f] border-r border-slate-800 sticky left-0 z-10 shrink-0 font-mono"
      >
        {lines.map((_, index) => {
          const lineNumber = startLineOffset + index;
          const isInSymbolRange =
            showingFullFile && lineNumber >= chunk.startLine && lineNumber <= chunk.endLine;
          return (
            <div
              key={index}
              data-testid="line-number"
              data-line-number={lineNumber}
              className={`h-6 font-mono ${
                isInSymbolRange ? 'text-sky-400 font-semibold pr-1 border-r-2 border-sky-400' : ''
              }`}
            >
              {lineNumber}
            </div>
          );
        })}
      </div>

      {/* Synchronized Code Content Area */}
      <div className="py-3 px-4 flex-1 overflow-x-auto bg-[#070a12]">
        <pre className="language-python !bg-transparent !p-0 !m-0 font-mono">
          <code
            className="language-python"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </pre>
      </div>
    </div>
  );
};
