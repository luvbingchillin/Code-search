import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  QuerySuggestions,
  REPO_SUGGESTIONS,
  DEFAULT_SUGGESTIONS,
} from '../components/chat/QuerySuggestions';

describe('QuerySuggestions Acceptance Suite', () => {
  it('renders default suggestions when activeRepoId is undefined', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} />);

    const chips = screen.getAllByTestId('query-suggestion-chip');
    expect(chips).toHaveLength(DEFAULT_SUGGESTIONS.length);
    DEFAULT_SUGGESTIONS.forEach((text) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  });

  it('renders requests-specific suggestions when activeRepoId is "requests"', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="requests" />);

    const chips = screen.getAllByTestId('query-suggestion-chip');
    expect(chips).toHaveLength(REPO_SUGGESTIONS.requests.length);
    expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();
    expect(screen.getByText('How does SessionRedirectMixin handle 3xx redirects?')).toBeInTheDocument();
    expect(screen.getByText('Where is CaseInsensitiveDict defined?')).toBeInTheDocument();
    expect(screen.getByText('Show HTTPAdapter send and build_response')).toBeInTheDocument();
  });

  it('handles case-insensitivity for activeRepoId (e.g. "REQUESTS")', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="REQUESTS" />);

    const chips = screen.getAllByTestId('query-suggestion-chip');
    expect(chips).toHaveLength(REPO_SUGGESTIONS.requests.length);
    expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();
  });

  it('renders sample_codebase suggestions when activeRepoId is "sample_codebase"', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="sample_codebase" />);

    const chips = screen.getAllByTestId('query-suggestion-chip');
    expect(chips).toHaveLength(REPO_SUGGESTIONS.sample_codebase.length);
    expect(screen.getByText('Show Calculator class and methods')).toBeInTheDocument();
    expect(screen.getByText('Find calculate_statistics and async generator')).toBeInTheDocument();
    expect(screen.getByText('Explain DataProcessingService transform_batch')).toBeInTheDocument();
    expect(screen.getByText('Find fetch_remote_resource with retry decorator')).toBeInTheDocument();
  });

  it('handles case-insensitivity for sample_codebase (e.g. "Sample_Codebase")', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="Sample_Codebase" />);

    expect(screen.getByText('Show Calculator class and methods')).toBeInTheDocument();
  });

  it('falls back to default suggestions for unknown activeRepoId', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="unknown-repo-xyz" />);

    const chips = screen.getAllByTestId('query-suggestion-chip');
    expect(chips).toHaveLength(DEFAULT_SUGGESTIONS.length);
    expect(screen.getByText(DEFAULT_SUGGESTIONS[0])).toBeInTheDocument();
  });

  it('fires onSelectSuggestion callback with chip query on click', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="requests" />);

    const firstChip = screen.getByText('Where is Session.send defined?');
    fireEvent.click(firstChip);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('Where is Session.send defined?');
  });

  it('disables suggestion chips when disabled prop is true', () => {
    const handleSelect = vi.fn();
    render(<QuerySuggestions onSelectSuggestion={handleSelect} disabled={true} />);

    const chips = screen.getAllByTestId('query-suggestion-chip');
    chips.forEach((chip) => {
      expect(chip).toBeDisabled();
    });
  });
});
