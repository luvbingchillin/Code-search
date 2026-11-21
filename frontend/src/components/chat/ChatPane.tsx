import React, { useState } from 'react';
import { AgentStatus, AstCodeChunk, ChatMessage } from '../../types';
import { AgenticLoopBanner } from './AgenticLoopBanner';
import { AgentRunner, AgentExecutionStep } from '../agent/AgentRunner';
import { MessageList } from './MessageList';
import { QuerySuggestions } from './QuerySuggestions';
import { ChatInput } from './ChatInput';

export interface ChatPaneProps {
  status: AgentStatus;
  messages: ChatMessage[];
  chunks: AstCodeChunk[];
  onSelectChunk: (chunkId: string) => void;
  onSubmit: (query: string) => void;
  onCancel: () => void;
  streamingTokens?: string;
  steps?: AgentExecutionStep[];
  onReset?: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  activeRepoId?: string;
  activeRepoName?: string | null;
  activeRepoManifest?: string | null;
  onClearChat?: () => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  status,
  messages,
  chunks,
  onSelectChunk,
  onSubmit,
  onCancel,
  streamingTokens,
  steps,
  onReset,
  onMinimize,
  activeRepoId,
  activeRepoName,
  activeRepoManifest,
  onClearChat,
}) => {
  const isBusy =
    status.state === 'Thinking' ||
    status.state === 'Searching AST' ||
    status.state === 'Synthesizing';

  // Keep detailed execution trace drawer collapsed by default so MessageList never jumps ~180px on query submission.
  // Users can expand it on demand via the "Traces" toggle in AgenticLoopBanner.
  const [isTracesExpanded, setIsTracesExpanded] = useState<boolean>(false);

  const activeChunkCount = status.activeChunkCount ?? chunks.length;

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      {/* Top ReAct Agentic Loop Stepper & Status Banner */}
      <AgenticLoopBanner
        status={status}
        onCancel={onCancel}
        onMinimize={onMinimize}
        onClearChat={onClearChat}
        chunkCount={activeChunkCount}
        isTracesExpanded={isTracesExpanded}
        onToggleTraces={() => setIsTracesExpanded((prev) => !prev)}
      />

      {/* NemoIR ReAct AgentRunner Orchestrator */}
      <AgentRunner
        status={status}
        streamingTokens={streamingTokens}
        steps={steps}
        onCancel={onCancel}
        onReset={onReset}
        embedded={true}
        isExpanded={isTracesExpanded}
        onToggleExpanded={() => setIsTracesExpanded((prev) => !prev)}
      />

      {/* Scrollable Conversation Stream */}
      <MessageList
        messages={messages}
        chunks={chunks}
        onSelectChunk={onSelectChunk}
        streamingTokens={streamingTokens}
        isSynthesizing={status.state === 'Synthesizing'}
      />

      {/* Suggested Quick Queries */}
      <QuerySuggestions
        onSelectSuggestion={onSubmit}
        disabled={isBusy}
        activeRepoId={activeRepoId}
        activeRepoName={activeRepoName}
        activeRepoManifest={activeRepoManifest}
      />

      {/* Multi-line Chat Input with Auto-resize */}
      <ChatInput
        status={status}
        onSubmit={onSubmit}
        onCancel={onCancel}
        activeRepoName={activeRepoName}
        hasActiveRepo={Boolean(activeRepoId || activeRepoName)}
      />
    </div>
  );
};
