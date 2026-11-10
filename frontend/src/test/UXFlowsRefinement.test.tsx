import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import React from 'react';
import { useReActAgent } from '../hooks/useReActAgent';
import { CodeDisplay } from '../components/viewer/CodeDisplay';
import { ASTMetadataInspector, PYTHON_BUILTINS } from '../components/viewer/ASTMetadataInspector';
import { MessageList } from '../components/chat/MessageList';
import { AstCodeChunk, RepositoryItem, ChatMessage } from '../types';

describe('UX Flows & Edge Cases Refinement Suite', () => {
  const sampleRepo: RepositoryItem = {
    id: 'requests',
    name: 'psf/requests',
    path: 'C:/repos/requests',
    chunksCount: 284,
  };

  const sampleChunk: AstCodeChunk = {
    id: 'chunk-1',
    filePath: 'core/models.py',
    astNodeType: 'FunctionDef',
    identifier: 'send_request',
    startLine: 10,
    endLine: 40,
    code: 'def send_request(url):\n    val = len(url)\n    return external_dispatch(val)',
    relevanceScore: 0.95,
    calls: ['len', 'external_dispatch'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Zero-Result Queries without Mock Hallucination', () => {
    it('outputs clean No Matching AST Nodes Found card when search returns 0 chunks', async () => {
      const mockSearch = vi.fn().mockResolvedValue([]);
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('non_existent_symbol_xyz');
      });

      expect(mockSearch).toHaveBeenCalled();
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('No Matching AST Nodes Found');
      expect(lastMsg.content).toContain('non_existent_symbol_xyz');
      expect(lastMsg.content).not.toContain('CaseInsensitiveDict');
      expect(result.current.activeChunks).toHaveLength(0);
      expect(result.current.agentStatus.state).toBe('Complete');
    });
  });

  describe('2. New Chat and Clear Conversation', () => {
    it('clearMessages() resets message list and resets agent status to Idle', async () => {
      const mockSearch = vi.fn().mockResolvedValue([sampleChunk]);
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
          nemoIR: { searchAstChunks: mockSearch } as any,
        })
      );

      await act(async () => {
        await result.current.submitQuery('send_request');
      });

      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearMessages?.();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('addMessage() correctly appends a system notification message', () => {
      const { result } = renderHook(() =>
        useReActAgent({
          activeRepo: sampleRepo,
        })
      );

      const customMsg: ChatMessage = {
        id: 'sys-test-1',
        role: 'assistant',
        content: 'Switched repository context',
        timestamp: '12:00 PM',
      };

      act(() => {
        result.current.addMessage?.(customMsg);
      });

      expect(result.current.messages).toContainEqual(customMsg);
    });
  });

  describe('3. CodeDisplay Contextual Empty States', () => {
    it('renders "No repository connected" and connect button when hasActiveRepo is false', () => {
      const handleConnect = vi.fn();
      render(
        <CodeDisplay
          chunk={null}
          hasActiveRepo={false}
          onOpenConnectRepo={handleConnect}
        />
      );

      expect(screen.getByText('No repository connected')).toBeInTheDocument();
      expect(screen.getByText(/Connect a local repository/i)).toBeInTheDocument();

      const btn = screen.getByTestId('empty-state-connect-repo-btn');
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleConnect).toHaveBeenCalledTimes(1);
    });

    it('renders "No AST code tabs open" and file explorer button when hasActiveRepo is true', () => {
      const handleToggleExplorer = vi.fn();
      render(
        <CodeDisplay
          chunk={null}
          hasActiveRepo={true}
          onToggleExplorer={handleToggleExplorer}
        />
      );

      expect(screen.getByText('No AST code tabs open')).toBeInTheDocument();
      expect(
        screen.getByText(/Select a Python file or symbol from the Explorer/i)
      ).toBeInTheDocument();

      const btn = screen.getByTestId('empty-state-open-explorer-btn');
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleToggleExplorer).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. ASTMetadataInspector Python Built-ins & Visual Feedback', () => {
    it('verifies common Python standard library built-ins set', () => {
      expect(PYTHON_BUILTINS.has('len')).toBe(true);
      expect(PYTHON_BUILTINS.has('str')).toBe(true);
      expect(PYTHON_BUILTINS.has('isinstance')).toBe(true);
      expect(PYTHON_BUILTINS.has('open')).toBe(true);
      expect(PYTHON_BUILTINS.has('external_dispatch')).toBe(false);
    });

    it('renders built-in functions as non-clickable badges with (built-in) label', () => {
      render(
        <ASTMetadataInspector
          chunk={sampleChunk}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const builtinBadge = screen.getByTestId('call-builtin-len');
      expect(builtinBadge).toBeInTheDocument();
      expect(builtinBadge).toHaveTextContent('len');
      expect(builtinBadge).toHaveTextContent('built-in');
      expect(builtinBadge.tagName).toBe('SPAN');
    });

    it('renders non-builtin calls as clickable buttons and shows warning if not found locally', async () => {
      const mockSelectCall = vi.fn().mockResolvedValue(false);
      render(
        <ASTMetadataInspector
          chunk={sampleChunk}
          isOpen={true}
          onClose={vi.fn()}
          onSelectCall={mockSelectCall}
        />
      );

      const callBtn = screen.getByTestId('call-badge-external_dispatch');
      expect(callBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(callBtn);
      });

      expect(mockSelectCall).toHaveBeenCalledWith('external_dispatch');

      const notice = await screen.findByTestId('external-call-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(
        "External entity: 'external_dispatch' is not defined locally in this repository."
      );
    });
  });

  describe('5. MessageList Historical Citation Formatting and Selection', () => {
    it('renders citation button and triggers onSelectChunk when clicked', () => {
      const handleSelectChunk = vi.fn();
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Here is your analysis',
          timestamp: '10:00 AM',
          citedChunks: ['historical_file.py:legacy_function:45'],
        },
      ];

      render(
        <MessageList
          messages={messages}
          chunks={[]}
          onSelectChunk={handleSelectChunk}
        />
      );

      const citationBtn = screen.getByTestId(
        'chunk-citation-historical_file.py:legacy_function:45'
      );
      expect(citationBtn).toBeInTheDocument();
      // Should format cleanly to file:function without trailing line numbers
      expect(citationBtn).toHaveTextContent('historical_file.py:legacy_function');

      fireEvent.click(citationBtn);
      expect(handleSelectChunk).toHaveBeenCalledWith(
        'historical_file.py:legacy_function:45'
      );
    });
  });
});
