import React, { useState, useEffect, useRef } from 'react';
import { AgentStatus, AstCodeChunk, ChatMessage } from '../../types';
import { AgenticLoopBanner } from './AgenticLoopBanner';
import { AgentRunner, AgentExecutionStep, normalizeAgentState, NormalizedAgentState } from '../agent/AgentRunner';
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
  onClearChat,
}) => {
  const isBusy =
    status.state === 'Thinking' ||
    status.state === 'Searching AST' ||
    status.state === 'Synthesizing';

  const [isTracesExpanded, setIsTracesExpanded] = useState<boolean>(false);
  const prevNormStateRef = useRef<NormalizedAgentState>('idle');

  useEffect(() => {
    const norm = normalizeAgentState(status.state);
    const prev = prevNormStateRef.current;
    if (prev !== norm) {
      if (norm === 'thinking' || norm === 'searching' || norm === 'synthesizing') {
        setIsTracesExpanded(true);
      } else if (norm === 'complete' || norm === 'idle') {
        setIsTracesExpanded(false);
      }
      prevNormStateRef.current = norm;
    }
  }, [status.state]);

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
      <MessageList messages={messages} chunks={chunks} onSelectChunk={onSelectChunk} />

      {/* Suggested Quick Queries */}
      <QuerySuggestions
        onSelectSuggestion={onSubmit}
        disabled={isBusy}
        activeRepoId={activeRepoId}
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
