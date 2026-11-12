import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Square, Terminal, HelpCircle, Activity, Search, FolderCode } from 'lucide-react';
import { AgentStatus } from '../../types';

export interface ChatInputProps {
  status: AgentStatus;
  onSubmit: (query: string) => void;
  onCancel: () => void;
  activeRepoName?: string | null;
  hasActiveRepo?: boolean;
}

interface SlashCommandItem {
  cmd: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  directSubmit: boolean;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    cmd: '/help',
    label: '/help',
    desc: 'Display command reference and engine architecture guide',
    icon: <HelpCircle className="w-3.5 h-3.5 text-sky-400" />,
    directSubmit: true,
  },
  {
    cmd: '/status',
    label: '/status',
    desc: 'Inspect active repository, indexed functions & classes, and edge engine status',
    icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
    directSubmit: true,
  },
  {
    cmd: '/repo',
    label: '/repo',
    desc: 'Check current repository details and file tree path',
    icon: <FolderCode className="w-3.5 h-3.5 text-sky-400" />,
    directSubmit: true,
  },
  {
    cmd: '/ask ',
    label: '/ask <query>',
    desc: 'Query codebase and synthesize an answer',
    icon: <Search className="w-3.5 h-3.5 text-amber-400" />,
    directSubmit: false,
  },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  status,
  onSubmit,
  onCancel,
  activeRepoName,
  hasActiveRepo = false,
}) => {
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isBusy =
    status.state === 'Thinking' ||
    status.state === 'Searching AST' ||
    status.state === 'Synthesizing';

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const query = input.toLowerCase();
    return SLASH_COMMANDS.filter(
      (item) =>
        item.cmd.toLowerCase().startsWith(query) ||
        item.label.toLowerCase().startsWith(query) ||
        query === '/'
    );
  }, [input]);

  useEffect(() => {
    if (input.startsWith('/') && filteredCommands.length > 0) {
      setIsMenuOpen(true);
      setSelectedIndex(0);
    } else {
      setIsMenuOpen(false);
    }
  }, [input, filteredCommands.length]);

  const handleSubmit = (overrideQuery?: string) => {
    const targetQuery = (overrideQuery ?? input).trim();
    if (!targetQuery || isBusy) return;
    setIsMenuOpen(false);
    onSubmit(targetQuery);
    setInput('');
  };

  const handleSelectCommand = (item: SlashCommandItem) => {
    if (item.directSubmit) {
      handleSubmit(item.cmd);
    } else {
      setInput(item.cmd);
      setIsMenuOpen(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMenuOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          handleSelectCommand(selected);
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea based on input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const placeholderText =
    hasActiveRepo || activeRepoName
      ? `Ask a question about ${activeRepoName || 'active repository'} (or type /help, /status)...`
      : 'Connect a repository to search code, or type /help...';

  return (
    <form
      data-testid="chat-input-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="p-3 bg-slate-900 border-t border-slate-800 flex items-end space-x-2 relative"
    >
      {/* Interactive Slash Commands Popover Menu */}
      {isMenuOpen && filteredCommands.length > 0 && !isBusy && (
        <div
          data-testid="slash-commands-popover"
          className="absolute bottom-full left-3 right-3 mb-2 p-1.5 bg-slate-900/95 backdrop-blur border border-slate-700/90 rounded-lg shadow-2xl z-30 overflow-hidden"
        >
          <div className="px-2.5 py-1 text-[11px] font-mono text-slate-400 font-semibold border-b border-slate-800 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>COMMAND SUGGESTIONS</span>
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              ↑↓ navigate • ↵ select • esc close
            </span>
          </div>
          <div className="py-1 space-y-0.5">
            {filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const cleanCmdId = item.cmd.replace(/[^a-z]/g, '');
              return (
                <button
                  key={item.cmd}
                  type="button"
                  data-testid={`slash-cmd-${cleanCmdId}`}
                  onClick={() => handleSelectCommand(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-2.5 py-1.5 rounded-md text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-950/80 text-sky-200 border border-sky-700/60 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <span className="font-mono text-xs font-semibold text-sky-300">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 truncate max-w-[280px] pl-3">
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          data-testid="chat-input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          rows={1}
          className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 pr-14 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 resize-none leading-relaxed transition-colors"
          disabled={isBusy}
        />
        {!input && !isBusy && (
          <kbd
            data-testid="chat-focus-shortcut"
            className="hidden sm:inline-flex items-center absolute right-3 top-2.5 px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 rounded shadow-xs pointer-events-none select-none"
            title="Focus chat input"
          >
            {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K'}
          </kbd>
        )}
      </div>

      {isBusy ? (
        <button
          type="button"
          data-testid="chat-stop-btn"
          onClick={onCancel}
          className="h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 focus-visible:ring-2 focus-visible:ring-rose-400 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-xs focus:outline-none cursor-pointer"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      ) : (
        <button
          type="button"
          data-testid="chat-send-btn"
          onClick={() => handleSubmit()}
          className="h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sky-400 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-xs focus:outline-none cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>
      )}
    </form>
  );
};
