import React, { useState } from 'react';
import { FolderCode, Loader2, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIndexed?: (stats: { files: number; chunks: number; time: number; repoPath: string }) => void;
}

export const ConnectRepoModal: React.FC<ConnectRepoModalProps> = ({
  isOpen,
  onClose,
  onIndexed,
}) => {
  const [repoPath, setRepoPath] = useState<string>('fixtures/requests');
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successStats, setSuccessStats] = useState<{
    files: number;
    chunks: number;
    time: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleIndex = async () => {
    const trimmed = repoPath.trim();
    if (!trimmed) {
      setError('Please provide a repository directory path.');
      return;
    }

    setIsIndexing(true);
    setError(null);
    setSuccessStats(null);

    try {
      const resp = await apiClient.indexRepository(trimmed);
      const stats = {
        files: resp.indexed_files,
        chunks: resp.extracted_chunks,
        time: resp.elapsed_seconds,
        repoPath: trimmed,
      };
      setSuccessStats(stats);
      if (onIndexed) {
        onIndexed(stats);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to index repository. Please verify the folder path.');
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div
      data-testid="connect-repo-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none"
    >
      <div className="relative w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-slate-100 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <FolderCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-sans">
                Connect & Index Repository
              </h3>
              <p className="text-xs text-slate-400">
                Parse complete AST structures via Tree-sitter & LanceDB
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-connect-repo-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
              placeholder="e.g. fixtures/requests or C:/repos/my-project"
              disabled={isIndexing}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="button"
              data-testid="trigger-index-btn"
              onClick={handleIndex}
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
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="text-[11px]">Quick Presets:</span>
          <button
            type="button"
            data-testid="preset-requests-btn"
            onClick={() => setRepoPath('fixtures/requests')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-mono text-[11px] border border-slate-700 transition-colors cursor-pointer"
          >
            fixtures/requests (284 chunks)
          </button>
          <button
            type="button"
            data-testid="preset-sample-btn"
            onClick={() => setRepoPath('backend/sample_codebase')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-[11px] border border-slate-700 transition-colors cursor-pointer"
          >
            backend/sample_codebase
          </button>
        </div>

        {/* Indexing Feedback */}
        {isIndexing && (
          <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/60 flex items-center space-x-2.5 text-xs text-indigo-300">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
            <span>Scanning directory, extracting AST definitions via Tree-sitter, and persisting vectors into LanceDB...</span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-center space-x-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successStats && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex flex-col space-y-1 text-xs text-emerald-300">
            <div className="flex items-center space-x-1.5 font-semibold text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Repository Successfully Indexed!</span>
            </div>
            <div className="text-[11px] text-emerald-300/90 pl-5.5 space-y-0.5 font-mono">
              <p>• Scanned Files: {successStats.files}</p>
              <p>• AST Chunks Extracted: {successStats.chunks}</p>
              <p>• Indexing Latency: {successStats.time.toFixed(2)}s</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end space-x-2 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
