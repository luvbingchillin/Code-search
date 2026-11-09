import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReActAgent } from '../hooks/useReActAgent';
import { RepositoryItem } from '../types';

describe('Slash Commands, Conversational Intent & Repository Gating Suite', () => {
  const sampleRepo: RepositoryItem = {
    id: 'requests',
    name: 'psf/requests',
    path: 'C:/repos/requests',
    chunksCount: 284,
    astNodeCount: 284,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Slash Commands (/help, /status, /repo)', () => {
    it('/help outputs command guide and transitions to idle without search', async () => {
      const mockSearch = vi.fn();
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('/help');
      });

      expect(mockSearch).not.toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('CodeSeek AI Command & Workflow Guide');
      expect(lastMsg.content).toContain('/help');
      expect(lastMsg.content).toContain('/status');
      expect(lastMsg.content).toContain('/ask');
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('/status outputs active repository details and engine status', async () => {
      const mockSearch = vi.fn();
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('/status');
      });

      expect(mockSearch).not.toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('psf/requests');
      expect(lastMsg.content).toContain('284');
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('/repo outputs status when active repo is null', async () => {
      const mockSearch = vi.fn();
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: null,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('/repo');
      });

      expect(mockSearch).not.toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('None connected');
    });
  });

  describe('2. Conversational Intent Handling ("what repo am i in")', () => {
    it('answers "what repo am i in" with status instead of running vector search', async () => {
      const mockSearch = vi.fn();
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('what repo am i in');
      });

      expect(mockSearch).not.toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('psf/requests');
    });

    it('answers "which repo" with status card', async () => {
      const mockSearch = vi.fn();
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('which repo');
      });

      expect(mockSearch).not.toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.content).toContain('psf/requests');
    });
  });

  describe('3. Repository Connection Gating', () => {
    it('gates blind queries when activeRepo is null', async () => {
      const mockSearch = vi.fn();
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: null,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('dd');
      });

      expect(mockSearch).not.toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('No Active Repository Connected');
      expect(lastMsg.content).toContain('Please select or connect a Python repository');
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('allows query when activeRepo is connected and executes search', async () => {
      const mockSearch = vi.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          identifier: 'Session.send',
          code: 'def send(self, request): pass',
          filePath: 'requests/sessions.py',
          startLine: 10,
          endLine: 20,
          astNodeType: 'FunctionDef',
        },
      ]);

      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('find Session.send');
      });

      expect(mockSearch).toHaveBeenCalledWith('find Session.send', expect.anything());
      expect(result.current.activeChunks.length).toBe(1);
    });

    it('strips /ask prefix and performs scoped search', async () => {
      const mockSearch = vi.fn().mockResolvedValue([]);
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('/ask where is Session.send');
      });

      expect(mockSearch).toHaveBeenCalledWith('where is Session.send', expect.anything());
    });
  });

  describe('4. ChatInput Slash Command Menu & Dynamic Placeholders', () => {
    it('displays disconnected repository placeholder when hasActiveRepo is false', async () => {
      const { render, screen } = await import('@testing-library/react');
      const { ChatInput } = await import('../components/chat/ChatInput');
      render(
        <ChatInput
          status={{ state: 'Idle', currentStepMessage: 'Idle', activeChunkCount: 0 }}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          hasActiveRepo={false}
          activeRepoName={null}
        />
      );

      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Connect a repository to search AST code, or type /help...'
      );
    });

    it('displays connected repository placeholder when activeRepoName is provided', async () => {
      const { render, screen } = await import('@testing-library/react');
      const { ChatInput } = await import('../components/chat/ChatInput');
      render(
        <ChatInput
          status={{ state: 'Idle', currentStepMessage: 'Idle', activeChunkCount: 0 }}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          hasActiveRepo={true}
          activeRepoName="psf/requests"
        />
      );

      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Ask a question about psf/requests (or type /help, /status)...'
      );
    });

    it('opens slash command popover menu when input starts with "/" and selects command', async () => {
      const { render, screen, fireEvent } = await import('@testing-library/react');
      const { ChatInput } = await import('../components/chat/ChatInput');
      const handleSubmit = vi.fn();

      render(
        <ChatInput
          status={{ state: 'Idle', currentStepMessage: 'Idle', activeChunkCount: 0 }}
          onSubmit={handleSubmit}
          onCancel={vi.fn()}
        />
      );

      const textarea = screen.getByTestId('chat-input-textarea');
      fireEvent.change(textarea, { target: { value: '/' } });

      expect(screen.getByTestId('slash-commands-popover')).toBeInTheDocument();
      expect(screen.getByTestId('slash-cmd-help')).toBeInTheDocument();
      expect(screen.getByTestId('slash-cmd-status')).toBeInTheDocument();

      // Click /status
      fireEvent.click(screen.getByTestId('slash-cmd-status'));
      expect(handleSubmit).toHaveBeenCalledWith('/status');
    });

    it('navigates popover with ArrowDown and selects with Enter', async () => {
      const { render, screen, fireEvent } = await import('@testing-library/react');
      const { ChatInput } = await import('../components/chat/ChatInput');
      const handleSubmit = vi.fn();

      render(
        <ChatInput
          status={{ state: 'Idle', currentStepMessage: 'Idle', activeChunkCount: 0 }}
          onSubmit={handleSubmit}
          onCancel={vi.fn()}
        />
      );

      const textarea = screen.getByTestId('chat-input-textarea');
      fireEvent.change(textarea, { target: { value: '/' } });

      // Arrow down to /status (index 1)
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(handleSubmit).toHaveBeenCalledWith('/status');
    });

    it('dismisses popover on Escape key', async () => {
      const { render, screen, fireEvent } = await import('@testing-library/react');
      const { ChatInput } = await import('../components/chat/ChatInput');

      render(
        <ChatInput
          status={{ state: 'Idle', currentStepMessage: 'Idle', activeChunkCount: 0 }}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const textarea = screen.getByTestId('chat-input-textarea');
      fireEvent.change(textarea, { target: { value: '/' } });
      expect(screen.getByTestId('slash-commands-popover')).toBeInTheDocument();

      fireEvent.keyDown(textarea, { key: 'Escape' });
      expect(screen.queryByTestId('slash-commands-popover')).not.toBeInTheDocument();
    });
  });
});
