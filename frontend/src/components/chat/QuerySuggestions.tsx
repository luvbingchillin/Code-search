import React from 'react';
import { Lightbulb } from 'lucide-react';

export interface QuerySuggestionsProps {
  onSelectSuggestion: (query: string) => void;
  disabled?: boolean;
  activeRepoId?: string;
}

export const REPO_SUGGESTIONS: Record<string, string[]> = {
  requests: [
    'Where is Session.send defined?',
    'How does SessionRedirectMixin handle 3xx redirects?',
    'Where is CaseInsensitiveDict defined?',
    'Show HTTPAdapter send and build_response',
  ],
  sample_codebase: [
    'Show Calculator class and methods',
    'Find calculate_statistics and async generator',
    'Explain DataProcessingService transform_batch',
    'Find fetch_remote_resource with retry decorator',
  ],
};

export const DEFAULT_SUGGESTIONS: string[] = [
  'How does FastAPI solve dependency injection trees?',
  'Connect psf/requests (HTTP library)',
  'Connect sample_codebase (FastAPI)',
  'What is CodeSeek AI?',
];

export const QuerySuggestions: React.FC<QuerySuggestionsProps> = ({
  onSelectSuggestion,
  disabled,
  activeRepoId,
}) => {
  const repoKey = activeRepoId?.toLowerCase();
  const suggestions = (repoKey && REPO_SUGGESTIONS[repoKey]) || DEFAULT_SUGGESTIONS;

  return (
    <div
      data-testid="query-suggestions"
      className="relative px-3 py-1.5 border-t border-slate-800 bg-slate-950/90 flex items-center min-w-0 shrink-0 select-none overflow-hidden"
    >
      <div className="flex items-center space-x-1.5 text-xs text-slate-400 shrink-0 mr-2 z-10 bg-slate-950/90 pr-1">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-medium text-slate-300 hidden sm:inline">Suggested:</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
        {suggestions.map((text, i) => (
          <button
            key={i}
            type="button"
            data-testid="query-suggestion-chip"
            disabled={disabled}
            onClick={() => onSelectSuggestion(text)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }}
            className="text-xs px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/60 text-slate-200 hover:text-white transition-all whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none cursor-pointer shadow-xs emil-press emil-spotlight hover:-translate-y-0.5 hover:shadow-sky-500/10 active:scale-95"
          >
            {text}
          </button>
        ))}
      </div>
      {/* Right gradient edge affordance to prevent harsh text clipping */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-10" />
    </div>
  );
};
