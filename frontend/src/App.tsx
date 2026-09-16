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

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden select-none">
      {/* Top Application Header */}
      <Header
        webLLM={webLLM}
        nemoIR={nemoIR}
        agentStatus={agent.agentStatus}
      />

      {/* Main Resilient Split-Pane Interface */}
      <SplitPaneLayout
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
          />
        }
        rightPane={
          <CodeViewerPane
            chunks={agent.activeChunks}
            selectedChunkId={agent.selectedChunkId}
            onSelectChunk={agent.setSelectedChunkId}
          />
        }
      />
    </div>
  );
};

export default App;
