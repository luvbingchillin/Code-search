import React from 'react';
import { Layers, FileText, Code2, GitBranch, Terminal } from 'lucide-react';
import { AstCodeChunk } from '../../types';

interface ASTMetadataInspectorProps {
  chunk: AstCodeChunk | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ASTMetadataInspector: React.FC<ASTMetadataInspectorProps> = ({
  chunk,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !chunk) return null;

  return (
    <div
      data-testid="ast-metadata-inspector"
      className="border-t border-gray-800 bg-gray-900/95 p-3.5 max-h-56 overflow-y-auto text-xs font-mono space-y-2.5 shadow-inner"
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-gray-800">
        <div className="flex items-center space-x-1.5 text-gray-200 font-semibold">
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>AST Metadata Inspector</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-xs px-1.5 py-0.5 rounded hover:bg-gray-800"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-300">
        <div>
          <span className="text-gray-400">AST Node:</span>{' '}
          <span className="text-purple-300 font-semibold">{chunk.astNodeType}</span>
        </div>

        <div>
          <span className="text-gray-400">Identifier:</span>{' '}
          <span className="text-emerald-300">{chunk.identifier}</span>
        </div>

        <div>
          <span className="text-gray-400">Range:</span>{' '}
          <span>Lines {chunk.startLine} - {chunk.endLine} ({chunk.endLine - chunk.startLine + 1} lines)</span>
        </div>

        <div>
          <span className="text-gray-400">Repository:</span>{' '}
          <span className="text-blue-300">{chunk.repoFullName ?? 'local'}</span>
        </div>
      </div>

      {chunk.docstring && (
        <div className="pt-1">
          <div className="text-gray-400 flex items-center space-x-1 mb-1">
            <FileText className="w-3 h-3 text-amber-400" />
            <span>Docstring:</span>
          </div>
          <div className="bg-gray-950 p-2 rounded text-gray-300 border border-gray-800 font-sans text-xs">
            {chunk.docstring}
          </div>
        </div>
      )}

      {chunk.parameters && chunk.parameters.length > 0 && (
        <div className="pt-1">
          <div className="text-gray-400 flex items-center space-x-1 mb-1">
            <Terminal className="w-3 h-3 text-sky-400" />
            <span>Parameters ({chunk.parameters.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.parameters.map((param, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-gray-950 text-sky-300 border border-gray-800 text-[11px]"
              >
                {param}
              </span>
            ))}
          </div>
        </div>
      )}

      {chunk.decorators && chunk.decorators.length > 0 && (
        <div className="pt-1">
          <div className="text-gray-400 flex items-center space-x-1 mb-1">
            <Code2 className="w-3 h-3 text-pink-400" />
            <span>Decorators:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.decorators.map((dec, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-pink-950/40 text-pink-300 border border-pink-800/40 text-[11px]"
              >
                {dec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
