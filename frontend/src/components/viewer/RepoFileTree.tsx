import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderTree,
  FileCode,
  Layers,
  Code2,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { FileSymbolNode, FileTreeNode, RepositoryTreeResponse } from '../../types';

interface RepoFileTreeProps {
  repoId: string | null;
  activeChunkId: string | null;
  onSelectSymbol: (symbol: FileSymbolNode, filePath: string) => void;
  onClose?: () => void;
}

export const RepoFileTree: React.FC<RepoFileTreeProps> = ({
  repoId,
  activeChunkId,
  onSelectSymbol,
  onClose,
}) => {
  const [treeData, setTreeData] = useState<RepositoryTreeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!repoId) {
      setTreeData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    apiClient
      .getRepoTree(repoId)
      .then((data) => {
        if (!isMounted) return;
        setTreeData(data);
        if (data && data.tree.length > 0) {
          // Expand first 3 files by default
          const initialExpanded: Record<string, boolean> = {};
          data.tree.slice(0, 3).forEach((node) => {
            initialExpanded[node.filePath] = true;
          });
          setExpandedFiles(initialExpanded);
        }
      })
      .catch((err) => {
        console.error('Failed to load repo tree:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoId]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  const filteredTree = useMemo(() => {
    if (!treeData) return [];
    const query = filterQuery.trim().toLowerCase();
    if (!query) return treeData.tree;

    return treeData.tree
      .map((file) => {
        const matchesFileName = file.fileName.toLowerCase().includes(query);
        const matchedSymbols = file.symbols.filter(
          (s) =>
            s.identifier.toLowerCase().includes(query) ||
            s.astNodeType.toLowerCase().includes(query)
        );

        if (matchesFileName || matchedSymbols.length > 0) {
          return {
            ...file,
            symbols: matchesFileName ? file.symbols : matchedSymbols,
          };
        }
        return null;
      })
      .filter((f): f is FileTreeNode => f !== null);
  }, [treeData, filterQuery]);

  // If filtering, automatically expand matching files
  useEffect(() => {
    if (filterQuery.trim()) {
      const allExpanded: Record<string, boolean> = {};
      filteredTree.forEach((f) => {
        allExpanded[f.filePath] = true;
      });
      setExpandedFiles(allExpanded);
    }
  }, [filterQuery, filteredTree]);

  return (
    <aside
      data-testid="repo-file-tree"
      className="w-64 border-r border-slate-800 bg-[#090d16] flex flex-col shrink-0 select-none overflow-hidden h-full text-xs font-mono"
    >
      {/* Explorer Header */}
      <div className="h-10 px-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold font-sans">
          <FolderTree className="w-4 h-4 text-sky-400" />
          <span>Explorer</span>
          {treeData && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {treeData.total_files} files
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            data-testid="close-explorer-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
            title="Close Explorer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter / Search Input */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
          <input
            type="text"
            data-testid="file-tree-filter-input"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files & symbols..."
            className="w-full bg-slate-900 border border-slate-800 rounded pl-7 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>Scanning repository symbols...</span>
          </div>
        ) : !repoId ? (
          <div className="p-4 text-center text-slate-500 font-sans">
            <FolderOpen className="w-6 h-6 mx-auto mb-2 opacity-50 text-sky-400" />
            <p className="text-[11px]">Connect a repository to browse source files & code symbols.</p>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-4 text-center text-slate-500 font-sans">
            <p className="text-[11px]">No matching files or symbols found.</p>
          </div>
        ) : (
          filteredTree.map((fileNode) => {
            const isExpanded = Boolean(expandedFiles[fileNode.filePath]);

            return (
              <div key={fileNode.filePath} className="space-y-0.5" data-testid={`tree-file-${fileNode.fileName}`}>
                {/* File Row */}
                <div
                  onClick={() => toggleFile(fileNode.filePath)}
                  className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-800/70 text-slate-300 hover:text-white cursor-pointer group transition-colors"
                  title={fileNode.filePath}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                    )}
                    <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium">{fileNode.fileName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-sans">
                    {fileNode.symbolsCount}
                  </span>
                </div>

                {/* Nested Symbols */}
                {isExpanded && (
                  <div className="pl-4 space-y-0.5 border-l border-slate-800/80 ml-3">
                    {fileNode.symbols.map((symbol) => {
                      const isSymbolActive = symbol.id === activeChunkId;
                      const isClass = symbol.astNodeType.toLowerCase().includes('class');

                      return (
                        <div
                          key={symbol.id}
                          data-testid={`tree-symbol-${symbol.identifier}`}
                          onClick={() => onSelectSymbol(symbol, fileNode.filePath)}
                          className={`flex items-center justify-between px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            isSymbolActive
                              ? 'bg-sky-950/70 border border-sky-600/60 text-sky-200 font-semibold'
                              : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                          }`}
                          title={`${symbol.identifier} (${isClass ? 'Class' : 'Function'}, Lines ${symbol.startLine}-${symbol.endLine})`}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            {isClass ? (
                              <Layers className="w-3 h-3 text-sky-400 shrink-0" />
                            ) : (
                              <Code2 className="w-3 h-3 text-teal-400 shrink-0" />
                            )}
                            <span className="truncate">{symbol.identifier}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono shrink-0 ml-1">
                            L{symbol.startLine}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
