import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
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
  isWebLLMLoading?: boolean;
  webLLMProgress?: number;
  webLLMProgressText?: string;
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
  isWebLLMLoading = false,
  webLLMProgress = 0,
  webLLMProgressText,
}) => {
  const isBusy =
    status.state === 'Thinking' ||
    status.state === 'Searching AST' ||
    status.state === 'Synthesizing';

  // Keep detailed execution trace drawer collapsed by default so MessageList never jumps ~180px on query submission.
  // Users can expand it on demand via the "Traces" toggle in AgenticLoopBanner.
  const [isTracesExpanded, setIsTracesExpanded] = useState<boolean>(false);
  const [attemptedWhileLoading, setAttemptedWhileLoading] = useState<boolean>(false);

  React.useEffect(() => {
    if (!isWebLLMLoading) {
      setAttemptedWhileLoading(false);
    }
  }, [isWebLLMLoading]);

  const handleQuerySubmit = React.useCallback(
    (query: string) => {
      if (isWebLLMLoading) {
        setAttemptedWhileLoading(true);
      }
      onSubmit(query);
    },
    [isWebLLMLoading, onSubmit]
  );

  const activeChunkCount = status.activeChunkCount ?? chunks.length;
  const clampedPct = Math.min(100, Math.max(0, Math.round(webLLMProgress)));

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

      {/* WebLLM Loading Progress & Query Gate Banner */}
      {isWebLLMLoading && (
        <div
          data-testid="webllm-loading-banner"
          role="status"
          aria-live="polite"
          className={`px-3 py-2 border-t text-xs font-mono flex items-center justify-between gap-2 shrink-0 transition-colors ${
            attemptedWhileLoading
              ? 'bg-amber-950/90 border-amber-500 text-amber-200'
              : 'bg-slate-900/95 border-slate-800 text-sky-300'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            {attemptedWhileLoading ? (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-sky-400 shrink-0 animate-spin" />
            )}
            <span className="truncate">
              {attemptedWhileLoading
                ? `Hold on — Qwen2.5-Coder 1.5B is still loading (${clampedPct}%). Queries unlock automatically at 100%.`
                : webLLMProgressText || `Loading Qwen2.5-Coder 1.5B onto WebGPU (${clampedPct}%)...`}
            </span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-semibold shrink-0">
            {clampedPct}%
          </span>
        </div>
      )}

      {/* Suggested Quick Queries */}
      <QuerySuggestions
        onSelectSuggestion={handleQuerySubmit}
        disabled={isBusy}
        activeRepoId={activeRepoId}
        activeRepoName={activeRepoName}
        activeRepoManifest={activeRepoManifest}
      />

      {/* Multi-line Chat Input with Auto-resize */}
      <ChatInput
        status={status}
        onSubmit={handleQuerySubmit}
        onCancel={onCancel}
        activeRepoName={activeRepoName}
        hasActiveRepo={Boolean(activeRepoId || activeRepoName)}
      />
    </div>
  );
};
