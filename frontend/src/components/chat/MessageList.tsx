import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Bot, User, Code2, ChevronDown, Sparkles, Copy, Check } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import { AstCodeChunk, ChatMessage } from '../../types';

interface MessageListProps {
  messages: ChatMessage[];
  chunks: AstCodeChunk[];
  onSelectChunk: (chunkId: string) => void;
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'python' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const highlightedHtml = useMemo(() => {
    try {
      const langKey = (language || 'python').toLowerCase();
      const grammar = Prism.languages[langKey] || Prism.languages.python;
      if (grammar) {
        return Prism.highlight(code, grammar, langKey);
      }
    } catch {
      // Fallback to unhighlighted pre/code
    }
    return null;
  }, [code, language]);

  return (
    <div className="my-2 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden text-xs shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/90 border-b border-gray-800/80 text-[11px] font-mono text-gray-400">
        <span className="font-semibold text-gray-300 uppercase tracking-wider">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-gray-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 cursor-pointer"
          title={copied ? 'Copied to clipboard' : 'Copy code snippet'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto font-mono leading-5">
        {highlightedHtml ? (
          <pre className="!bg-transparent !p-0 !m-0 font-mono">
            <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          </pre>
        ) : (
          <pre className="!bg-transparent !p-0 !m-0 font-mono whitespace-pre text-gray-200">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
};

function renderFormattedInlineText(text: string, isUser: boolean) {
  // Regex to match **bold** or `code`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong
          key={index}
          className={isUser ? 'font-bold text-white' : 'font-semibold text-gray-100'}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className={
            isUser
              ? 'bg-indigo-700/60 text-indigo-100 px-1 py-0.5 rounded font-mono text-[11px]'
              : 'bg-gray-800 text-indigo-300 border border-gray-700/60 px-1 py-0.5 rounded font-mono text-[11px]'
          }
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

const MarkdownMessageContent: React.FC<{ content: string; isUser: boolean }> = ({
  content,
  isUser,
}) => {
  // Split by fenced code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 leading-relaxed font-sans text-sm">
      {parts.map((part, partIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const rawLines = part.slice(3, -3).replace(/^\r?\n/, '').split('\n');
          const firstLine = rawLines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const language = hasLang ? firstLine : 'python';
          const code = hasLang ? rawLines.slice(1).join('\n') : rawLines.join('\n');
          return <CodeBlock key={partIdx} code={code} language={language} />;
        }

        const lines = part.split(/\r?\n/);
        return (
          <React.Fragment key={partIdx}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lineIdx} className="h-1" />;
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lineIdx} className="font-semibold text-gray-100 text-sm mt-2 mb-0.5">
                    {renderFormattedInlineText(trimmed.slice(4), isUser)}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lineIdx} className="font-bold text-gray-100 text-base mt-2.5 mb-1">
                    {renderFormattedInlineText(trimmed.slice(3), isUser)}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lineIdx} className="flex items-start space-x-2 pl-1 my-0.5">
                    <span className={isUser ? 'text-indigo-200 mt-1 select-none' : 'text-indigo-400 mt-1 select-none'}>
                      •
                    </span>
                    <span className="flex-1">{renderFormattedInlineText(trimmed.slice(2), isUser)}</span>
                  </div>
                );
              }
              return (
                <p key={lineIdx} className="leading-relaxed">
                  {renderFormattedInlineText(line, isUser)}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

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
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs shadow-xs ${
                isUser
                  ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                  : 'bg-gray-800 border border-gray-700 text-indigo-400'
              }`}
            >
              {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                isUser
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                  : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-tl-none shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-[11px] text-gray-400">
                <span className={`font-semibold ${isUser ? 'text-indigo-100' : 'text-gray-300'}`}>
                  {isUser ? 'You' : 'CodeSeek Agent'}
                </span>
                <span className={isUser ? 'text-indigo-200/80 text-[11px]' : 'text-gray-400 text-[11px]'}>
                  {msg.timestamp}
                </span>
              </div>

              {/* Collapsible Thoughts Accordion if available */}
              {msg.thoughts && msg.thoughts.length > 0 && (
                <details
                  data-testid="thought-accordion"
                  className="mb-2 bg-gray-950/70 rounded-md border border-gray-800 text-xs p-2"
                >
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-200 font-mono text-[11px] flex items-center justify-between select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded">
                    <span className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>ReAct Reasoning Chain ({msg.thoughts.length} steps)</span>
                    </span>
                    <ChevronDown className="w-3 h-3 text-gray-400 transition-transform duration-200" />
                  </summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400 pl-1 text-[11px]">
                    {msg.thoughts.map((th, i) => (
                      <li key={i}>{th}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Formatted Markdown Content */}
              <MarkdownMessageContent content={msg.content} isUser={isUser} />

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
                          type="button"
                          data-testid={`chunk-citation-${chunkId}`}
                          onClick={() => onSelectChunk(chunkId)}
                          className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-mono transition-colors shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
