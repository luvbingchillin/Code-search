import React, { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { AstCodeChunk, FileSymbolNode } from '../../types';
import { CodeViewerHeader, ViewMode } from './CodeViewerHeader';
import { ChunkSelectorTabs } from './ChunkSelectorTabs';
import { CodeDisplay } from './CodeDisplay';
import { ASTMetadataInspector } from './ASTMetadataInspector';
import { RepoFileTree } from './RepoFileTree';
import { apiClient } from '../../services/apiClient';
import { StrataCanvas } from '../strata/StrataCanvas';
import { computeStrataLayout, StrataGraphData, STRATA_TIER_COLORS } from '../../services/strata/strataLayout';
import { getMockStrataGraph } from '../../services/mockStrataData';

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
  onCloseAllChunks?: () => void;
  activeRepoId?: string | null;
  onAddChunk?: (chunk: AstCodeChunk) => void;
  viewMode?: ViewMode;
  onToggleViewMode?: (mode: ViewMode) => void;
  citedChunks?: string[];
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
  onCloseAllChunks,
  activeRepoId,
  onAddChunk,
  viewMode: propViewMode,
  onToggleViewMode,
  citedChunks,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('code');
  const activeViewMode = propViewMode ?? internalViewMode;

  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [isFullFileMode, setIsFullFileMode] = useState(false);
  const [fullFileContent, setFullFileContent] = useState<string | null>(null);
  const [isLoadingFullFile, setIsLoadingFullFile] = useState(false);

  // Strata 3D graph state
  const [strataGraphData, setStrataGraphData] = useState<StrataGraphData>(() => {
    const initialRaw = getMockStrataGraph(activeRepoId || 'requests');
    return computeStrataLayout(initialRaw);
  });
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);

  const handleToggleViewMode = (mode: ViewMode) => {
    setInternalViewMode(mode);
    onToggleViewMode?.(mode);
  };

  // Fetch strata graph data when active repository changes
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getRepoStrataGraph(activeRepoId || 'requests')
      .then((rawGraph) => {
        if (isMounted && rawGraph && rawGraph.nodes) {
          setStrataGraphData(computeStrataLayout(rawGraph));
        }
      })
      .catch((err) => {
        console.warn('Failed to load strata graph from API, using fallback:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeRepoId]);

  const selectedChunk =
    chunks.find((c) => c.id === selectedChunkId) ?? (chunks.length > 0 ? chunks[0] : null);

  // Reset active match index when query or active chunk changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchTerm, selectedChunk?.id, isFullFileMode]);

  // Fetch full file source when Full File toggle is active
  useEffect(() => {
    if (!isFullFileMode || !selectedChunk) {
      setFullFileContent(null);
      setIsLoadingFullFile(false);
      return;
    }
    let isMounted = true;
    setIsLoadingFullFile(true);
    apiClient
      .getRepoFileContent(activeRepoId || 'requests', selectedChunk.filePath)
      .then((resp) => {
        if (!isMounted) return;
        setFullFileContent(resp?.content ?? null);
      })
      .catch(() => {
        if (isMounted) setFullFileContent(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFullFile(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isFullFileMode, activeRepoId, selectedChunk?.filePath]);

  const handleNextMatch = () => {
    if (matchCount <= 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
  };

  const handlePrevMatch = () => {
    if (matchCount <= 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  };

  // Compute highlighted nodes for Strata map:
  // ONLY illuminate nodes the AI agent references in Electric Sky (#38bdf8),
  // keeping unreferenced nodes in calm slate baseline (#1e293b).
  const highlightedChunkIds = useMemo(() => {
    const set = new Set<string>();
    const targetIds = new Set<string>();
    const targetIdents = new Set<string>();

    if (citedChunks && citedChunks.length > 0) {
      citedChunks.forEach((id) => {
        targetIds.add(id);
        const ident = id.includes(':') ? id.split(':')[1] : id;
        targetIdents.add(ident);
      });
    } else if (chunks && chunks.length > 0) {
      chunks.forEach((c) => {
        targetIds.add(c.id);
        targetIdents.add(c.identifier);
      });
    }

    if (strataGraphData) {
      for (const node of strataGraphData.nodes) {
        if (targetIds.has(node.id) || targetIdents.has(node.identifier)) {
          set.add(node.id);
        }
      }
    }
    targetIds.forEach((id) => set.add(id));
    return set;
  }, [citedChunks, chunks, strataGraphData]);

  // Click on a node in Strata map: inspect details and sync selection
  const handleSelectStrataNode = (chunkId: string) => {
    setInspectedNodeId(chunkId);
    onSelectChunk(chunkId);
  };

  // P1: Dismiss floating strata node inspector on Escape key
  useEffect(() => {
    if (!inspectedNodeId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedNodeId]);

  const inspectedNode = useMemo(() => {
    if (!inspectedNodeId || !strataGraphData) return null;
    return (
      strataGraphData.nodes.find(
        (n) => n.id === inspectedNodeId || n.identifier === inspectedNodeId
      ) ?? null
    );
  }, [inspectedNodeId, strataGraphData]);

  const inspectedNodeCallees = useMemo(() => {
    if (!inspectedNode || !strataGraphData) return [];
    return strataGraphData.edges.filter(
      (e) => e.source === inspectedNode.id || e.source === inspectedNode.identifier
    );
  }, [inspectedNode, strataGraphData]);

  // Switch back to Code View from Strata node inspector and select the chunk
  const handleOpenInCodeViewer = async () => {
    if (!inspectedNode) return;
    handleToggleViewMode('code');
    onSelectChunk(inspectedNode.id);

    // If chunk not present in chunks array, attempt to hydrate or add it
    const localChunk = chunks.find(
      (c) => c.id === inspectedNode.id || c.identifier === inspectedNode.identifier
    );
    if (!localChunk && onAddChunk) {
      try {
        const fetched = await apiClient.getChunkById(inspectedNode.id);
        if (fetched) {
          onAddChunk(fetched);
          return;
        }
      } catch {
        // Fallback to lookupEntity
        try {
          const resp = await apiClient.lookupEntity(inspectedNode.identifier);
          if (resp?.chunks && resp.chunks.length > 0) {
            onAddChunk(resp.chunks[0]);
          }
        } catch {
          // ignore
        }
      }
    }
  };

  const handleSelectCall = async (callIdentifier: string): Promise<boolean | void> => {
    const prevId = selectedChunk?.id;
    if (onSelectCall) {
      const res = await onSelectCall(callIdentifier);
      if (res !== false && prevId) {
        setNavHistory((prev) => (prev[prev.length - 1] === prevId ? prev : [...prev.slice(-19), prevId]));
      }
      return res;
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
        if (prevId && prevId !== match.id) {
          setNavHistory((prev) => (prev[prev.length - 1] === prevId ? prev : [...prev.slice(-19), prevId]));
        }
        onSelectChunk(match.id);
        return true;
      }
      return false;
    }
  };

  // Compute upstream callers for the selected chunk from the repository strata call graph
  const selectedChunkCallers = useMemo(() => {
    if (!selectedChunk || !strataGraphData) return [];
    const nodeById = new Map(strataGraphData.nodes.map((n) => [n.id, n]));
    const targetIds = new Set<string>([selectedChunk.id]);
    for (const n of strataGraphData.nodes) {
      if (n.identifier === selectedChunk.identifier && n.filePath === selectedChunk.filePath) {
        targetIds.add(n.id);
      }
    }
    const seen = new Set<string>();
    const callers: Array<{ id: string; identifier: string; filePath?: string }> = [];
    for (const edge of strataGraphData.edges) {
      if (targetIds.has(edge.target) && !targetIds.has(edge.source) && !seen.has(edge.source)) {
        seen.add(edge.source);
        const srcNode = nodeById.get(edge.source);
        if (srcNode) {
          callers.push({
            id: srcNode.id,
            identifier: srcNode.identifier,
            filePath: srcNode.filePath,
          });
        }
      }
    }
    return callers;
  }, [selectedChunk, strataGraphData]);

  const handleSelectCaller = async (callerId: string, identifier: string) => {
    const prevId = selectedChunk?.id;
    if (prevId && prevId !== callerId) {
      setNavHistory((prev) => (prev[prev.length - 1] === prevId ? prev : [...prev.slice(-19), prevId]));
    }
    const local = chunks.find((c) => c.id === callerId || c.identifier === identifier);
    if (local) {
      onSelectChunk(local.id);
      return;
    }
    if (onAddChunk) {
      try {
        const fetched = await apiClient.getChunkById(callerId);
        if (fetched) {
          onAddChunk(fetched);
          return;
        }
      } catch {
        // fallback to lookupEntity
      }
      try {
        const resp = await apiClient.lookupEntity(identifier);
        if (resp?.chunks && resp.chunks.length > 0) {
          onAddChunk(resp.chunks[0]);
          return;
        }
      } catch {
        // ignore
      }
    }
    onSelectChunk(callerId);
  };

  const handleNavBack = () => {
    setNavHistory((prev) => {
      if (prev.length === 0) return prev;
      const targetId = prev[prev.length - 1];
      onSelectChunk(targetId);
      return prev.slice(0, -1);
    });
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
        onCloseAllChunks={onCloseAllChunks}
      />

      {/* Code Header with View Mode Toggle, Breadcrumbs, Search, Explorer Toggle and Actions */}
      <CodeViewerHeader
        chunk={selectedChunk}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isExplorerOpen={isExplorerOpen}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        matchCount={matchCount}
        currentMatchIndex={currentMatchIndex}
        onNextMatch={handleNextMatch}
        onPrevMatch={handlePrevMatch}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
        viewMode={activeViewMode}
        onToggleViewMode={handleToggleViewMode}
        isFullFileMode={isFullFileMode}
        onToggleFullFile={() => setIsFullFileMode((prev) => !prev)}
      />

      {/* Main Content Area (Explorer + Code Display OR 3D Strata Map) */}
      <div className="flex-1 flex overflow-hidden relative">
        {isExplorerOpen && activeViewMode === 'code' && (
          <RepoFileTree
            repoId={activeRepoId ?? null}
            activeChunkId={selectedChunk?.id ?? null}
            onSelectSymbol={handleSelectTreeSymbol}
            onClose={() => setIsExplorerOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {activeViewMode === 'strata' ? (
            /* 3D Strata Code Dependency Map View */
            <div className="relative w-full h-full overflow-hidden bg-[#070a12]">
              {/* Mandatory Static Lexical Call References label */}
              <div
                data-testid="strata-call-reference-label"
                className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700/80 text-sky-400 font-mono text-xs flex items-center gap-1.5 shadow-md backdrop-blur-xs select-none pointer-events-auto"
              >
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="font-semibold">Static Lexical Call References (Tree-sitter AST)</span>
              </div>

              {/* Three.js Instanced Strata Canvas */}
              <StrataCanvas
                graphData={strataGraphData}
                highlightedChunkIds={highlightedChunkIds}
                selectedChunkId={inspectedNodeId ?? selectedChunkId}
                onSelectNode={handleSelectStrataNode}
              />

              {/* Node Inspector Popup Overlay */}
              {inspectedNode && (
                <div
                  data-testid="strata-node-inspector"
                  role="region"
                  aria-label="Strata Node Details"
                  className="absolute top-12 right-3 z-20 w-84 max-w-[calc(100%-24px)] rounded-lg bg-slate-900/95 border border-sky-500/50 shadow-2xl p-3.5 text-xs font-mono text-slate-100 backdrop-blur-md select-text"
                >
                  {/* Header: Tier & Symbol Name */}
                  <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: inspectedNode.color || STRATA_TIER_COLORS[inspectedNode.tier],
                            color: '#070a12',
                          }}
                        >
                          Tier {inspectedNode.tier}: {inspectedNode.tierName}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-sky-400 truncate font-mono">
                        {inspectedNode.identifier}
                      </h3>
                    </div>
                    <button
                      type="button"
                      data-testid="close-strata-inspector-btn"
                      onClick={() => setInspectedNodeId(null)}
                      aria-label="Close inspector"
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                      title="Close Inspector"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Entity Details */}
                  <div className="space-y-1.5 mb-3 text-[11px] text-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">File:</span>
                      <span className="truncate max-w-[200px] text-right font-mono" title={inspectedNode.filePath}>
                        {inspectedNode.filePath}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Kind:</span>
                      <span className="text-teal-300 font-semibold font-mono">
                        {inspectedNode.astNodeType === 'FunctionDef'
                          ? 'Function'
                          : inspectedNode.astNodeType === 'ClassDef'
                          ? 'Class'
                          : inspectedNode.astNodeType}
                        <span className="text-[10px] text-slate-400 font-mono ml-1">({inspectedNode.astNodeType})</span>
                      </span>
                    </div>
                    {inspectedNode.startLine !== undefined && inspectedNode.endLine !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Scope:</span>
                        <span>
                          Lines {inspectedNode.startLine}–{inspectedNode.endLine}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Outgoing Call References */}
                  <div className="mb-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
                        Call References
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {inspectedNodeCallees.length} {inspectedNodeCallees.length === 1 ? 'called function' : 'called functions'}
                      </span>
                    </div>
                    {inspectedNodeCallees.length > 0 ? (
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {inspectedNodeCallees.map((edge) => (
                          <div
                            key={edge.id}
                            className="flex items-center justify-between p-1 rounded bg-slate-950 border border-slate-800 text-[10px]"
                          >
                            <span className="text-sky-300 truncate font-mono">
                              &rarr; {edge.callName || edge.target}
                            </span>
                            <span className="text-slate-400 text-[9px] shrink-0 ml-1">
                              T{edge.targetTier}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        No outgoing function calls detected
                      </div>
                    )}
                  </div>

                  {/* Open in Code Viewer Action */}
                  <button
                    type="button"
                    data-testid="open-in-code-viewer-btn"
                    onClick={handleOpenInCodeViewer}
                    className="w-full py-1.5 px-3 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors emil-press font-mono"
                  >
                    <span>📄 Open in Code Viewer</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Standard Code Display with Prism Highlighting */
            <>
              <CodeDisplay
                chunk={selectedChunk}
                onOpenConnectRepo={onOpenConnectRepo}
                searchTerm={searchTerm}
                onMatchCountChange={setMatchCount}
                currentMatchIndex={currentMatchIndex}
                hasActiveRepo={Boolean(activeRepoId)}
                onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
                isFullFileMode={isFullFileMode}
                fullFileContent={fullFileContent}
                isLoadingFullFile={isLoadingFullFile}
              />

              {/* Collapsible AST Metadata Drawer */}
              <ASTMetadataInspector
                chunk={selectedChunk}
                isOpen={isInspectorOpen}
                onClose={() => setIsInspectorOpen(false)}
                onSelectCall={handleSelectCall}
                callers={selectedChunkCallers}
                onSelectCaller={handleSelectCaller}
                canGoBack={navHistory.length > 0}
                onGoBack={handleNavBack}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const CodeViewerPane = CodeViewerContainer;
