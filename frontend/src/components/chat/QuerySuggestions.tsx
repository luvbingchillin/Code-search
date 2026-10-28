import React from 'react';
import { Lightbulb } from 'lucide-react';

interface QuerySuggestionsProps {
  onSelectSuggestion: (query: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'How does FastAPI solve dependency injection trees?',
  'Show WebSocketEndpoint protocol handshake and connect handlers',
  'Explain RecursiveCharacterTextSplitter language separators',
  'Find JWT token validation and expiration checks',
];

export const QuerySuggestions: React.FC<QuerySuggestionsProps> = ({
  onSelectSuggestion,
  disabled,
}) => {
  return (
    <div
      data-testid="query-suggestions"
      className="px-3 py-1.5 border-t border-slate-800 bg-slate-950/90 flex items-center space-x-2 shrink-0 select-none overflow-x-auto no-scrollbar"
    >
      <div className="flex items-center space-x-1 text-xs text-slate-400 shrink-0">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-medium text-slate-300 hidden sm:inline">Suggested:</span>
      </div>
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
        {SUGGESTIONS.map((text, i) => (
          <button
            key={i}
            type="button"
            data-testid="query-suggestion-chip"
            disabled={disabled}
            onClick={() => onSelectSuggestion(text)}
            className="text-xs px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/60 text-slate-200 hover:text-white transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-400 focus:outline-none active:scale-95 cursor-pointer shadow-xs shrink-0"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};
