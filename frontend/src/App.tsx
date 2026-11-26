import React from 'react';
import { useWebLLM, PRECISION_MODEL } from './hooks/useWebLLM';
import { useNemoIR } from './hooks/useNemoIR';
import { useReActAgent } from './hooks/useReActAgent';
import { Header } from './components/layout/Header';
import { SplitPaneLayout } from './components/layout/SplitPaneLayout';
import { ChatPane } from './components/chat/ChatPane';
import { CodeViewerPane } from './components/viewer/CodeViewerPane';
import { ConnectRepoModal } from './components/repo/ConnectRepoModal';
import { RepositoryItem } from './types';
import { apiClient } from './services/apiClient';

export const LAST_REPO_STORAGE_KEY = 'codeseek_last_repo_id';

const isTestEnv =
  (typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
  (typeof window !== 'undefined' && Boolean((window as any).__VITEST_ENVIRONMENT__));

export interface AppProps {
  autoConnectLastRepo?: boolean;
  autoInitWebLLM?: boolean;
}

export const App: React.FC<AppProps> = ({
  autoConnectLastRepo = !isTestEnv,
  autoInitWebLLM = false,
}) => {
  const [activeRepo, setActiveRepo] = React.useState<RepositoryItem | null>(null);
  const [healthRefreshTrigger, setHealthRefreshTrigger] = React.useState<number>(0);
  const [isBackendOffline, setIsBackendOffline] = React.useState<boolean>(false);
  const [copiedBackendCmd, setCopiedBackendCmd] = React.useState<boolean>(false);
  const [strataFocusRequest, setStrataFocusRequest] = React.useState<{ chunkId: string; nonce: number } | null>(null);
  const webLLM = useWebLLM({ initialModel: PRECISION_MODEL, autoInit: autoInitWebLLM });

  React.useEffect(() => {
    apiClient.setActiveRepoId(activeRepo?.id ?? null);
  }, [activeRepo?.id]);

  const handleBackendHealthChange = React.useCallback((healthy: boolean) => {
    setIsBackendOffline(!healthy);
  }, []);
  const nemoIR = useNemoIR();
  const connectRepoByIdRef = React.useRef<((repoId: string) => Promise<void>) | undefined>(undefined);
  const agent = useReActAgent({
    webLLM,
    nemoIR,
    activeRepoPath: activeRepo?.path,
    activeRepo,
    onConnectRepo: (repoId: string) => connectRepoByIdRef.current?.(repoId),
  });

  const [isChatMinimized, setIsChatMinimized] = React.useState<boolean>(false);
  const [isCodeMinimized, setIsCodeMinimized] = React.useState<boolean>(false);
  const [isConnectRepoOpen, setIsConnectRepoOpen] = React.useState<boolean>(false);

  const handleOpenConnectRepo = React.useCallback(() => {
    setIsConnectRepoOpen(true);
  }, []);

  const handleCloseConnectRepo = React.useCallback(() => {
    setIsConnectRepoOpen(false);
  }, []);

  const handleSelectRepo = React.useCallback(
    async (repo: RepositoryItem) => {
      setActiveRepo(repo);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LAST_REPO_STORAGE_KEY, repo.id);
        }
      } catch {
        // Ignore storage restrictions
      }
      setHealthRefreshTrigger((prev) => prev + 1);
      try {
        const chunks = await apiClient.getRepoChunks(repo.id, 3);
        let loadedChunks = chunks;
        if (chunks && chunks.length > 0) {
          if (agent.setActiveChunks) {
            agent.setActiveChunks(chunks);
          }
        } else {
          try {
            const fallback = await nemoIR.searchAstChunks('def ', { filePath: repo.path });
            if (fallback && fallback.length > 0 && agent.setActiveChunks) {
              agent.setActiveChunks(fallback);
              loadedChunks = fallback;
            }
          } catch (fallbackErr) {
            console.warn('Initial AST chunk search fallback encountered error:', fallbackErr);
          }
        }

        if (agent.addMessage) {
          const count = loadedChunks?.length ?? 0;
          agent.addMessage({
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: `### Connected Repository: **${repo.name}**\n\nActive codebase connected (${count} initial definitions loaded in viewer). You can now ask questions about this codebase or browse functions and classes using the Explorer.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      } catch (err) {
        console.error('Failed to load repo chunks:', err);
      }
    },
    [agent, nemoIR]
  );

  // Allow connecting a repository by ID (used by suggestion chips & auto-restore on mount)
  const handleConnectRepoById = React.useCallback(
    async (repoId: string) => {
      const repos = await apiClient.getRepositories();
      const target =
        repos.find(
          (r) =>
            r.id.toLowerCase() === repoId.toLowerCase() ||
            r.name.toLowerCase() === repoId.toLowerCase()
        ) || repos[0];
      if (target) {
        await handleSelectRepo(target);
      }
    },
    [handleSelectRepo]
  );
  connectRepoByIdRef.current = handleConnectRepoById;

  // Auto-connect to the last connected repository stored in localStorage (or default to first indexed repo in browser)
  const hasAutoConnectedRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (!autoConnectLastRepo || hasAutoConnectedRef.current) return;
    let savedRepoId: string | null = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        savedRepoId = window.localStorage.getItem(LAST_REPO_STORAGE_KEY);
      }
    } catch {
      // Ignore storage restrictions
    }

    hasAutoConnectedRef.current = true;
    handleConnectRepoById(savedRepoId || 'requests').catch(() => {
      // Backend may be offline on initial load; user can connect manually once started
    });
  }, [autoConnectLastRepo, handleConnectRepoById]);

  const triggerStrataFocus = React.useCallback((chunkId: string) => {
    setStrataFocusRequest((prev) => ({
      chunkId,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  const handleSelectChunk = React.useCallback(
    async (chunkId: string) => {
      // 1. Direct match in activeChunks
      const directMatch = agent.activeChunks.find((c) => c.id === chunkId);
      if (directMatch) {
        agent.setSelectedChunkId(chunkId);
        triggerStrataFocus(chunkId);
        return;
      }

      // 2. Hydrate from backend if it's a historical citation or external identifier
      try {
        const chunk = await apiClient.getChunkById(chunkId);
        if (chunk) {
          if (agent.setActiveChunks) {
            agent.setActiveChunks([...agent.activeChunks, chunk]);
          }
          agent.setSelectedChunkId(chunk.id);
          triggerStrataFocus(chunk.id);
          return;
        }
      } catch {
        const parts = chunkId.split(':');
        const ident = parts.length > 1 ? parts[1] : chunkId;
        try {
          const resp = await apiClient.lookupEntity(ident);
          if (resp?.chunks && resp.chunks.length > 0) {
            const newChunk = resp.chunks[0];
            if (agent.setActiveChunks && !agent.activeChunks.some((c) => c.id === newChunk.id)) {
              agent.setActiveChunks([...agent.activeChunks, newChunk]);
            }
            agent.setSelectedChunkId(newChunk.id);
            triggerStrataFocus(newChunk.id);
            return;
          }
        } catch {
          // ignore
        }
      }

      // Fallback
      agent.setSelectedChunkId(chunkId);
      triggerStrataFocus(chunkId);
    },
    [agent, triggerStrataFocus]
  );

  const toggleChatMinimized = React.useCallback(() => {
    setIsChatMinimized((prev) => !prev);
  }, []);

  const toggleCodeMinimized = React.useCallback(() => {
    setIsCodeMinimized((prev) => !prev);
  }, []);

  const toggleMaximizeCode = React.useCallback(() => {
    setIsChatMinimized((prev) => {
      // If chat is currently open, minimize chat to maximize code viewer.
      // If chat is already minimized, restore chat.
      return !prev;
    });
    setIsCodeMinimized(false);
  }, []);

  const handleSelectCall = React.useCallback(
    async (callIdentifier: string): Promise<boolean> => {
      const cleanName = callIdentifier.replace(/^self\./, '');
      const currentChunk = agent.activeChunks.find((c) => c.id === agent.selectedChunkId);
      const currentClassPrefix = currentChunk?.identifier.includes('.')
        ? currentChunk.identifier.split('.')[0]
        : null;

      // Step 1: Check if callee is already present in agent.activeChunks (prefer same class/file)
      const localCandidates = agent.activeChunks.filter(
        (c) =>
          c.identifier === callIdentifier ||
          c.identifier === cleanName ||
          c.identifier.endsWith(`.${cleanName}`) ||
          cleanName.endsWith(`.${c.identifier}`) ||
          (callIdentifier.startsWith('self.') && c.identifier.endsWith(`.${cleanName}`))
      );

      const localMatch =
        localCandidates.find((c) => currentClassPrefix && c.identifier === `${currentClassPrefix}.${cleanName}`) ||
        localCandidates.find((c) => currentChunk && c.filePath === currentChunk.filePath) ||
        localCandidates[0];

      if (localMatch) {
        agent.setSelectedChunkId(localMatch.id);
        return true;
      }

      // Step 2: If not in active chunks, invoke apiClient.lookupEntity(cleanName)
      try {
        const resp = await apiClient.lookupEntity(cleanName);
        if (resp && resp.chunks && resp.chunks.length > 0) {
          const preferred =
            resp.chunks.find((c) => currentClassPrefix && c.identifier === `${currentClassPrefix}.${cleanName}`) ||
            resp.chunks.find((c) => currentChunk && c.filePath === currentChunk.filePath) ||
            resp.chunks[0];
          const newChunks = resp.chunks.filter(
            (rc) => !agent.activeChunks.some((c) => c.id === rc.id)
          );
          if (agent.setActiveChunks && newChunks.length > 0) {
            agent.setActiveChunks([...agent.activeChunks, ...newChunks]);
          }
          agent.setSelectedChunkId(preferred.id);
          return true;
        }
      } catch (err) {
        console.warn(`Entity lookup failed for ${callIdentifier}:`, err);
      }
      return false;
    },
    [agent]
  );

  const handleCloseChunk = React.useCallback(
    (chunkIdToClose: string) => {
      const remaining = agent.activeChunks.filter((c) => c.id !== chunkIdToClose);
      if (agent.setActiveChunks) {
        agent.setActiveChunks(remaining);
      }
      if (agent.selectedChunkId === chunkIdToClose) {
        if (remaining.length > 0) {
          agent.setSelectedChunkId(remaining[0].id);
        }
      }
    },
    [agent]
  );

  const handleCloseAllChunks = React.useCallback(() => {
    if (agent.setActiveChunks) {
      agent.setActiveChunks([]);
    }
  }, [agent]);

  const handleAddChunk = React.useCallback(
    (newChunk: any) => {
      if (!agent.activeChunks.some((c) => c.id === newChunk.id)) {
        if (agent.setActiveChunks) {
          agent.setActiveChunks([...agent.activeChunks, newChunk]);
        }
      }
      agent.setSelectedChunkId(newChunk.id);
    },
    [agent]
  );

  // Scope 3D Strata highlights to the most recent assistant message with citations
  // so earlier queries don't permanently highlight unrelated nodes across the architecture.
  const citedChunkIds = React.useMemo(() => {
    for (let i = agent.messages.length - 1; i >= 0; i--) {
      const msg = agent.messages[i];
      if (msg.role === 'assistant' && msg.citedChunks && msg.citedChunks.length > 0) {
        return [...msg.citedChunks];
      }
    }
    return [];
  }, [agent.messages]);

  // Keyboard shortcut listener for developer efficiency (Cmd+K, Ctrl+B, etc.)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.metaKey || e.ctrlKey;

      if (isCtrlOrMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isChatMinimized) setIsChatMinimized(false);
        setTimeout(() => {
          const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
          textarea?.focus();
        }, 50);
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleChatMinimized();
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleCodeMinimized();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (isChatMinimized) setIsChatMinimized(false);
        setTimeout(() => {
          const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
          textarea?.focus();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatMinimized, toggleChatMinimized, toggleCodeMinimized]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-text">
      {/* Top Application Header with Layout Controls */}
      <Header
        webLLM={webLLM}
        nemoIR={nemoIR}
        agentStatus={agent.agentStatus}
        activeRepo={activeRepo}
        healthRefreshTrigger={healthRefreshTrigger}
        onBackendHealthChange={handleBackendHealthChange}
        isChatMinimized={isChatMinimized}
        onToggleChatMinimized={toggleChatMinimized}
        isCodeMinimized={isCodeMinimized}
        onToggleCodeMinimized={toggleCodeMinimized}
        onOpenConnectRepo={handleOpenConnectRepo}
      />

      {/* Actionable Prompt when Local FastAPI Backend is Not Running */}
      {isBackendOffline && (
        <div
          data-testid="backend-offline-banner"
          role="alert"
          className="px-4 py-2 bg-amber-950/60 border-b border-amber-700/70 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0"
        >
          <div className="flex flex-wrap items-center gap-2 text-amber-100">
            <span className="font-semibold text-amber-300">Local Backend Required:</span>
            <span>Start the FastAPI server on port 8000 to index &amp; search repositories:</span>
            <code className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-300 select-all">
              uvicorn app.main:app --app-dir backend --port 8000
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText('uvicorn app.main:app --app-dir backend --port 8000');
                  setCopiedBackendCmd(true);
                  setTimeout(() => setCopiedBackendCmd(false), 2000);
                } catch {
                  // Ignore clipboard restrictions
                }
              }}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] cursor-pointer transition-colors"
            >
              {copiedBackendCmd ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            data-testid="retry-backend-btn"
            onClick={() => setHealthRefreshTrigger((t) => t + 1)}
            className="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white font-medium text-xs cursor-pointer transition-colors shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Resilient Split-Pane Interface */}
      <SplitPaneLayout
        isChatMinimized={isChatMinimized}
        onToggleChatMinimized={toggleChatMinimized}
        isCodeMinimized={isCodeMinimized}
        onToggleCodeMinimized={toggleCodeMinimized}
        leftPane={
          <ChatPane
            status={agent.agentStatus}
            messages={agent.messages}
            chunks={agent.activeChunks}
            onSelectChunk={handleSelectChunk}
            onSubmit={agent.submitQuery}
            onCancel={agent.cancelQuery}
            streamingTokens={agent.streamingTokens}
            onReset={agent.reset}
            isMinimized={isChatMinimized}
            onMinimize={toggleChatMinimized}
            activeRepoId={activeRepo?.id}
            activeRepoName={activeRepo?.name}
            activeRepoManifest={activeRepo?.manifest}
            onClearChat={agent.clearMessages}
            isWebLLMLoading={webLLM.status === 'loading'}
            webLLMProgress={webLLM.progress}
            webLLMProgressText={webLLM.progressText}
          />
        }
        rightPane={
          <CodeViewerPane
            chunks={agent.activeChunks}
            selectedChunkId={agent.selectedChunkId}
            onSelectChunk={agent.setSelectedChunkId}
            onSelectCall={handleSelectCall}
            isMaximized={isChatMinimized && !isCodeMinimized}
            onToggleMaximize={toggleMaximizeCode}
            isMinimized={isCodeMinimized}
            onMinimize={toggleCodeMinimized}
            onOpenConnectRepo={handleOpenConnectRepo}
            onCloseChunk={handleCloseChunk}
            onCloseAllChunks={handleCloseAllChunks}
            activeRepoId={activeRepo?.id}
            onAddChunk={handleAddChunk}
            citedChunks={citedChunkIds}
            focusRequest={strataFocusRequest}
          />
        }
      />

      {/* Codebase Repository Hub Modal */}
      <ConnectRepoModal
        isOpen={isConnectRepoOpen}
        onClose={handleCloseConnectRepo}
        activeRepoId={activeRepo?.id}
        onSelectRepo={handleSelectRepo}
        onIndexed={async (stats) => {
          setHealthRefreshTrigger((prev) => prev + 1);
          try {
            const initialFound = await nemoIR.searchAstChunks('def ', { filePath: stats.repoPath });
            if (initialFound && initialFound.length > 0 && agent.setActiveChunks) {
              agent.setActiveChunks(initialFound);
            }
          } catch {
            // ignore
          }
        }}
      />
    </div>
  );
};

export default App;
