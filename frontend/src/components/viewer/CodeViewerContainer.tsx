import React, { useState } from 'react';
import { AstCodeChunk, FileSymbolNode } from '../../types';
import { CodeViewerHeader } from './CodeViewerHeader';
import { ChunkSelectorTabs } from './ChunkSelectorTabs';
import { CodeDisplay } from './CodeDisplay';
import { ASTMetadataInspector } from './ASTMetadataInspector';
import { RepoFileTree } from './RepoFileTree';
import { apiClient } from '../../services/apiClient';

export interface CodeViewerContainerProps {
  chunks: AstCodeChunk[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
  onSelectCall?: (callIdentifier: string) => Promise<boolean | void> | boolean | void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onOpenConnectRepo?: () => void;
  onCloseChunk?: (id: string) => void;
  activeRepoId?: string | null;
  onAddChunk?: (chunk: AstCodeChunk) => void;
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
  activeRepoId,
  onAddChunk,
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
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

  const handleSelectTreeSymbol = async (symbol: FileSymbolNode) => {
    // 1. Check if chunk already loaded locally
    const local = chunks.find((c) => c.id === symbol.id || c.identifier === symbol.identifier);
    if (local) {
      onSelectChunk(local.id);
      return;
    }

    // 2. Fetch specific chunk by unique ID
    try {
      const fetched = await apiClient.getChunkById(symbol.id);
      if (fetched) {
        if (onAddChunk) {
          onAddChunk(fetched);
        }
        onSelectChunk(fetched.id);
        return;
      }
    } catch {
      // Fallback to lookupEntity
    }

    // 3. Fallback to exact entity lookup
    try {
      const resp = await apiClient.lookupEntity(symbol.identifier);
      if (resp && resp.chunks && resp.chunks.length > 0) {
        if (onAddChunk) {
          onAddChunk(resp.chunks[0]);
        }
        onSelectChunk(resp.chunks[0].id);
      }
    } catch (err) {
      console.warn('Failed to load symbol from tree:', err);
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

      {/* Code Header with Breadcrumbs, Search, Explorer Toggle and Actions */}
      <CodeViewerHeader
        chunk={selectedChunk}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isExplorerOpen={isExplorerOpen}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        matchCount={matchCount}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      />

      {/* Main Content Area (Optional Left Explorer + Code Display) */}
      <div className="flex-1 flex overflow-hidden relative">
        {isExplorerOpen && (
          <RepoFileTree
            repoId={activeRepoId ?? null}
            activeChunkId={selectedChunk?.id ?? null}
            onSelectSymbol={handleSelectTreeSymbol}
            onClose={() => setIsExplorerOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Prism Syntax Code Display with Line Numbers */}
          <CodeDisplay
            chunk={selectedChunk}
            onOpenConnectRepo={onOpenConnectRepo}
            searchTerm={searchTerm}
            onMatchCountChange={setMatchCount}
            hasActiveRepo={Boolean(activeRepoId)}
            onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
          />

          {/* Collapsible AST Metadata Drawer */}
          <ASTMetadataInspector
            chunk={selectedChunk}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            onSelectCall={handleSelectCall}
          />
        </div>
      </div>
    </div>
  );
};

export const CodeViewerPane = CodeViewerContainer;
