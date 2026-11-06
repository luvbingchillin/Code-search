import React, { useState, useEffect } from 'react';
import {
  FolderCode,
  FolderGit2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Plus,
  Search,
  Database,
  RefreshCw,
  Play,
  FileCode,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { RepositoryItem } from '../../types';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRepoId?: string | null;
  onSelectRepo?: (repo: RepositoryItem) => void;
  onIndexed?: (stats: { files: number; chunks: number; time: number; repoPath: string }) => void;
}

export const ConnectRepoModal: React.FC<ConnectRepoModalProps> = ({
  isOpen,
  onClose,
  activeRepoId,
  onSelectRepo,
  onIndexed,
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'add'>('existing');
  const [repos, setRepos] = useState<RepositoryItem[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Add / Index Form State
  const [repoPath, setRepoPath] = useState<string>('fixtures/requests');
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [indexingRepoId, setIndexingRepoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successStats, setSuccessStats] = useState<{
    files: number;
    chunks: number;
    time: number;
    repoName?: string;
  } | null>(null);

  // Load repositories on modal open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchRepos = async () => {
      setIsLoadingRepos(true);
      try {
        const list = await apiClient.getRepositories();
        if (mounted) {
          setRepos(list);
        }
      } catch {
        // Fallback handled in apiClient
      } finally {
        if (mounted) setIsLoadingRepos(false);
      }
    };

    fetchRepos();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleIndex = async (targetPath?: string) => {
    const pathToIndex = (targetPath || repoPath).trim();
    if (!pathToIndex) {
      setError('Please provide a repository directory path.');
      return;
    }

    setIsIndexing(true);
    setIndexingRepoId(targetPath || null);
    setError(null);
    setSuccessStats(null);

    try {
      const resp = await apiClient.indexRepository(pathToIndex);
      const stats = {
        files: resp.indexed_files,
        chunks: resp.extracted_chunks,
        time: resp.elapsed_seconds,
        repoPath: pathToIndex,
        repoName: pathToIndex.split(/[\\/]/).pop() || pathToIndex,
      };
      setSuccessStats(stats);

      // Refresh repos list
      const refreshed = await apiClient.getRepositories();
      setRepos(refreshed);

      if (onIndexed) {
        onIndexed(stats);
      }

      // Automatically select the newly indexed repository
      const matched = refreshed.find(
        (r) => r.path.toLowerCase() === pathToIndex.toLowerCase() || r.id === stats.repoName
      ) || {
        id: stats.repoName || 'indexed-repo',
        name: stats.repoName || pathToIndex,
        path: pathToIndex,
        chunksCount: stats.chunks,
        filesCount: stats.files,
        status: 'indexed',
      };

      if (onSelectRepo) {
        onSelectRepo(matched);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to index repository. Please verify the folder path.');
    } finally {
      setIsIndexing(false);
      setIndexingRepoId(null);
    }
  };

  const handleOpenRepo = (repo: RepositoryItem) => {
    if (onSelectRepo) {
      onSelectRepo(repo);
    }
    onClose();
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div
      data-testid="connect-repo-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-slate-100 flex flex-col space-y-4 max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-inner">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 font-sans flex items-center space-x-2">
                <span>Codebase Repository Hub</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  AST + LanceDB
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Open pre-indexed repositories or scan and index new Python codebases
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-connect-repo-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-2">
          <button
            type="button"
            data-testid="tab-existing-repos"
            onClick={() => {
              setActiveTab('existing');
              setError(null);
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'existing'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Existing Repositories</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'existing'
                  ? 'bg-indigo-700/80 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {repos.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-add-repo"
            onClick={() => {
              setActiveTab('add');
              setError(null);
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'add'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Repository</span>
          </button>
        </div>

        {/* Tab 1: Existing Repositories */}
        {activeTab === 'existing' && (
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden min-h-[300px]">
            {/* Search filter bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-testid="search-repos-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter repositories by name or path..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Repositories List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-12 text-slate-400 space-x-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading indexed repositories...</span>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="text-center py-10 bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  <FolderCode className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p>No matching repositories found.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="mt-3 text-indigo-400 hover:text-indigo-300 font-medium underline cursor-pointer"
                  >
                    Index a new repository now
                  </button>
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const isActive = activeRepoId === repo.id || activeRepoId === repo.path;
                  const isThisIndexing = isIndexing && indexingRepoId === repo.path;

                  return (
                    <div
                      key={repo.id}
                      data-testid={`repo-card-${repo.id}`}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-indigo-950/30 border-indigo-500/70 shadow-sm shadow-indigo-950/50'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-indigo-900/60 border-indigo-500/80 text-indigo-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <FolderCode className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-xs text-slate-100 truncate">
                              {repo.name}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-600/60">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                            {repo.path}
                          </p>
                          {repo.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center space-x-1">
                              <FileCode className="w-3 h-3 text-slate-400" />
                              <span>{repo.chunksCount ?? repo.chunks_count ?? 0} AST chunks</span>
                            </span>
                            {(repo.filesCount ?? repo.files_count) !== undefined && (
                              <span>• {repo.filesCount ?? repo.files_count} files</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          data-testid={`reindex-repo-btn-${repo.id}`}
                          onClick={() => handleIndex(repo.path)}
                          disabled={isIndexing}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700 flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          title="Re-scan and update AST index"
                        >
                          {isThisIndexing ? (
                            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          ) : (
                            <RefreshCw className="w-3 h-3 text-slate-400" />
                          )}
                          <span>Re-index</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`open-repo-btn-${repo.id}`}
                          onClick={() => handleOpenRepo(repo)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-slate-800 text-indigo-300 border border-indigo-700/50 hover:bg-slate-700'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isActive ? 'Currently Open' : 'Open & Query'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Add New Repository */}
        {activeTab === 'add' && (
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
            {/* Path Input Form */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Local Repository Path:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  data-testid="repo-path-input"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="e.g. fixtures/requests or C:/repos/my-python-app"
                  disabled={isIndexing}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  data-testid="trigger-index-btn"
                  onClick={() => handleIndex()}
                  disabled={isIndexing}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {isIndexing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Index Repo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400">Quick Test Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="preset-requests-btn"
                  onClick={() => setRepoPath('fixtures/requests')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-mono text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  fixtures/requests (284 chunks)
                </button>
                <button
                  type="button"
                  data-testid="preset-sample-btn"
                  onClick={() => setRepoPath('backend/sample_codebase')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  backend/sample_codebase (14 chunks)
                </button>
              </div>
            </div>

            {/* Indexing Feedback */}
            {isIndexing && (
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center space-x-2.5 text-xs text-indigo-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span>
                  Scanning directory, extracting complete function/class nodes via Tree-sitter, and persisting vectors into LanceDB...
                </span>
              </div>
            )}

            {/* Error Feedback */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center space-x-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Feedback */}
            {successStats && (
              <div
                data-testid="index-success-stats"
                className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex flex-col space-y-1 text-xs text-emerald-300"
              >
                <div className="flex items-center space-x-1.5 font-semibold text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Repository Successfully Indexed & Ready for Queries!</span>
                </div>
                <div className="text-[11px] text-emerald-300/90 pl-5.5 space-y-0.5 font-mono">
                  <p>• Repository: {successStats.repoName}</p>
                  <p>• Scanned Files: {successStats.files}</p>
                  <p>• AST Chunks Extracted: {successStats.chunks}</p>
                  <p>• Ingestion Latency: {successStats.time.toFixed(2)}s</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 flex justify-between items-center border-t border-slate-800 text-xs">
          <span className="text-[11px] text-slate-500 font-mono">
            {repos.length} repositories registered
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
