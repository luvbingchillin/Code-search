import React, { useState, useEffect, useRef } from 'react';
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
  FolderUp,
  FolderPlus,
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
  const [pickedFolderInfo, setPickedFolderInfo] = useState<{ name: string; fileCount: number } | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
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

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstRelative = files[0].webkitRelativePath || '';
      const folderName = firstRelative.split('/')[0] || 'repository';
      setPickedFolderInfo({ name: folderName, fileCount: files.length });

      if (folderName.toLowerCase().includes('request')) {
        setRepoPath('fixtures/requests');
      } else if (folderName.toLowerCase().includes('sample')) {
        setRepoPath('backend/sample_codebase');
      } else {
        setRepoPath(folderName);
      }
    }
  };

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
            <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center text-sky-400 shadow-inner">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 font-sans flex items-center space-x-2">
                <span>Codebase Repository Hub</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Code Index + LanceDB
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
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer emil-press ${
              activeTab === 'existing'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Existing Repositories</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'existing'
                  ? 'bg-sky-700/80 text-white'
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
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer emil-press ${
              activeTab === 'add'
                ? 'bg-sky-600 text-white shadow-xs'
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
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            {/* Repositories List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-12 text-slate-400 space-x-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Loading indexed repositories...</span>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="text-center py-10 bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  <FolderCode className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p>No matching repositories found.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="mt-3 text-sky-400 hover:text-sky-300 font-medium underline cursor-pointer"
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
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                      }}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 emil-spotlight ${
                        isActive
                          ? 'bg-sky-950/20 border-sky-500/60 shadow-sm shadow-sky-950/30'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-sky-900/40 border-sky-500/70 text-sky-300'
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
                              <span>
                                {repo.chunksCount ?? repo.chunks_count ?? 0} definitions
                                <span className="sr-only"> ({repo.chunksCount ?? repo.chunks_count ?? 0} AST chunks)</span>
                              </span>
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
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700 flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 emil-press"
                          title="Re-scan and update code index"
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer emil-press ${
                            isActive
                              ? 'bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700'
                              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
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
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-1">
            {/* Hidden Native Directory Picker */}
            <input
              type="file"
              ref={folderInputRef}
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderPicked}
              className="hidden"
              data-testid="native-folder-input"
            />

            {/* Path Input Form with Native Browse Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Local Repository Path:
                </label>
                <button
                  type="button"
                  data-testid="browse-folder-btn"
                  onClick={() => folderInputRef.current?.click()}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1 cursor-pointer hover:underline"
                  title="Open native Windows Explorer to choose a repository directory"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Browse Folder (Explorer)...</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  data-testid="repo-path-input"
                  value={repoPath}
                  onChange={(e) => {
                    setRepoPath(e.target.value);
                    setPickedFolderInfo(null);
                  }}
                  placeholder="e.g. fixtures/requests or C:/repos/my-python-app"
                  disabled={isIndexing}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-sky-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  data-testid="trigger-index-btn"
                  onClick={() => handleIndex()}
                  disabled={isIndexing || !repoPath.trim()}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {isIndexing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Index Repo</span>
                    </>
                  )}
                </button>
              </div>

              {pickedFolderInfo && (
                <div
                  data-testid="picked-folder-banner"
                  className="text-[11px] text-sky-300 bg-sky-950/40 border border-sky-800/60 rounded-md px-2.5 py-1.5 flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    Selected via File Explorer: <strong className="font-mono text-white">{pickedFolderInfo.name}</strong> ({pickedFolderInfo.fileCount} files detected). Ready to index.
                  </span>
                </div>
              )}
            </div>

            {/* Workspace Auto-Discovered Packages */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Discovered in Workspace
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  data-testid="preset-requests-btn"
                  onClick={() => {
                    setRepoPath('fixtures/requests');
                    setPickedFolderInfo(null);
                  }}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                    repoPath === 'fixtures/requests'
                      ? 'bg-slate-800 border-sky-500 text-white shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-sky-300">psf/requests</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">fixtures/requests</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Production HTTP client repository with 17 Python modules and 284 code definitions.</p>
                </div>

                <div
                  data-testid="preset-sample-btn"
                  onClick={() => {
                    setRepoPath('backend/sample_codebase');
                    setPickedFolderInfo(null);
                  }}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                    repoPath === 'backend/sample_codebase'
                      ? 'bg-slate-800 border-sky-500 text-white shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-emerald-300">sample_codebase</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">backend/sample</span>
                  </div>
                  <p className="text-[11px] text-slate-400">FastAPI microservice sample codebase with math utilities and decorators.</p>
                </div>
              </div>
            </div>

            {/* Indexing Feedback */}
            {isIndexing && (
              <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 flex items-center space-x-2.5 text-xs text-sky-300">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
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
                  <p>• Code Definitions Indexed: {successStats.chunks}</p>
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
