import React from 'react';
import { AgentStatus, AstCodeChunk, ChatMessage } from '../../types';
import { AgenticLoopBanner } from './AgenticLoopBanner';
import { MessageList } from './MessageList';
import { QuerySuggestions } from './QuerySuggestions';
import { ChatInput } from './ChatInput';

interface ChatPaneProps {
  status: AgentStatus;
  messages: ChatMessage[];
  chunks: AstCodeChunk[];
  onSelectChunk: (chunkId: string) => void;
  onSubmit: (query: string) => void;
  onCancel: () => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  status,
  messages,
  chunks,
  onSelectChunk,
  onSubmit,
  onCancel,
}) => {
  const isBusy =
    status.state === 'Thinking' ||
    status.state === 'Searching AST' ||
    status.state === 'Synthesizing';

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      {/* Top ReAct Agentic Loop Stepper & Status Banner */}
      <AgenticLoopBanner status={status} onCancel={onCancel} />

      {/* Scrollable Conversation Stream */}
      <MessageList messages={messages} chunks={chunks} onSelectChunk={onSelectChunk} />

      {/* Suggested Quick Queries */}
      <QuerySuggestions onSelectSuggestion={onSubmit} disabled={isBusy} />

      {/* Multi-line Chat Input with Auto-resize */}
      <ChatInput status={status} onSubmit={onSubmit} onCancel={onCancel} />
    </div>
  );
};
