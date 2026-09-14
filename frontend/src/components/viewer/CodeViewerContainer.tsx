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
}

export const CodeViewerContainer: React.FC<CodeViewerContainerProps> = ({
  chunks,
  selectedChunkId,
  onSelectChunk,
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const selectedChunk =
    chunks.find((c) => c.id === selectedChunkId) ?? (chunks.length > 0 ? chunks[0] : null);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-950">
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
      />

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
