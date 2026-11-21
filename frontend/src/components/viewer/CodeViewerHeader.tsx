import React, { useState } from 'react';
import { Copy, Check, FileCode, Layers, Info, Search, Maximize2, Minimize2, X, PanelRightClose, FolderTree, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { AstCodeChunk } from '../../types';

export type ViewMode = 'code' | 'strata';

interface CodeViewerHeaderProps {
  chunk: AstCodeChunk | null;
  onToggleInspector?: () => void;
  isInspectorOpen?: boolean;
  onToggleExplorer?: () => void;
  isExplorerOpen?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  matchCount?: number;
  currentMatchIndex?: number;
  onNextMatch?: () => void;
  onPrevMatch?: () => void;
  viewMode?: ViewMode;
  onToggleViewMode?: (mode: ViewMode) => void;
  isFullFileMode?: boolean;
  onToggleFullFile?: () => void;
}

export const CodeViewerHeader: React.FC<CodeViewerHeaderProps> = ({
  chunk,
  onToggleInspector,
  isInspectorOpen,
  onToggleExplorer,
  isExplorerOpen,
  isMaximized,
  onToggleMaximize,
  isMinimized,
  onMinimize,
  searchTerm = '',
  onSearchChange,
  matchCount = 0,
  currentMatchIndex = 0,
  onNextMatch,
  onPrevMatch,
  viewMode = 'code',
  onToggleViewMode,
  isFullFileMode = false,
  onToggleFullFile,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(Boolean(searchTerm));

  React.useEffect(() => {
    if (searchTerm) {
      setIsSearchActive(true);
    }
  }, [searchTerm]);

  const handleCopy = async () => {
    if (!chunk) return;
    try {
      await navigator.clipboard.writeText(chunk.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const getNodeTypeBadgeColor = (nodeType?: string) => {
    switch (nodeType) {
      case 'FunctionDef':
      case 'AsyncFunctionDef':
        return 'bg-teal-950 text-teal-300 border-teal-600/70 shadow-xs';
      case 'ClassDef':
        return 'bg-blue-950 text-blue-300 border-blue-600/70 shadow-xs';
      case 'Module':
        return 'bg-amber-950 text-amber-300 border-amber-600/70 shadow-xs';
      default:
        return 'bg-slate-800 text-slate-200 border-slate-700';
    }
  };

  return (
    <div
      data-testid="code-viewer-header"
      className="h-10 px-3 flex items-center justify-between text-xs select-none transition-colors duration-200 bg-slate-900 border-b border-slate-800"
    >
      <div className="flex items-center space-x-2 overflow-hidden">
        {viewMode === 'strata' ? (
          <div className="flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-sm">🌐</span>
            <div
              data-testid="chunk-file-path"
              className="font-sans font-semibold text-sky-400 tracking-tight flex items-center space-x-1"
            >
              <span>3D Strata Architecture Map</span>
              {chunk && (
                <span className="text-slate-400 font-mono font-normal text-[11px] hidden md:inline truncate max-w-[200px]">
                  ({chunk.identifier})
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
            <div
              data-testid="chunk-file-path"
              className="font-mono text-slate-200 truncate max-w-[340px] font-medium flex items-center space-x-1"
              title={chunk ? `${chunk.filePath} > ${chunk.identifier}` : 'No file selected'}
            >
              {chunk ? (
                <>
                  <span className="text-slate-400 truncate">{chunk.filePath}</span>
                  <span className="text-slate-600 font-bold shrink-0">&gt;</span>
                  <span className="text-sky-300 font-semibold truncate">{chunk.identifier}</span>
                </>
              ) : (
                'No file selected'
              )}
            </div>

            {chunk && (
              <>
                <span
                  data-testid="chunk-node-type"
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${getNodeTypeBadgeColor(
                    chunk.astNodeType
                  )}`}
                  title={`Definition: ${chunk.astNodeType}`}
                >
                  {chunk.astNodeType}
                </span>

                <span
                  data-testid="chunk-line-range"
                  className="text-[11px] text-slate-400 font-mono hidden sm:inline"
                >
                  Lines {chunk.startLine}–{chunk.endLine}
                </span>

                <span
                  data-testid="chunk-relevance-score"
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/70 hidden md:inline font-semibold"
                  title="Semantic match score: how closely this code relates to your query"
                >
                  Match {(chunk.relevanceScore * 100).toFixed(0)}%
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        {/* View Mode Toggle: [ 📄 Code View | 🌐 3D Strata Map ] */}
        {onToggleViewMode && (
          <div
            data-testid="view-mode-toggle"
            role="group"
            aria-label="View mode selector"
            className="inline-flex items-center p-0.5 rounded border border-slate-700 bg-slate-950 shadow-xs mr-1"
          >
            <button
              type="button"
              data-testid="view-mode-code-btn"
              aria-pressed={viewMode === 'code'}
              onClick={() => onToggleViewMode('code')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'code'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
              title="Switch to 📄 Code View"
            >
              <span>📄</span>
              <span className="hidden sm:inline">Code View</span>
            </button>
            <button
              type="button"
              data-testid="view-mode-strata-btn"
              aria-pressed={viewMode === 'strata'}
              onClick={() => onToggleViewMode('strata')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'strata'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
              title="Switch to 🌐 3D Strata Map"
            >
              <span>🌐</span>
              <span className="hidden sm:inline">3D Strata Map</span>
            </button>
          </div>
        )}
        {/* In-Pane Search Bar */}
        {onSearchChange && (
          <div className="relative flex items-center">
            {isSearchActive ? (
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-2 py-0.5 space-x-1 shadow-xs">
                <Search className="w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  data-testid="code-search-input"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && matchCount > 0) {
                      e.preventDefault();
                      if (e.shiftKey) {
                        onPrevMatch?.();
                      } else {
                        onNextMatch?.();
                      }
                    } else if (e.key === 'Escape') {
                      onSearchChange('');
                      setIsSearchActive(false);
                    }
                  }}
                  placeholder="Find in code..."
                  autoFocus
                  className="bg-transparent text-slate-100 text-xs focus:outline-none w-28 sm:w-36 font-mono placeholder-slate-500"
                />
                {searchTerm.trim().length > 0 && (
                  <div className="flex items-center space-x-1">
                    <span
                      data-testid="search-match-count"
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-amber-300 border border-slate-700 whitespace-nowrap"
                    >
                      {matchCount > 0
                        ? `${Math.min(currentMatchIndex + 1, matchCount)}/${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`
                        : '0 matches'}
                    </span>
                    {matchCount > 1 && onPrevMatch && onNextMatch && (
                      <>
                        <button
                          type="button"
                          data-testid="search-prev-match-btn"
                          onClick={onPrevMatch}
                          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                          title="Previous match (Shift+Enter)"
                          aria-label="Previous match"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          data-testid="search-next-match-btn"
                          onClick={onNextMatch}
                          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                          title="Next match (Enter)"
                          aria-label="Next match"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                )}
                <button
                  data-testid="clear-code-search-btn"
                  onClick={() => {
                    onSearchChange('');
                    setIsSearchActive(false);
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  title="Close search"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                data-testid="open-code-search-btn"
                onClick={() => setIsSearchActive(true)}
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Search in code"
                aria-label="Search in code"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {onToggleFullFile && viewMode === 'code' && chunk && (
          <button
            type="button"
            data-testid="toggle-full-file-btn"
            aria-pressed={isFullFileMode}
            onClick={onToggleFullFile}
            className={`px-2 py-1 rounded transition-all flex items-center space-x-1 text-xs border cursor-pointer shadow-xs emil-press ${
              isFullFileMode
                ? 'bg-sky-950 text-sky-300 border-sky-500/60 font-semibold'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
            title={isFullFileMode ? 'Switch back to isolated symbol view' : 'View full source file with surrounding context'}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{isFullFileMode ? 'Full File' : 'Full File'}</span>
          </button>
        )}

        {onToggleExplorer && (
          <button
            type="button"
            data-testid="toggle-explorer-btn"
            aria-expanded={isExplorerOpen}
            onClick={onToggleExplorer}
            className={`px-2 py-1 rounded transition-all flex items-center space-x-1 text-xs border cursor-pointer shadow-xs emil-press ${
              isExplorerOpen
                ? 'bg-sky-950 text-sky-300 border-sky-600/70'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
            title="Toggle Repository Explorer Tree"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Explorer</span>
          </button>
        )}

        {onToggleInspector && (
          <button
            type="button"
            data-testid="toggle-ast-inspector-btn"
            aria-expanded={isInspectorOpen}
            onClick={onToggleInspector}
            className={`px-2 py-1 rounded transition-all flex items-center space-x-1 text-xs border cursor-pointer shadow-xs emil-press ${
              isInspectorOpen
                ? 'bg-slate-800 text-sky-300 border-sky-500/70'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
            title="Inspect symbol details, parameters & call graph"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Symbol Info</span>
          </button>
        )}

        <button
          data-testid="copy-code-btn"
          onClick={handleCopy}
          disabled={!chunk}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-slate-200 hover:text-white border transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer emil-press ${
            copied
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 emil-spring-pop ring-1 ring-emerald-500/50'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
          }`}
          title="Copy code to clipboard"
        >
          {copied ? (
            <span className="flex items-center space-x-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-xs">Copied!</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1">
              <Copy className="w-3.5 h-3.5" />
              <span className="text-xs">Copy</span>
            </span>
          )}
        </button>

        {onMinimize && (
          <button
            type="button"
            data-testid="minimize-code-btn"
            onClick={onMinimize}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer emil-press"
            title="Minimize code viewer pane"
            aria-label="Minimize code viewer pane"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        )}

        {onToggleMaximize && (
          <button
            type="button"
            data-testid="toggle-maximize-code-btn"
            onClick={onToggleMaximize}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer emil-press"
            title={isMaximized ? "Restore split layout" : "Maximize code viewer"}
            aria-label={isMaximized ? "Restore split layout" : "Maximize code viewer"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};
