import React, { useState } from 'react';
import { AstCodeChunk } from '../../types';
import { CodeViewerHeader } from './CodeViewerHeader';
import { ChunkSelectorTabs } from './ChunkSelectorTabs';
import { CodeDisplay } from './CodeDisplay';
import { ASTMetadataInspector } from './ASTMetadataInspector';

export interface CodeViewerContainerProps {
  chunks: AstCodeChunk[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
}

export const CodeViewerContainer: React.FC<CodeViewerContainerProps> = ({
  chunks,
  selectedChunkId,
  onSelectChunk,
  isMaximized,
  onToggleMaximize,
  isMinimized,
  onMinimize,
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedChunk =
    chunks.find((c) => c.id === selectedChunkId) ?? (chunks.length > 0 ? chunks[0] : null);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070a12]">
      {/* Chunk Tabs */}
      <ChunkSelectorTabs
        chunks={chunks}
        selectedChunkId={selectedChunk?.id ?? null}
        onSelectChunk={onSelectChunk}
      />

      {/* Code Header with Breadcrumbs and Copy */}
      <CodeViewerHeader
        chunk={selectedChunk}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      />

      {/* Sticky First-Class AST Symbol Context Strip */}
      {selectedChunk && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-3.5 py-1.5 flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-100 text-xs flex items-center space-x-1">
              <span className="text-purple-400 font-semibold">{selectedChunk.astNodeType.toLowerCase().includes('class') ? 'class' : 'def'}</span>
              <span className="text-sky-300 font-semibold">{selectedChunk.identifier}</span>
            </span>
          </div>

          {selectedChunk.parameters && selectedChunk.parameters.length > 0 && (
            <div className="hidden sm:flex items-center space-x-1.5">
              <span className="text-slate-400 text-xs">params:</span>
              <div className="flex items-center space-x-1">
                {selectedChunk.parameters.slice(0, 3).map((param, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-700 text-xs font-mono">
                    {param}
                  </span>
                ))}
                {selectedChunk.parameters.length > 3 && (
                  <span className="text-slate-400 text-xs font-mono">+{selectedChunk.parameters.length - 3}</span>
                )}
              </div>
            </div>
          )}

          {selectedChunk.decorators && selectedChunk.decorators.length > 0 && (
            <div className="hidden lg:flex items-center space-x-1">
              {selectedChunk.decorators.slice(0, 2).map((dec, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-700/60 text-xs font-mono">
                  {dec}
                </span>
              ))}
            </div>
          )}

          {selectedChunk.docstring && (
            <div className="hidden md:flex items-center space-x-1 text-slate-300 text-xs font-sans ml-auto" title={selectedChunk.docstring}>
              <span className="text-amber-400 font-mono">"""</span>
              <span className="italic text-slate-300">Docstring available</span>
              <span className="text-amber-400 font-mono">"""</span>
            </div>
          )}
        </div>
      )}

      {/* Prism Syntax Code Display with Line Numbers */}
      <CodeDisplay chunk={selectedChunk} />

      {/* Collapsible AST Metadata Drawer */}
      <ASTMetadataInspector
        chunk={selectedChunk}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </div>
  );
};

export const CodeViewerPane = CodeViewerContainer;
