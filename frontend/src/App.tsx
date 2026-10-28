import React from 'react';
import { useWebLLM } from './hooks/useWebLLM';
import { useNemoIR } from './hooks/useNemoIR';
import { useReActAgent } from './hooks/useReActAgent';
import { Header } from './components/layout/Header';
import { SplitPaneLayout } from './components/layout/SplitPaneLayout';
import { ChatPane } from './components/chat/ChatPane';
import { CodeViewerPane } from './components/viewer/CodeViewerPane';

export const App: React.FC = () => {
  const webLLM = useWebLLM();
  const nemoIR = useNemoIR();
  const agent = useReActAgent({ webLLM, nemoIR });

  const [isChatMinimized, setIsChatMinimized] = React.useState<boolean>(false);
  const [isCodeMinimized, setIsCodeMinimized] = React.useState<boolean>(false);

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
        isChatMinimized={isChatMinimized}
        onToggleChatMinimized={toggleChatMinimized}
        isCodeMinimized={isCodeMinimized}
        onToggleCodeMinimized={toggleCodeMinimized}
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
            onSelectChunk={agent.setSelectedChunkId}
            onSubmit={agent.submitQuery}
            onCancel={agent.cancelQuery}
            streamingTokens={agent.streamingTokens}
            onReset={agent.reset}
            isMinimized={isChatMinimized}
            onMinimize={toggleChatMinimized}
          />
        }
        rightPane={
          <CodeViewerPane
            chunks={agent.activeChunks}
            selectedChunkId={agent.selectedChunkId}
            onSelectChunk={agent.setSelectedChunkId}
            isMaximized={isChatMinimized && !isCodeMinimized}
            onToggleMaximize={toggleMaximizeCode}
            isMinimized={isCodeMinimized}
            onMinimize={toggleCodeMinimized}
          />
        }
      />
    </div>
  );
};

export default App;
