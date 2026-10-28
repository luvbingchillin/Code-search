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
        className="px-3 py-2 bg-gray-950 border-b border-gray-800 text-xs text-gray-500 flex items-center space-x-2"
      >
        <Inbox className="w-3.5 h-3.5" />
        <span>No AST code chunks retrieved yet.</span>
      </div>
    );
  }

  return (
    <div
      data-testid="chunk-selector-tabs"
      className="bg-gray-950/80 border-b border-gray-800 px-2 pt-1.5 flex items-center space-x-1.5 overflow-x-auto no-scrollbar"
    >
      {chunks.map((chunk, index) => {
        const isSelected = chunk.id === selectedChunkId;

        return (
          <button
            key={chunk.id}
            data-testid={`chunk-tab-${chunk.id}`}
            aria-selected={isSelected}
            onClick={() => onSelectChunk(chunk.id)}
            className={`group px-3 py-1.5 text-xs font-mono rounded-t-md border-t border-x flex items-center space-x-2 transition-all shrink-0 ${
              isSelected
                ? 'bg-gray-900 border-gray-700 text-purple-300 shadow-sm font-semibold'
                : 'bg-gray-950 hover:bg-gray-900/50 border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="text-[11px] px-1 rounded bg-gray-800 text-gray-300 font-sans">
              #{index + 1}
            </span>
            <Code className="w-3.5 h-3.5 text-purple-400" />
            <span className="truncate max-w-[140px]">{chunk.identifier}</span>
            <span
              className={`text-xs font-medium ${
                isSelected ? 'text-purple-400' : 'text-gray-300'
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
