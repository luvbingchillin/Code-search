import React, { useMemo, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { FolderCode, FolderPlus } from 'lucide-react';
import { AstCodeChunk } from '../../types';

interface CodeDisplayProps {
  chunk: AstCodeChunk | null;
  onOpenConnectRepo?: () => void;
  searchTerm?: string;
  onMatchCountChange?: (count: number) => void;
}

const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

export const CodeDisplay: React.FC<CodeDisplayProps> = ({
  chunk,
  onOpenConnectRepo,
  searchTerm = '',
  onMatchCountChange,
}) => {
  const lines = useMemo(() => {
    return chunk ? chunk.code.split('\n') : [];
  }, [chunk?.code]);

  const highlightedHtml = useMemo(() => {
    if (!chunk?.code) return '';
    try {
      if (Prism.languages.python) {
        return Prism.highlight(chunk.code, Prism.languages.python, 'python');
      }
      return chunk.code;
    } catch (err) {
      console.error('Prism Python highlighting error:', err);
      return chunk.code;
    }
  }, [chunk?.code]);

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

  if (!chunk) {
    return (
      <div
        data-testid="code-display"
        className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#070a12] select-none"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 shadow-inner text-sky-400">
          <FolderCode className="w-7 h-7 opacity-80" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1 font-sans">
          No AST code chunk selected.
        </h3>
        <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
          Connect a local repository to extract and index its AST code chunks, or submit a search query in the chat.
        </p>
        {onOpenConnectRepo && (
          <button
            type="button"
            data-testid="empty-state-connect-repo-btn"
            onClick={onOpenConnectRepo}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-md shadow-sky-950/40 flex items-center space-x-1.5 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Connect Local Repository</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="code-display"
      className="flex-1 overflow-auto bg-[#070a12] font-mono text-xs sm:text-sm leading-6 flex"
    >
      {/* Aligned Line Numbers Gutter with High Contrast Border */}
      <div
        data-testid="code-line-numbers"
        className="select-none py-3 px-3.5 text-right text-slate-500 bg-[#06090f] border-r border-slate-800 sticky left-0 z-10 shrink-0 font-mono"
      >
        {lines.map((_, index) => {
          const lineNumber = chunk.startLine + index;
          return (
            <div key={index} data-testid="line-number" className="h-6 font-mono">
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
