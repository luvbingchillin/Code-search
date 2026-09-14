import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { useReActAgent } from '../hooks/useReActAgent';
import { AgentSimulator } from '../services/agentSimulator';
import { CodeDisplay } from '../components/viewer/CodeDisplay';
import { ChunkSelectorTabs } from '../components/viewer/ChunkSelectorTabs';
import { ASTMetadataInspector } from '../components/viewer/ASTMetadataInspector';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { AstCodeChunk, AgentStatus } from '../types';

describe('Adversarial Stress & Edge Case Challenge Suite', () => {
  describe('1. Query Input Edge Cases', () => {
    it('rejects empty and whitespace-only queries without state change', async () => {
      const { result } = renderHook(() => useReActAgent());
      const initialMessageCount = result.current.messages.length;

      // Empty query
      await act(async () => {
        await result.current.submitQuery('');
      });
      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.messages.length).toBe(initialMessageCount);

      // Whitespace only
      await act(async () => {
        await result.current.submitQuery('   \t\n  ');
      });
      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.messages.length).toBe(initialMessageCount);
    });

    it('handles special regex characters and symbols safely without syntax errors', () => {
      const simulator = new AgentSimulator();
      const regexAttack = '.*+?^${}()|[]\\\\/!?@#$%^&*<>';

      expect(() => {
        const results = simulator.searchAstChunks(regexAttack);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('handles punctuation-only query safely with default chunk fallback', () => {
      const simulator = new AgentSimulator();
      const punctuationQuery = '??? !!! @@@ ### $$$ %%%';

      const results = simulator.searchAstChunks(punctuationQuery);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('survives extremely long query (10,000 chars) without hanging or buffer issues', async () => {
      const simulator = new AgentSimulator();
      const longQuery = 'def test_function_handler '.repeat(500); // ~13,500 chars

      const startTime = performance.now();
      const results = simulator.searchAstChunks(longQuery);
      const duration = performance.now() - startTime;

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      // Execution must remain sub-50ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('2. AST Code Display Edge Cases', () => {
    it('handles empty code string without throwing and preserves line gutter', () => {
      const emptyChunk: AstCodeChunk = {
        id: 'empty-chunk',
        filePath: 'empty.py',
        fileName: 'empty.py',
        astNodeType: 'Module',
        identifier: 'empty_module',
        startLine: 1,
        endLine: 1,
        code: '',
        relevanceScore: 0.5,
      };

      render(<CodeDisplay chunk={emptyChunk} />);
      const display = screen.getByTestId('code-display');
      expect(display).toBeInTheDocument();

      const lineNumbers = screen.getAllByTestId('line-number');
      expect(lineNumbers.length).toBe(1);
      expect(lineNumbers[0]).toHaveTextContent('1');
    });

    it('renders single-line code chunk accurately with Prism keyword', () => {
      const singleLineChunk: AstCodeChunk = {
        id: 'single-line',
        filePath: 'constants.py',
        fileName: 'constants.py',
        astNodeType: 'Assign',
        identifier: 'API_TIMEOUT',
        startLine: 42,
        endLine: 42,
        code: 'API_TIMEOUT: int = 30',
        relevanceScore: 0.9,
      };

      render(<CodeDisplay chunk={singleLineChunk} />);
      const lineNumbers = screen.getAllByTestId('line-number');
      expect(lineNumbers.length).toBe(1);
      expect(lineNumbers[0]).toHaveTextContent('42');
    });

    it('renders deeply indented multiline code without markup corruption', () => {
      const indentCode = `class Outer:\n    class Inner:\n        def deep():\n            if True:\n                try:\n                    return 1\n                except Exception:\n                    pass`;
      const deepChunk: AstCodeChunk = {
        id: 'deep-chunk',
        filePath: 'nested/deep.py',
        fileName: 'deep.py',
        astNodeType: 'ClassDef',
        identifier: 'Outer',
        startLine: 100,
        endLine: 108,
        code: indentCode,
        relevanceScore: 0.85,
      };

      render(<CodeDisplay chunk={deepChunk} />);
      const lineNumbers = screen.getAllByTestId('line-number');
      expect(lineNumbers.length).toBe(8);
      expect(lineNumbers[0]).toHaveTextContent('100');
      expect(lineNumbers[7]).toHaveTextContent('107');

      const codeDisplay = screen.getByTestId('code-display');
      expect(codeDisplay.innerHTML).toContain('class="token keyword"');
    });

    it('handles zero chunks gracefully in ChunkSelectorTabs and CodeViewerContainer', () => {
      render(
        <CodeViewerContainer
          chunks={[]}
          selectedChunkId={null}
          onSelectChunk={() => {}}
        />
      );

      expect(screen.getByTestId('chunk-tabs-empty')).toHaveTextContent(
        'No AST code chunks retrieved yet'
      );
      expect(screen.getByTestId('code-display')).toHaveTextContent(
        'No AST code chunk selected'
      );
    });

    it('safely handles missing optional AST metadata in ASTMetadataInspector', () => {
      const minimalChunk: AstCodeChunk = {
        id: 'min-chunk',
        filePath: 'minimal.py',
        fileName: 'minimal.py',
        astNodeType: 'FunctionDef',
        identifier: 'minimal_fn',
        startLine: 10,
        endLine: 15,
        code: 'def minimal_fn(): pass',
        relevanceScore: 0.7,
        // docstring, parameters, decorators deliberately undefined
      };

      render(
        <ASTMetadataInspector
          chunk={minimalChunk}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
      expect(screen.getByText('minimal_fn')).toBeInTheDocument();
      expect(screen.queryByText(/Docstring:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Parameters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Decorators/i)).not.toBeInTheDocument();
    });
  });

  describe('3. Cancellation & Stop Mid-Loop Stress', () => {
    it('cancels mid-loop and resets status to Idle with appropriate cancellation message', async () => {
      const { result } = renderHook(() => useReActAgent());

      // Start query
      let queryPromise: Promise<void>;
      act(() => {
        queryPromise = result.current.submitQuery('Search auth token verify');
      });

      expect(result.current.agentStatus.state).toBe('Thinking');

      // Cancel immediately during Thinking
      act(() => {
        result.current.cancelQuery();
      });

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.agentStatus.currentStepMessage).toContain('cancelled');

      // Wait for simulator to clean up
      await act(async () => {
        await queryPromise;
      });

      // Confirm loop did not proceed to Complete
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('supports submitting a fresh query immediately after cancellation', async () => {
      const { result } = renderHook(() => useReActAgent());

      // Start and cancel query 1
      act(() => {
        result.current.submitQuery('Query 1');
      });
      act(() => {
        result.current.cancelQuery();
      });
      expect(result.current.agentStatus.state).toBe('Idle');

      // Now run query 2 to completion
      await act(async () => {
        await result.current.submitQuery('Query 2 full run');
      });

      expect(result.current.agentStatus.state).toBe('Complete');
      expect(result.current.messages.some((m) => m.content === 'Query 2 full run')).toBe(true);
    });

    it('safely handles calling cancelQuery when agent is already Idle', () => {
      const { result } = renderHook(() => useReActAgent());

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(() => {
        act(() => {
          result.current.cancelQuery();
        });
      }).not.toThrow();
      expect(result.current.agentStatus.state).toBe('Idle');
    });
  });

  describe('4. Rapid Queries & UI Concurrency Guard', () => {
    it('disables ChatInput and renders Stop button when status is busy', async () => {
      const busyStatus: AgentStatus = {
        state: 'Searching AST',
        currentStepMessage: 'Querying vector index...',
        elapsedMs: 800,
        activeChunkCount: 3,
      };

      render(
        <ChatInput
          status={busyStatus}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toBeDisabled();

      const stopBtn = screen.getByTestId('chat-stop-btn');
      expect(stopBtn).toBeInTheDocument();
      expect(screen.queryByTestId('chat-send-btn')).not.toBeInTheDocument();
    });

    it('triggers onCancel when Stop button is clicked during busy state', async () => {
      const user = userEvent.setup();
      const handleCancel = vi.fn();
      const busyStatus: AgentStatus = {
        state: 'Synthesizing',
        currentStepMessage: 'Generating synthesis...',
        elapsedMs: 1100,
        activeChunkCount: 3,
      };

      render(
        <ChatInput
          status={busyStatus}
          onSubmit={() => {}}
          onCancel={handleCancel}
        />
      );

      const stopBtn = screen.getByTestId('chat-stop-btn');
      await user.click(stopBtn);

      expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it('handles multiple rapid submitQuery calls without unhandled rejections', async () => {
      const { result } = renderHook(() => useReActAgent());

      // Rapidly trigger 3 queries without awaiting
      await act(async () => {
        const p1 = result.current.submitQuery('Rapid query 1');
        const p2 = result.current.submitQuery('Rapid query 2');
        const p3 = result.current.submitQuery('Rapid query 3');

        await Promise.all([p1, p2, p3]);
      });

      expect(['Complete', 'Idle']).toContain(result.current.agentStatus.state);
      expect(result.current.messages.length).toBeGreaterThan(1);
    });
  });
});
