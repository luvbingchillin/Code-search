import React, { useEffect, useRef } from 'react';
import { Bot, User, Code2, ChevronDown, Sparkles } from 'lucide-react';
import { AstCodeChunk, ChatMessage } from '../../types';

interface MessageListProps {
  messages: ChatMessage[];
  chunks: AstCodeChunk[];
  onSelectChunk: (chunkId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, chunks, onSelectChunk }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const getChunkById = (id: string): AstCodeChunk | undefined => {
    return chunks.find((c) => c.id === id);
  };

  return (
    <div
      data-testid="message-list"
      className="flex-1 overflow-y-auto p-4 space-y-4 text-sm"
    >
      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        return (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                isUser
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-gray-800 border border-gray-700 text-purple-400'
              }`}
            >
              {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                isUser
                  ? 'bg-purple-600 text-white rounded-tr-none'
                  : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-tl-none shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1 text-[11px] text-gray-400">
                <span className="font-semibold text-gray-300">
                  {isUser ? 'You' : 'CodeSeek Agent'}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Collapsible Thoughts Accordion if available */}
              {msg.thoughts && msg.thoughts.length > 0 && (
                <details
                  data-testid="thought-accordion"
                  className="mb-2 bg-gray-950/60 rounded-md border border-gray-800 text-xs p-2"
                >
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-200 font-mono text-[11px] flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>ReAct Reasoning Chain ({msg.thoughts.length} steps)</span>
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400 pl-1 text-[11px]">
                    {msg.thoughts.map((th, i) => (
                      <li key={i}>{th}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Message Content with Markdown-like Paragraphs */}
              <div className="whitespace-pre-wrap leading-relaxed space-y-1.5 font-sans">
                {msg.content}
              </div>

              {/* Clickable AST Citations Badges */}
              {msg.citedChunks && msg.citedChunks.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-800/80">
                  <div className="text-[11px] font-medium text-gray-400 mb-1.5 flex items-center space-x-1">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Cited AST Chunks:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.citedChunks.map((chunkId) => {
                      const chunk = getChunkById(chunkId);
                      const label = chunk
                        ? `${chunk.fileName}:${chunk.identifier}`
                        : chunkId;

                      return (
                        <button
                          key={chunkId}
                          data-testid={`chunk-citation-${chunkId}`}
                          onClick={() => onSelectChunk(chunkId)}
                          className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-mono transition-colors shadow-sm"
                          title="Click to view Python AST definition in viewer"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
