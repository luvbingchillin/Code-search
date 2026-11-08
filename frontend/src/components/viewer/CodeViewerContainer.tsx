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
  onSelectCall?: (callIdentifier: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onOpenConnectRepo?: () => void;
  onCloseChunk?: (id: string) => void;
}

export const CodeViewerContainer: React.FC<CodeViewerContainerProps> = ({
  chunks,
  selectedChunkId,
  onSelectChunk,
  onSelectCall,
  isMaximized,
  onToggleMaximize,
  isMinimized,
  onMinimize,
  onOpenConnectRepo,
  onCloseChunk,
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  const selectedChunk =
    chunks.find((c) => c.id === selectedChunkId) ?? (chunks.length > 0 ? chunks[0] : null);

  const handleSelectCall = (callIdentifier: string) => {
    if (onSelectCall) {
      onSelectCall(callIdentifier);
    } else {
      const cleanName = callIdentifier.replace(/^self\./, '');
      const match = chunks.find(
        (c) =>
          c.identifier === callIdentifier ||
          c.identifier === cleanName ||
          c.identifier.endsWith(`.${cleanName}`) ||
          cleanName.endsWith(`.${c.identifier}`) ||
          (callIdentifier.startsWith('self.') && c.identifier.endsWith(cleanName))
      );
      if (match) {
        onSelectChunk(match.id);
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#070a12]">
      {/* Chunk Tabs */}
      <ChunkSelectorTabs
        chunks={chunks}
        selectedChunkId={selectedChunk?.id ?? null}
        onSelectChunk={onSelectChunk}
        onCloseChunk={onCloseChunk}
      />

      {/* Code Header with Breadcrumbs and Copy */}
      <CodeViewerHeader
        chunk={selectedChunk}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        matchCount={matchCount}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      />

      {/* Prism Syntax Code Display with Line Numbers */}
      <CodeDisplay
        chunk={selectedChunk}
        onOpenConnectRepo={onOpenConnectRepo}
        searchTerm={searchTerm}
        onMatchCountChange={setMatchCount}
      />

      {/* Collapsible AST Metadata Drawer */}
      <ASTMetadataInspector
        chunk={selectedChunk}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        onSelectCall={handleSelectCall}
      />
    </div>
  );
};

export const CodeViewerPane = CodeViewerContainer;
