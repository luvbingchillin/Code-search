import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { ChatPane } from '../components/chat/ChatPane';
import { apiClient } from '../services/apiClient';
import { AstCodeChunk, AgentStatus } from '../types';
import { REPO_SUGGESTIONS, DEFAULT_SUGGESTIONS } from '../components/chat/QuerySuggestions';

describe('Challenger 2 Empirical Verification: Dynamic Query Suggestion Chips Integration & Adversarial Suite (Milestone 3)', () => {
  const dummyChunks: AstCodeChunk[] = [
    {
      id: 'chunk-1',
      filePath: 'fixtures/requests/sessions.py',
      fileName: 'sessions.py',
      astNodeType: 'FunctionDef',
      identifier: 'Session.send',
      startLine: 600,
      endLine: 650,
      code: 'def send(self, request, **kwargs):\n    return Response()',
      relevanceScore: 0.99,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(apiClient, 'getRepositories').mockResolvedValue([
      {
        id: 'requests',
        name: 'psf/requests',
        path: 'fixtures/requests',
        chunksCount: 284,
        filesCount: 17,
        status: 'indexed',
        description: 'Python HTTP for Humans',
      },
      {
        id: 'sample_codebase',
        name: 'sample_codebase',
        path: 'backend/sample_codebase',
        chunksCount: 14,
        filesCount: 3,
        status: 'indexed',
        description: 'FastAPI service sample',
      },
      {
        id: 'CUSTOM_REPO_99',
        name: 'custom/repo',
        path: 'custom/repo',
        chunksCount: 5,
        filesCount: 1,
        status: 'indexed',
        description: 'Unknown custom repository',
      },
    ]);

    vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValue(dummyChunks);
    vi.spyOn(apiClient, 'searchAstChunks').mockResolvedValue(dummyChunks);
  });

  /* =========================================================================
   * 1. ChatPane Unit & Prop Threading Integration Tests
   * ========================================================================= */
  describe('1. ChatPane Component Integration & Prop Forwarding', () => {
    const baseStatus: AgentStatus = {
      state: 'Idle',
      currentStepMessage: 'Ready',
      elapsedMs: 0,
      activeChunkCount: 0,
    };

    it('ChatPane threads activeRepoId to QuerySuggestions to render repo-specific chips', () => {
      render(
        <ChatPane
          status={baseStatus}
          messages={[]}
          chunks={[]}
          onSelectChunk={vi.fn()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          activeRepoId="requests"
        />
      );

      const chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips).toHaveLength(REPO_SUGGESTIONS.requests.length);
      expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();
      expect(screen.getByText('Where is CaseInsensitiveDict defined?')).toBeInTheDocument();
    });

    it('ChatPane forwards sample_codebase activeRepoId to QuerySuggestions', () => {
      render(
        <ChatPane
          status={baseStatus}
          messages={[]}
          chunks={[]}
          onSelectChunk={vi.fn()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          activeRepoId="sample_codebase"
        />
      );

      const chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips).toHaveLength(REPO_SUGGESTIONS.sample_codebase.length);
      expect(screen.getByText('Show Calculator class and methods')).toBeInTheDocument();
      expect(screen.getByText('Explain DataProcessingService transform_batch')).toBeInTheDocument();
    });

    it('ChatPane defaults to DEFAULT_SUGGESTIONS when activeRepoId is omitted or undefined', () => {
      render(
        <ChatPane
          status={baseStatus}
          messages={[]}
          chunks={[]}
          onSelectChunk={vi.fn()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips).toHaveLength(DEFAULT_SUGGESTIONS.length);
      DEFAULT_SUGGESTIONS.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
    });

    it('Clicking a suggestion chip in ChatPane triggers onSubmit callback with exact query text', () => {
      const handleSubmit = vi.fn();
      render(
        <ChatPane
          status={baseStatus}
          messages={[]}
          chunks={[]}
          onSelectChunk={vi.fn()}
          onSubmit={handleSubmit}
          onCancel={vi.fn()}
          activeRepoId="requests"
        />
      );

      const chip = screen.getByText('How does SessionRedirectMixin handle 3xx redirects?');
      fireEvent.click(chip);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        'How does SessionRedirectMixin handle 3xx redirects?'
      );
    });

    it('Disables all suggestion chips when status.state is Thinking, Searching AST, or Synthesizing', () => {
      const busyStates: AgentStatus['state'][] = ['Thinking', 'Searching AST', 'Synthesizing'];

      busyStates.forEach((state) => {
        const { unmount } = render(
          <ChatPane
            status={{
              state,
              currentStepMessage: `Executing ${state}`,
              elapsedMs: 500,
              activeChunkCount: 1,
            }}
            messages={[]}
            chunks={[]}
            onSelectChunk={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
            activeRepoId="requests"
          />
        );

        const chips = screen.getAllByTestId('query-suggestion-chip');
        chips.forEach((chip) => {
          expect(chip).toBeDisabled();
        });
        unmount();
      });
    });

    it('Enables suggestion chips when status.state is Idle, Complete, or Error', () => {
      const nonBusyStates: AgentStatus['state'][] = ['Idle', 'Complete', 'Error'];

      nonBusyStates.forEach((state) => {
        const { unmount } = render(
          <ChatPane
            status={{
              state,
              currentStepMessage: `State: ${state}`,
              elapsedMs: 1000,
              activeChunkCount: 1,
            }}
            messages={[]}
            chunks={[]}
            onSelectChunk={vi.fn()}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
            activeRepoId="requests"
          />
        );

        const chips = screen.getAllByTestId('query-suggestion-chip');
        chips.forEach((chip) => {
          expect(chip).not.toBeDisabled();
        });
        unmount();
      });
    });

    it('Clicking a suggestion chip while disabled does NOT trigger onSubmit', () => {
      const handleSubmit = vi.fn();
      render(
        <ChatPane
          status={{
            state: 'Thinking',
            currentStepMessage: 'Thinking...',
            elapsedMs: 200,
            activeChunkCount: 0,
          }}
          messages={[]}
          chunks={[]}
          onSelectChunk={vi.fn()}
          onSubmit={handleSubmit}
          onCancel={vi.fn()}
          activeRepoId="requests"
        />
      );

      const chip = screen.getByText('Where is Session.send defined?');
      expect(chip).toBeDisabled();
      fireEvent.click(chip);

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  /* =========================================================================
   * 2. Full App DOM Integration Tests
   * ========================================================================= */
  describe('2. App.tsx Prop Threading & User Interaction Integration', () => {
    it('App initializes with activeRepo = null and renders DEFAULT_SUGGESTIONS in ChatPane', () => {
      render(<App />);

      const suggestionsContainer = screen.getByTestId('query-suggestions');
      expect(suggestionsContainer).toBeInTheDocument();

      const chips = screen.getAllByTestId('query-suggestion-chip');
      expect(chips).toHaveLength(DEFAULT_SUGGESTIONS.length);
      expect(screen.getByText(DEFAULT_SUGGESTIONS[0])).toBeInTheDocument();
    });

    it('Selecting requests repo dynamically updates query suggestion chips to requests questions', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Open ConnectRepoModal
      await user.click(screen.getByTestId('connect-repo-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('connect-repo-modal')).toBeInTheDocument();
      });

      // Select psf/requests
      await user.click(screen.getByTestId('open-repo-btn-requests'));

      // Verify modal closed
      await waitFor(() => {
        expect(screen.queryByTestId('connect-repo-modal')).not.toBeInTheDocument();
      });

      // Verify suggestion chips switched to requests questions
      await waitFor(() => {
        const chips = screen.getAllByTestId('query-suggestion-chip');
        expect(chips).toHaveLength(REPO_SUGGESTIONS.requests.length);
        expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();
        expect(screen.getByText('Where is CaseInsensitiveDict defined?')).toBeInTheDocument();
        expect(screen.getByText('Show HTTPAdapter send and build_response')).toBeInTheDocument();
      });
    });

    it('Clicking a suggestion chip in App populates and triggers agent.submitQuery, transitioning agent status and disabling chips', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Connect psf/requests repo
      await user.click(screen.getByTestId('connect-repo-btn'));
      await waitFor(() => expect(screen.getByTestId('open-repo-btn-requests')).toBeInTheDocument());
      await user.click(screen.getByTestId('open-repo-btn-requests'));

      await waitFor(() => {
        expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();
      });

      // Click the suggestion chip
      const suggestionChip = screen.getByText('Where is Session.send defined?');
      await user.click(suggestionChip);

      // Verify query is submitted: user message appears in chat messages list
      await waitFor(() => {
        const matches = screen.getAllByText('Where is Session.send defined?');
        // Expect 2 elements: one in the message stream (<p>), one in the suggestion chips (<button>)
        expect(matches.length).toBeGreaterThanOrEqual(2);
        // Agent enters Thinking/Searching AST/Synthesizing loop
        const stateLabel = screen.getByTestId('agentic-state-label');
        expect(stateLabel.textContent).toMatch(/Thinking|Searching AST|Synthesizing/);
      });

      // While agent is busy, verify chips become disabled
      const chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((chip) => {
        expect(chip).toBeDisabled();
      });
    });

    it('Dynamically switching from requests to sample_codebase updates chips without remounting', async () => {
      const user = userEvent.setup();
      render(<App />);

      // 1. Connect requests
      await user.click(screen.getByTestId('connect-repo-btn'));
      await waitFor(() => expect(screen.getByTestId('open-repo-btn-requests')).toBeInTheDocument());
      await user.click(screen.getByTestId('open-repo-btn-requests'));

      await waitFor(() => {
        expect(screen.getByText('Where is Session.send defined?')).toBeInTheDocument();
      });

      // 2. Switch to sample_codebase
      await user.click(screen.getByTestId('connect-repo-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('open-repo-btn-sample_codebase')).toBeInTheDocument()
      );
      await user.click(screen.getByTestId('open-repo-btn-sample_codebase'));

      // Verify chips dynamically changed to sample_codebase
      await waitFor(() => {
        expect(screen.getByText('Show Calculator class and methods')).toBeInTheDocument();
        expect(screen.getByText('Find calculate_statistics and async generator')).toBeInTheDocument();
        expect(screen.queryByText('Where is Session.send defined?')).not.toBeInTheDocument();
      });
    });

    it('Selecting an unknown/custom repository ID falls back cleanly to DEFAULT_SUGGESTIONS', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Connect custom repo with unknown id 'CUSTOM_REPO_99'
      await user.click(screen.getByTestId('connect-repo-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('open-repo-btn-CUSTOM_REPO_99')).toBeInTheDocument()
      );
      await user.click(screen.getByTestId('open-repo-btn-CUSTOM_REPO_99'));

      // Verify suggestion chips gracefully fall back to DEFAULT_SUGGESTIONS
      await waitFor(() => {
        const chips = screen.getAllByTestId('query-suggestion-chip');
        expect(chips).toHaveLength(DEFAULT_SUGGESTIONS.length);
        expect(screen.getByText(DEFAULT_SUGGESTIONS[0])).toBeInTheDocument();
      });
    });
  });
});
