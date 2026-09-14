import React, { useState } from 'react';
import { Copy, Check, FileCode, Layers, Info } from 'lucide-react';
import { AstCodeChunk } from '../../types';

interface CodeViewerHeaderProps {
  chunk: AstCodeChunk | null;
  onToggleInspector?: () => void;
  isInspectorOpen?: boolean;
}

export const CodeViewerHeader: React.FC<CodeViewerHeaderProps> = ({
  chunk,
  onToggleInspector,
  isInspectorOpen,
}) => {
  const [copied, setCopied] = useState(false);

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
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'ClassDef':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
      case 'Module':
        return 'bg-amber-900/60 text-amber-300 border-amber-700/50';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  return (
    <div
      data-testid="code-viewer-header"
      className="h-11 bg-gray-900/90 border-b border-gray-800 px-3 flex items-center justify-between text-xs backdrop-blur-sm"
    >
      <div className="flex items-center space-x-2.5 overflow-hidden">
        <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
        <span
          data-testid="chunk-file-path"
          className="font-mono text-gray-200 truncate max-w-[280px]"
          title={chunk?.filePath}
        >
          {chunk ? chunk.filePath : 'No file selected'}
        </span>

        {chunk && (
          <>
            <span
              data-testid="chunk-node-type"
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${getNodeTypeBadgeColor(
                chunk.astNodeType
              )}`}
            >
              {chunk.astNodeType}
            </span>

            <span
              data-testid="chunk-line-range"
              className="text-[11px] text-gray-400 font-mono hidden sm:inline"
            >
              Lines {chunk.startLine}–{chunk.endLine}
            </span>

            <span
              data-testid="chunk-relevance-score"
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 hidden md:inline"
            >
              Relevance {(chunk.relevanceScore * 100).toFixed(0)}%
            </span>
          </>
        )}
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        {onToggleInspector && (
          <button
            data-testid="toggle-ast-inspector-btn"
            onClick={onToggleInspector}
            className={`p-1.5 rounded transition-colors flex items-center space-x-1 text-xs ${
              isInspectorOpen
                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
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
          className="flex items-center space-x-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
};
