import React, { useRef } from 'react';
import { Layers, Code2, Inbox, X } from 'lucide-react';
import { AstCodeChunk } from '../../types';

interface ChunkSelectorTabsProps {
  chunks: AstCodeChunk[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
  onCloseChunk?: (chunkId: string) => void;
  onCloseAllChunks?: () => void;
}

export const ChunkSelectorTabs: React.FC<ChunkSelectorTabsProps> = ({
  chunks,
  selectedChunkId,
  onSelectChunk,
  onCloseChunk,
  onCloseAllChunks,
}) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (chunks.length === 0) {
    return (
      <div
        data-testid="chunk-tabs-empty"
        className="px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs text-slate-400 flex items-center space-x-2 select-none"
      >
        <Inbox className="w-3.5 h-3.5 text-slate-500" />
        <span>No code definitions open yet.</span>
        <span className="sr-only">No AST code chunks retrieved yet.</span>
      </div>
    );
  }

  return (
    <div
      data-testid="chunk-selector-tabs"
      role="tablist"
      aria-label="Open code definitions"
      className="bg-slate-950 border-b border-slate-800 px-2 pt-1.5 flex items-center space-x-1.5 overflow-x-auto no-scrollbar"
    >
      {chunks.map((chunk, idx) => {
        const isSelected = chunk.id === selectedChunkId;
        const isClass = chunk.astNodeType?.toLowerCase().includes('class');
        const scorePct = Math.round(chunk.relevanceScore * 100);
        const fileName = chunk.fileName || chunk.filePath?.split(/[\\/]/).pop() || '';

        return (
          <div
            key={chunk.id}
            data-testid={`chunk-tab-${chunk.id}`}
            role="tab"
            tabIndex={isSelected ? 0 : -1}
            aria-selected={isSelected}
            ref={(el) => {
              tabRefs.current[chunk.id] = el as unknown as HTMLButtonElement | null;
            }}
            onClick={() => onSelectChunk(chunk.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectChunk(chunk.id);
              } else if (e.key === 'ArrowRight' && chunks.length > 1) {
                e.preventDefault();
                const nextId = chunks[(idx + 1) % chunks.length].id;
                onSelectChunk(nextId);
                tabRefs.current[nextId]?.focus();
              } else if (e.key === 'ArrowLeft' && chunks.length > 1) {
                e.preventDefault();
                const prevId = chunks[(idx - 1 + chunks.length) % chunks.length].id;
                onSelectChunk(prevId);
                tabRefs.current[prevId]?.focus();
              }
            }}
            title={`${chunk.identifier} (${isClass ? 'Class' : 'Function'})\nFile: ${chunk.filePath}\nSemantic Match: ${scorePct}%`}
            className={`group px-3 py-1.5 text-xs font-mono rounded-t-md border-t border-x flex items-center space-x-2 transition-all shrink-0 cursor-pointer select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
              isSelected
                ? 'bg-slate-800 border-t-2 border-t-sky-400 border-x-slate-700 border-b-slate-800 text-white shadow-sm font-semibold'
                : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {/* Symbol Type Icon */}
            {isClass ? (
              <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400'}`} />
            ) : (
              <Code2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-teal-400' : 'text-slate-500 group-hover:text-teal-400'}`} />
            )}

            {/* Symbol Identifier */}
            <span className="truncate max-w-[150px] font-medium">{chunk.identifier}</span>

            {/* Parent File Badge */}
            {fileName && (
              <span className="text-[11px] text-slate-400 font-sans group-hover:text-slate-300 transition-colors">
                {fileName}
              </span>
            )}

            {/* Close Tab Button */}
            {onCloseChunk && (
              <button
                type="button"
                data-testid={`close-chunk-tab-${chunk.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseChunk(chunk.id);
                }}
                className={`${
                  isSelected ? 'opacity-80 hover:opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                } hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded min-w-[24px] min-h-[24px] flex items-center justify-center transition-all ml-1 cursor-pointer focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400`}
                title="Close tab"
                aria-label={`Close tab: ${chunk.identifier}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {onCloseChunk && chunks.length > 2 && (
        <button
          type="button"
          data-testid="close-all-tabs-btn"
          onClick={() => {
            if (onCloseAllChunks) {
              onCloseAllChunks();
            } else {
              chunks.forEach((c) => onCloseChunk(c.id));
            }
          }}
          className="ml-auto text-[11px] font-sans text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors shrink-0 cursor-pointer"
          title="Close all open tabs"
        >
          Close All
        </button>
      )}
    </div>
  );
};
