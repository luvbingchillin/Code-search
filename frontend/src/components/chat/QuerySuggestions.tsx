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
      className="px-4 py-2 border-t border-gray-800/80 bg-gray-950/70"
    >
      <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-medium text-gray-300">Suggested Code Queries:</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((text, i) => (
          <button
            key={i}
            type="button"
            data-testid="query-suggestion-chip"
            disabled={disabled}
            onClick={() => onSelectSuggestion(text)}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-900/90 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500/50 text-gray-300 hover:text-white transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-400 focus:outline-none active:scale-95 cursor-pointer shadow-xs"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};
