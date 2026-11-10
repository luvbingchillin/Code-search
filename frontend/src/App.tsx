import React from 'react';
import { useWebLLM } from './hooks/useWebLLM';
import { useNemoIR } from './hooks/useNemoIR';
import { useReActAgent } from './hooks/useReActAgent';
import { Header } from './components/layout/Header';
import { SplitPaneLayout } from './components/layout/SplitPaneLayout';
import { ChatPane } from './components/chat/ChatPane';
import { CodeViewerPane } from './components/viewer/CodeViewerPane';
import { ConnectRepoModal } from './components/repo/ConnectRepoModal';
import { RepositoryItem } from './types';
import { apiClient } from './services/apiClient';

export const App: React.FC = () => {
  const [activeRepo, setActiveRepo] = React.useState<RepositoryItem | null>(null);
  const [healthRefreshTrigger, setHealthRefreshTrigger] = React.useState<number>(0);
  const webLLM = useWebLLM();
  const nemoIR = useNemoIR();
  const agent = useReActAgent({
    webLLM,
    nemoIR,
    activeRepoPath: activeRepo?.path,
    activeRepo,
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
      setHealthRefreshTrigger((prev) => prev + 1);
      try {
        const chunks = await apiClient.getRepoChunks(repo.id, 10);
        let loadedChunks = chunks;
        if (chunks && chunks.length > 0) {
          if (agent.setActiveChunks) {
            agent.setActiveChunks(chunks);
          }
        } else {
          const fallback = await nemoIR.searchAstChunks('def ', { filePath: repo.path });
          if (fallback && fallback.length > 0 && agent.setActiveChunks) {
            agent.setActiveChunks(fallback);
            loadedChunks = fallback;
          }
        }

        if (agent.addMessage) {
          const count = loadedChunks?.length ?? 0;
          agent.addMessage({
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: `### 🔄 Connected Repository: **${repo.name}**\n\nActive AST context updated (${count} initial nodes loaded in viewer). You can now ask questions about this codebase or browse functions and classes using the Explorer.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      } catch (err) {
        console.error('Failed to load repo chunks:', err);
      }
    },
    [agent, nemoIR]
  );

  const handleSelectChunk = React.useCallback(
    async (chunkId: string) => {
      // 1. Direct match in activeChunks
      const directMatch = agent.activeChunks.find((c) => c.id === chunkId);
      if (directMatch) {
        agent.setSelectedChunkId(chunkId);
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
            return;
          }
        } catch {
          // ignore
        }
      }

      // Fallback
      agent.setSelectedChunkId(chunkId);
    },
    [agent]
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
    async (callIdentifier: string) => {
      const cleanName = callIdentifier.replace(/^self\./, '');

      // Step 1: Check if callee is already present in agent.activeChunks
      const localMatch = agent.activeChunks.find(
        (c) =>
          c.identifier === callIdentifier ||
          c.identifier === cleanName ||
          c.identifier.endsWith(`.${cleanName}`) ||
          cleanName.endsWith(`.${c.identifier}`) ||
          (callIdentifier.startsWith('self.') && c.identifier.endsWith(cleanName))
      );

      if (localMatch) {
        agent.setSelectedChunkId(localMatch.id);
        return;
      }

      // Step 2: If not in active chunks, invoke apiClient.lookupEntity(cleanName)
      try {
        const resp = await apiClient.lookupEntity(cleanName);
        if (resp && resp.chunks && resp.chunks.length > 0) {
          const newChunks = resp.chunks.filter(
            (rc) => !agent.activeChunks.some((c) => c.id === rc.id)
          );
          if (agent.setActiveChunks && newChunks.length > 0) {
            agent.setActiveChunks([...agent.activeChunks, ...newChunks]);
          }
          agent.setSelectedChunkId(resp.chunks[0].id);
        }
      } catch (err) {
        console.warn(`Entity lookup failed for ${callIdentifier}:`, err);
      }
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
        isChatMinimized={isChatMinimized}
        onToggleChatMinimized={toggleChatMinimized}
        isCodeMinimized={isCodeMinimized}
        onToggleCodeMinimized={toggleCodeMinimized}
        onOpenConnectRepo={handleOpenConnectRepo}
      />

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
            onClearChat={agent.clearMessages}
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
            activeRepoId={activeRepo?.id}
            onAddChunk={handleAddChunk}
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
