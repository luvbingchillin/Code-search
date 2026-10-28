import React from 'react';
import { Code, Inbox } from 'lucide-react';
import { AstCodeChunk } from '../../types';

interface ChunkSelectorTabsProps {
  chunks: AstCodeChunk[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
}

export const ChunkSelectorTabs: React.FC<ChunkSelectorTabsProps> = ({
  chunks,
  selectedChunkId,
  onSelectChunk,
}) => {
  if (chunks.length === 0) {
    return (
      <div
        data-testid="chunk-tabs-empty"
        className="px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs text-slate-400 flex items-center space-x-2"
      >
        <Inbox className="w-3.5 h-3.5 text-slate-500" />
        <span>No AST code chunks retrieved yet.</span>
      </div>
    );
  }

  return (
    <div
      data-testid="chunk-selector-tabs"
      className="bg-slate-950 border-b border-slate-800 px-2 pt-1.5 flex items-center space-x-1.5 overflow-x-auto no-scrollbar"
    >
      {chunks.map((chunk, index) => {
        const isSelected = chunk.id === selectedChunkId;

        return (
          <button
            key={chunk.id}
            data-testid={`chunk-tab-${chunk.id}`}
            aria-selected={isSelected}
            onClick={() => onSelectChunk(chunk.id)}
            className={`group px-3 py-1.5 text-xs font-mono rounded-t-md border-t border-x flex items-center space-x-2 transition-all shrink-0 cursor-pointer ${
              isSelected
                ? 'bg-slate-800 border-t-2 border-t-indigo-400 border-x-slate-700 border-b-slate-800 text-white shadow-sm font-semibold'
                : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded font-sans font-medium ${
                isSelected
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-600/60'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              #{index + 1}
            </span>
            <Code className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
            <span className="truncate max-w-[140px]">{chunk.identifier}</span>
            <span
              className={`text-xs font-semibold ${
                isSelected ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {(chunk.relevanceScore * 100).toFixed(0)}%
            </span>
          </button>
        );
      })}
    </div>
  );
};
