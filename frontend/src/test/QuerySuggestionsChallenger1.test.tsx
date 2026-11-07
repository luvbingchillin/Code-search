import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  QuerySuggestions,
  REPO_SUGGESTIONS,
  DEFAULT_SUGGESTIONS,
} from '../components/chat/QuerySuggestions';
import { ChatPane } from '../components/chat/ChatPane';
import { AgentStatus, AstCodeChunk, ChatMessage } from '../types';

describe('Challenger 1 Empirical Adversarial Suite: Dynamic Query Suggestion Chips (Milestone 3)', () => {
  const dummyStatus: AgentStatus = {
    state: 'Idle',
    currentStepMessage: 'System idle and ready for queries',
    elapsedMs: 0,
    activeChunkCount: 0,
  };

  const dummyMessages: ChatMessage[] = [];
  const dummyChunks: AstCodeChunk[] = [];

  // =========================================================================
  // Challenge 1: Exact Repo Scoping & Content Mutual Exclusion
  // =========================================================================
  describe('Challenge 1: Content Invariants & Mutual Exclusion', () => {
    it('strictly renders Requests AST questions for activeRepoId="requests" with zero leakage from other presets', () => {
      const handleSelect = vi.fn();
      render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="requests" />);

      const chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips).toHaveLength(REPO_SUGGESTIONS.requests.length);

      const chipTexts = chips.map((c) => c.textContent);
      expect(chipTexts).toEqual(REPO_SUGGESTIONS.requests);

      // Verify required Requests AST entities
      expect(chipTexts).toContain('Where is Session.send defined?');
      expect(chipTexts).toContain('How does SessionRedirectMixin handle 3xx redirects?');
      expect(chipTexts).toContain('Where is CaseInsensitiveDict defined?');
      expect(chipTexts).toContain('Show HTTPAdapter send and build_response');

      // Mutual exclusion: Must NOT contain any sample_codebase or default queries
      REPO_SUGGESTIONS.sample_codebase.forEach((q) => {
        expect(chipTexts).not.toContain(q);
      });
      DEFAULT_SUGGESTIONS.forEach((q) => {
        expect(chipTexts).not.toContain(q);
      });
    });

    it('strictly renders Calculator/sample_codebase questions for activeRepoId="sample_codebase" with zero leakage', () => {
      const handleSelect = vi.fn();
      render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="sample_codebase" />);

      const chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips).toHaveLength(REPO_SUGGESTIONS.sample_codebase.length);

      const chipTexts = chips.map((c) => c.textContent);
      expect(chipTexts).toEqual(REPO_SUGGESTIONS.sample_codebase);

      // Verify required sample entities
      expect(chipTexts).toContain('Show Calculator class and methods');
      expect(chipTexts).toContain('Find calculate_statistics and async generator');
      expect(chipTexts).toContain('Explain DataProcessingService transform_batch');
      expect(chipTexts).toContain('Find fetch_remote_resource with retry decorator');

      // Mutual exclusion
      REPO_SUGGESTIONS.requests.forEach((q) => {
        expect(chipTexts).not.toContain(q);
      });
      DEFAULT_SUGGESTIONS.forEach((q) => {
        expect(chipTexts).not.toContain(q);
      });
    });

    it('strictly renders DEFAULT_SUGGESTIONS when activeRepoId is undefined, null, or empty string', () => {
      const handleSelect = vi.fn();
      const { rerender } = render(<QuerySuggestions onSelectSuggestion={handleSelect} />);

      let chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips.map((c) => c.textContent)).toEqual(DEFAULT_SUGGESTIONS);

      // null
      rerender(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={null as any} />);
      chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips.map((c) => c.textContent)).toEqual(DEFAULT_SUGGESTIONS);

      // empty string
      rerender(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="" />);
      chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips.map((c) => c.textContent)).toEqual(DEFAULT_SUGGESTIONS);
    });

    it('strictly falls back to DEFAULT_SUGGESTIONS for unknown/arbitrary repo IDs', () => {
      const handleSelect = vi.fn();
      const { rerender } = render(
        <QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="unknown_pytorch_repo" />
      );

      let chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips.map((c) => c.textContent)).toEqual(DEFAULT_SUGGESTIONS);

      rerender(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="custom_uuid_8832" />);
      chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips.map((c) => c.textContent)).toEqual(DEFAULT_SUGGESTIONS);
    });
  });

  // =========================================================================
  // Challenge 2: Case Normalization & Boundary Stressing
  // =========================================================================
  describe('Challenge 2: Case Normalization & Stressing', () => {
    it('handles exotic casing for "requests" (REQUESTS, ReQuEsTs, rEQuEsTS)', () => {
      const handleSelect = vi.fn();
      const variants = ['REQUESTS', 'ReQuEsTs', 'rEQuEsTS', 'requests'];

      const { rerender } = render(
        <QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={variants[0]} />
      );

      for (const variant of variants) {
        rerender(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={variant} />);
        const chips = screen.getAllByTestId('query-suggestion-chip');
        expect(chips.map((c) => c.textContent)).toEqual(REPO_SUGGESTIONS.requests);
      }
    });

    it('handles exotic casing for "sample_codebase" (SAMPLE_CODEBASE, Sample_Codebase)', () => {
      const handleSelect = vi.fn();
      const variants = ['SAMPLE_CODEBASE', 'Sample_Codebase', 'sAmPlE_cOdEbAsE'];

      const { rerender } = render(
        <QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={variants[0]} />
      );

      for (const variant of variants) {
        rerender(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={variant} />);
        const chips = screen.getAllByTestId('query-suggestion-chip');
        expect(chips.map((c) => c.textContent)).toEqual(REPO_SUGGESTIONS.sample_codebase);
      }
    });

    it('safely handles diverse arbitrary repo identifiers (symbols, paths, numbers, camelCase)', () => {
      const handleSelect = vi.fn();
      const testIds = [
        'repo-123',
        'org/project_name',
        'C:\\Users\\dev\\project',
        'psf/requests/v2',
        'toString', // lowercases to 'tostring', which safely yields undefined and falls back to default
        'valueOf',  // lowercases to 'valueof', safely falls back
        'hasOwnProperty', // lowercases to 'hasownproperty', safely falls back
        'UNKNOWN_REPO',
        '12345',
        '---special---',
      ];

      for (const id of testIds) {
        expect(() => {
          const { unmount } = render(
            <QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={id} />
          );
          const chips = screen.getAllByTestId('query-suggestion-chip');
          expect(chips.map((c) => c.textContent)).toEqual(DEFAULT_SUGGESTIONS);
          unmount();
        }).not.toThrow();
      }
    });

    it('documents the object prototype property collision on "constructor"', () => {
      // In JS, plain object REPO_SUGGESTIONS['constructor'] resolves to Object.prototype.constructor.
      // This verifies that REPO_SUGGESTIONS lacks an own-property check for 'constructor'.
      const hasDirectConstructorKey = Object.prototype.hasOwnProperty.call(REPO_SUGGESTIONS, 'constructor');
      expect(hasDirectConstructorKey).toBe(false);

      // Document that REPO_SUGGESTIONS['constructor'] returns Function rather than Array
      const constructorVal = (REPO_SUGGESTIONS as any)['constructor'];
      expect(typeof constructorVal).toBe('function');
      expect(Array.isArray(constructorVal)).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 3: Click Dispatch & Parameter Fidelity
  // =========================================================================
  describe('Challenge 3: Click Dispatch & State Integrity', () => {
    it('dispatches the exact query text for every single chip in requests preset', () => {
      const handleSelect = vi.fn();
      render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="requests" />);

      const chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((chip, index) => {
        handleSelect.mockClear();
        fireEvent.click(chip);
        expect(handleSelect).toHaveBeenCalledTimes(1);
        expect(handleSelect).toHaveBeenCalledWith(REPO_SUGGESTIONS.requests[index]);
      });
    });

    it('dispatches the exact query text for every single chip in sample_codebase preset', () => {
      const handleSelect = vi.fn();
      render(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId="sample_codebase" />);

      const chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((chip, index) => {
        handleSelect.mockClear();
        fireEvent.click(chip);
        expect(handleSelect).toHaveBeenCalledTimes(1);
        expect(handleSelect).toHaveBeenCalledWith(REPO_SUGGESTIONS.sample_codebase[index]);
      });
    });

    it('completely ignores clicks when disabled is true', () => {
      const handleSelect = vi.fn();
      render(
        <QuerySuggestions
          onSelectSuggestion={handleSelect}
          activeRepoId="requests"
          disabled={true}
        />
      );

      const chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((chip) => {
        expect(chip).toBeDisabled();
        fireEvent.click(chip);
      });

      expect(handleSelect).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Challenge 4: Rapid Dynamic Repository Switching Stress Harness
  // =========================================================================
  describe('Challenge 4: Rapid Dynamic Repository Switching', () => {
    it('switches chips immediately across 10 rapid transitions without stale ghost state', () => {
      const handleSelect = vi.fn();
      const sequence: Array<{ repoId: string | undefined; expected: string[] }> = [
        { repoId: undefined, expected: DEFAULT_SUGGESTIONS },
        { repoId: 'requests', expected: REPO_SUGGESTIONS.requests },
        { repoId: 'sample_codebase', expected: REPO_SUGGESTIONS.sample_codebase },
        { repoId: 'unknown_repo', expected: DEFAULT_SUGGESTIONS },
        { repoId: 'REQUESTS', expected: REPO_SUGGESTIONS.requests },
        { repoId: '', expected: DEFAULT_SUGGESTIONS },
        { repoId: 'Sample_Codebase', expected: REPO_SUGGESTIONS.sample_codebase },
        { repoId: 'requests', expected: REPO_SUGGESTIONS.requests },
        { repoId: 'unindexed_foo', expected: DEFAULT_SUGGESTIONS },
        { repoId: 'sample_codebase', expected: REPO_SUGGESTIONS.sample_codebase },
      ];

      const { rerender } = render(
        <QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={sequence[0].repoId} />
      );

      sequence.forEach(({ repoId, expected }, step) => {
        rerender(<QuerySuggestions onSelectSuggestion={handleSelect} activeRepoId={repoId} />);
        const chips = screen.getAllByTestId('query-suggestion-chip');
        const renderedTexts = chips.map((c) => c.textContent);
        expect(renderedTexts).toEqual(expected);

        // Click the first chip to verify handler receives the updated repo query
        handleSelect.mockClear();
        fireEvent.click(chips[0]);
        expect(handleSelect).toHaveBeenCalledWith(expected[0]);
      });
    });
  });

  // =========================================================================
  // Challenge 5: Full ChatPane Integration & Agent Loop Concurrency
  // =========================================================================
  describe('Challenge 5: ChatPane Prop Pipeline & Busy States', () => {
    it('threads activeRepoId through ChatPane and dispatches to onSubmit', () => {
      const handleSubmit = vi.fn();
      const handleCancel = vi.fn();
      const handleSelectChunk = vi.fn();

      const { rerender } = render(
        <ChatPane
          status={dummyStatus}
          messages={dummyMessages}
          chunks={dummyChunks}
          onSelectChunk={handleSelectChunk}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          activeRepoId="requests"
        />
      );

      // Verify requests chips rendered in ChatPane
      expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();

      // Click chip
      fireEvent.click(screen.getByText('Where is Session.send defined?'));
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith('Where is Session.send defined?');

      // Dynamically change repo in ChatPane
      rerender(
        <ChatPane
          status={dummyStatus}
          messages={dummyMessages}
          chunks={dummyChunks}
          onSelectChunk={handleSelectChunk}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          activeRepoId="sample_codebase"
        />
      );

      expect(screen.queryByText('Where is Session.send defined?')).not.toBeInTheDocument();
      expect(screen.getByText('Show Calculator class and methods')).toBeInTheDocument();

      // Click sample chip
      handleSubmit.mockClear();
      fireEvent.click(screen.getByText('Show Calculator class and methods'));
      expect(handleSubmit).toHaveBeenCalledWith('Show Calculator class and methods');
    });

    it('disables suggestion chips across all busy ReAct agent loop states', () => {
      const handleSubmit = vi.fn();
      const busyStates: Array<AgentStatus['state']> = ['Thinking', 'Searching AST', 'Synthesizing'];

      const { rerender } = render(
        <ChatPane
          status={dummyStatus}
          messages={dummyMessages}
          chunks={dummyChunks}
          onSelectChunk={vi.fn()}
          onSubmit={handleSubmit}
          onCancel={vi.fn()}
          activeRepoId="requests"
        />
      );

      // Idle: chips enabled
      let chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((c) => expect(c).not.toBeDisabled());

      // Busy states
      for (const busyState of busyStates) {
        rerender(
          <ChatPane
            status={{ ...dummyStatus, state: busyState }}
            messages={dummyMessages}
            chunks={dummyChunks}
            onSelectChunk={vi.fn()}
            onSubmit={handleSubmit}
            onCancel={vi.fn()}
            activeRepoId="requests"
          />
        );

        chips = screen.getAllByTestId('query-suggestion-chip');
        chips.forEach((c) => {
          expect(c).toBeDisabled();
          fireEvent.click(c);
        });
        expect(handleSubmit).not.toHaveBeenCalled();
      }

      // Transition back to Idle: chips re-enabled
      rerender(
        <ChatPane
          status={{ ...dummyStatus, state: 'Idle' }}
          messages={dummyMessages}
          chunks={dummyChunks}
          onSelectChunk={vi.fn()}
          onSubmit={handleSubmit}
          onCancel={vi.fn()}
          activeRepoId="requests"
        />
      );

      chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((c) => expect(c).not.toBeDisabled());
      fireEvent.click(chips[0]);
      expect(handleSubmit).toHaveBeenCalledWith(REPO_SUGGESTIONS.requests[0]);
    });
  });

  // =========================================================================
  // Challenge 6: DOM & Neo-Tactile Brutalist Contract Verification
  // =========================================================================
  describe('Challenge 6: DOM Structure & Attribute Verification', () => {
    it('chips strictly render with button type="button" and proper styling classes', () => {
      render(<QuerySuggestions onSelectSuggestion={vi.fn()} activeRepoId="requests" />);

      const chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((chip) => {
        expect(chip.tagName).toBe('BUTTON');
        expect(chip).toHaveAttribute('type', 'button');
        // Check core styles
        expect(chip.className).toContain('rounded-full');
        expect(chip.className).toContain('cursor-pointer');
      });
    });
  });
});
