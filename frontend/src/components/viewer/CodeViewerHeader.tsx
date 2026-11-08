import React, { useState } from 'react';
import { Copy, Check, FileCode, Layers, Info, Search, Maximize2, Minimize2, X, PanelRightClose, FolderTree } from 'lucide-react';
import { AstCodeChunk } from '../../types';

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
        return 'bg-purple-950 text-purple-300 border-purple-600/70 shadow-xs';
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
      className="h-10 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-xs select-none"
    >
      <div className="flex items-center space-x-2 overflow-hidden">
        <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
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
              title={`AST Node: ${chunk.astNodeType}`}
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
              title="Vector semantic similarity score calculated by LanceDB"
            >
              Relevance {(chunk.relevanceScore * 100).toFixed(0)}%
            </span>
          </>
        )}
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
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
                  placeholder="Find in code..."
                  autoFocus
                  className="bg-transparent text-slate-100 text-xs focus:outline-none w-28 sm:w-36 font-mono placeholder-slate-500"
                />
                {searchTerm.trim().length > 0 && (
                  <span
                    data-testid="search-match-count"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-amber-300 border border-slate-700 whitespace-nowrap"
                  >
                    {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                  </span>
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
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Search in code"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {onToggleExplorer && (
          <button
            type="button"
            data-testid="toggle-explorer-btn"
            onClick={onToggleExplorer}
            className={`px-2 py-1 rounded transition-colors flex items-center space-x-1 text-xs border cursor-pointer shadow-xs ${
              isExplorerOpen
                ? 'bg-indigo-950 text-indigo-300 border-indigo-600/70'
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
            data-testid="toggle-ast-inspector-btn"
            onClick={onToggleInspector}
            className={`px-2 py-1 rounded transition-colors flex items-center space-x-1 text-xs border cursor-pointer shadow-xs ${
              isInspectorOpen
                ? 'bg-purple-950 text-purple-300 border-purple-600/70'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
            title="Toggle AST Metadata Inspector"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AST Info</span>
          </button>
        )}

        <button
          data-testid="copy-code-btn"
          onClick={handleCopy}
          disabled={!chunk}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          title="Copy Python AST code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </button>

        {onMinimize && (
          <button
            type="button"
            data-testid="minimize-code-btn"
            onClick={onMinimize}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
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
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
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
