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
        <span className="font-medium text-gray-400">Suggested Code Queries:</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((text, i) => (
          <button
            key={i}
            data-testid="query-suggestion-chip"
            disabled={disabled}
            onClick={() => onSelectSuggestion(text)}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-700 active:scale-95"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};
