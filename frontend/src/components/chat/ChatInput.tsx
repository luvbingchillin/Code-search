import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { AgentStatus } from '../../types';

interface ChatInputProps {
  status: AgentStatus;
  onSubmit: (query: string) => void;
  onCancel: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ status, onSubmit, onCancel }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isBusy =
    status.state === 'Thinking' ||
    status.state === 'Searching AST' ||
    status.state === 'Synthesizing';

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isBusy) return;
    onSubmit(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  return (
    <form
      data-testid="chat-input-form"
      onSubmit={handleSubmit}
      className="p-3 bg-gray-900 border-t border-gray-800 flex items-end space-x-2"
    >
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          data-testid="chat-input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about the Python codebase..."
          rows={1}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none leading-relaxed"
          disabled={isBusy}
        />
      </div>

      {isBusy ? (
        <button
          type="button"
          data-testid="chat-stop-btn"
          onClick={onCancel}
          className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      ) : (
        <button
          type="button"
          data-testid="chat-send-btn"
          onClick={handleSubmit}
          className="h-9 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>
      )}
    </form>
  );
};
