import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { QuerySuggestions } from '../components/chat/QuerySuggestions';
import { MessageList } from '../components/chat/MessageList';
import { apiClient } from '../services/apiClient';
import { mockAstChunks } from '../services/mockAstData';

describe('Phase 4 Everyday Developer Ergonomics Suite', () => {
  it('toggles Full File view in CodeViewerContainer and renders complete file lines', async () => {
    const user = userEvent.setup();
    const fullFileSpy = vi.spyOn(apiClient, 'getRepoFileContent').mockResolvedValueOnce({
      repo_id: 'requests',
      file_path: 'fastapi/dependencies/utils.py',
      content: '# Module header\nCONSTANT = 42\n\ndef solve_dependencies():\n    return CONSTANT\n',
      total_lines: 5,
    });

    render(
      <CodeViewerContainer
        chunks={[mockAstChunks[0]]}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={vi.fn()}
        activeRepoId="requests"
      />
    );

    const toggleBtn = screen.getByTestId('toggle-full-file-btn');
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(fullFileSpy).toHaveBeenCalledWith('requests', mockAstChunks[0].filePath);
    });

    await waitFor(() => {
      expect(screen.getByTestId('code-display')).toHaveTextContent('CONSTANT = 42');
    });

    // Toggle back to isolated symbol view
    await user.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByTestId('code-display')).not.toHaveTextContent('CONSTANT = 42');
    });

    fullFileSpy.mockRestore();
  });

  it('steps through in-code search matches with Next/Prev buttons', async () => {
    const user = userEvent.setup();
    const multiMatchChunk = {
      ...mockAstChunks[0],
      code: 'def foo():\n    x = token\n    y = token\n    return token\n',
    };

    render(
      <CodeViewerContainer
        chunks={[multiMatchChunk]}
        selectedChunkId={multiMatchChunk.id}
        onSelectChunk={vi.fn()}
        activeRepoId="requests"
      />
    );

    await user.click(screen.getByTestId('open-code-search-btn'));
    const input = screen.getByTestId('code-search-input');
    await user.type(input, 'token');

    await waitFor(() => {
      expect(screen.getByTestId('search-match-count')).toHaveTextContent('1/3 matches');
    });

    await user.click(screen.getByTestId('search-next-match-btn'));
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('2/3 matches');

    await user.click(screen.getByTestId('search-prev-match-btn'));
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('1/3 matches');
  });

  it('includes /overview in ChatInput slash command autocomplete', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <ChatInput
        status={{ state: 'Idle', currentStepMessage: 'Ready', elapsedMs: 0, activeChunkCount: 0 }}
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
        hasActiveRepo={true}
        activeRepoName="psf/requests"
      />
    );

    const textarea = screen.getByTestId('chat-input-textarea');
    await user.type(textarea, '/ov');

    const overviewOption = await screen.findByTestId('slash-cmd-overview');
    expect(overviewOption).toBeInTheDocument();
    await user.click(overviewOption);
    expect(handleSubmit).toHaveBeenCalledWith('/overview');
  });

  it('generates dynamic suggestions from manifest for custom repositories', () => {
    const manifest =
      'billing_engine is a Python codebase.\nCore Components:\n- InvoiceLedger: Tracks invoices.\n- PaymentGateway: Charges cards.';
    render(
      <QuerySuggestions
        onSelectSuggestion={vi.fn()}
        activeRepoId="billing_engine"
        activeRepoName="billing_engine"
        activeRepoManifest={manifest}
      />
    );

    expect(screen.getByText('Give me an overview of billing_engine')).toBeInTheDocument();
    expect(screen.getByText('Explain InvoiceLedger')).toBeInTheDocument();
    expect(screen.getByText('Explain PaymentGateway')).toBeInTheDocument();
  });

  it('renders animated loading/thinking bubble in MessageList without leaking raw token text during synthesis', () => {
    render(
      <MessageList
        messages={[]}
        chunks={[]}
        onSelectChunk={vi.fn()}
        isSynthesizing={true}
        agentState="Synthesizing"
        streamingTokens="Session.send dispatches the PreparedRequest via HTTPAdapter."
      />
    );

    const bubble = screen.getByTestId('agent-loading-bubble');
    expect(bubble).toBeInTheDocument();
    expect(bubble).toHaveTextContent('Synthesizing response...');
    expect(bubble).not.toHaveTextContent('PreparedRequest via HTTPAdapter');
  });
});
