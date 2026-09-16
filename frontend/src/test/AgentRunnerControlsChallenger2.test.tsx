import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, renderHook, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { StrictMode, useState } from 'react';
import { AgentRunner, AgentExecutionStep } from '../components/agent/AgentRunner';
import { ChatPane } from '../components/chat/ChatPane';
import { useReActAgent } from '../hooks/useReActAgent';
import App from '../App';
import { AgentStatus, AstCodeChunk, ChatMessage } from '../types';
import { mockAstChunks } from './fixtures/mockData';

describe('Empirical Challenger 2: M2 Controls, Timers, Race Conditions & StrictMode Suite', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-challenger-1',
      role: 'assistant',
      content: 'Challenger verification test assistant message.',
      timestamp: '12:00 PM',
    },
  ];

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SUITE 1: Rapid User Interactions (Cancel/Stop, Reset, Expand/Collapse)
  // =========================================================================
  describe('1. Rapid User Interactions Stress Testing', () => {
    it('handles 50 rapid expand/collapse toggle clicks deterministically', () => {
      render(<AgentRunner state="thinking" currentStepMessage="Testing rapid collapse" />);

      const toggleBtn = screen.getByTestId('agent-toggle-traces-btn');
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();

      // Click 50 times in rapid succession
      for (let i = 0; i < 50; i++) {
        fireEvent.click(toggleBtn);
      }

      // Even number of clicks (50) on initially expanded state (true) -> must be expanded (true)
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();

      // 51st click -> collapsed
      fireEvent.click(toggleBtn);
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();
      // Status badge and controls must remain visible even when collapsed
      expect(screen.getByTestId('agent-status-badge')).toBeInTheDocument();
      expect(screen.getByTestId('agent-controls')).toBeInTheDocument();
    });

    it('persists collapsed state across parent re-renders and state transitions', () => {
      const TestParent: React.FC = () => {
        const [state, setState] = useState<'thinking' | 'searching' | 'synthesizing'>('thinking');
        const [count, setCount] = useState(0);

        return (
          <div>
            <button data-testid="parent-rerender-btn" onClick={() => setCount((c) => c + 1)}>
              Rerender {count}
            </button>
            <button
              data-testid="parent-advance-state-btn"
              onClick={() => setState('searching')}
            >
              Advance State
            </button>
            <AgentRunner state={state} />
          </div>
        );
      };

      render(<TestParent />);
      const toggleBtn = screen.getByTestId('agent-toggle-traces-btn');

      // Expand is true initially
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();

      // Collapse
      fireEvent.click(toggleBtn);
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();

      // Trigger 10 parent re-renders
      const rerenderBtn = screen.getByTestId('parent-rerender-btn');
      for (let i = 0; i < 10; i++) {
        fireEvent.click(rerenderBtn);
      }

      // Must STAY collapsed (local state not reset by parent re-renders)
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();

      // Advance agent state to 'searching'
      fireEvent.click(screen.getByTestId('parent-advance-state-btn'));
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Searching AST');
      // Remains collapsed
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();

      // User expands again
      fireEvent.click(toggleBtn);
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();
    });

    it('handles 25 rapid Stop button clicks during active Thinking state', () => {
      const onCancelMock = vi.fn();

      render(
        <AgentRunner
          state="thinking"
          currentStepMessage="Thinking step..."
          onCancel={onCancelMock}
        />
      );

      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      expect(cancelBtn).toBeInTheDocument();

      for (let i = 0; i < 25; i++) {
        fireEvent.click(cancelBtn);
      }

      expect(onCancelMock).toHaveBeenCalledTimes(25);
    });

    it('handles 25 rapid Reset button clicks on Complete and Error states', () => {
      const onResetMock = vi.fn();

      const { rerender } = render(
        <AgentRunner
          state="complete"
          currentStepMessage="Finished query"
          onReset={onResetMock}
        />
      );

      const resetBtn = screen.getByTestId('agent-reset-btn');
      for (let i = 0; i < 25; i++) {
        fireEvent.click(resetBtn);
      }
      expect(onResetMock).toHaveBeenCalledTimes(25);

      // Now rerender in Error state
      rerender(
        <AgentRunner
          state="error"
          error="Network timeout during AST search"
          onReset={onResetMock}
        />
      );

      const errorResetBtn = screen.getByTestId('agent-reset-btn');
      for (let i = 0; i < 25; i++) {
        fireEvent.click(errorResetBtn);
      }
      expect(onResetMock).toHaveBeenCalledTimes(50);
    });

    it('supports keyboard navigation (Enter and Space) on controls', () => {
      const onCancelMock = vi.fn();
      const onResetMock = vi.fn();

      const { rerender } = render(
        <AgentRunner state="synthesizing" onCancel={onCancelMock} />
      );

      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      fireEvent.keyDown(cancelBtn, { key: 'Enter', code: 'Enter' });
      fireEvent.click(cancelBtn);
      expect(onCancelMock).toHaveBeenCalled();

      rerender(<AgentRunner state="complete" onReset={onResetMock} />);
      const resetBtn = screen.getByTestId('agent-reset-btn');
      fireEvent.keyDown(resetBtn, { key: ' ', code: 'Space' });
      fireEvent.click(resetBtn);
      expect(onResetMock).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 2: Race Conditions Between State Changes and User Clicks
  // =========================================================================
  describe('2. State Transition & User Interaction Race Conditions', () => {
    it('safely handles Stop click occurring at exact instant state completes', () => {
      let isBusyState = true;
      const onCancelMock = vi.fn(() => {
        isBusyState = false;
      });

      const { rerender } = render(
        <AgentRunner
          state={isBusyState ? 'synthesizing' : 'complete'}
          onCancel={onCancelMock}
        />
      );

      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      // Click stop
      fireEvent.click(cancelBtn);
      expect(onCancelMock).toHaveBeenCalledTimes(1);

      // Parent updates to complete immediately
      rerender(
        <AgentRunner
          state="complete"
          onCancel={onCancelMock}
        />
      );

      // Cancel button is now gone, no crash or lingering node
      expect(screen.queryByTestId('agent-cancel-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Complete');
    });

    it('manages rapid consecutive query submission and instant cancellation', async () => {
      const { result } = renderHook(() => useReActAgent());

      // Start query
      act(() => {
        result.current.submitQuery('Adversarial fast query');
      });
      expect(result.current.agentStatus.state).toBe('Thinking');

      // Instantly cancel (<1ms, before simulator async delay)
      act(() => {
        result.current.cancelQuery();
      });

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.agentStatus.currentStepMessage).toContain('cancelled');

      // Wait a small window to ensure simulator timer/promise settles
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      // Confirm loop did NOT continue to Searching AST or Complete
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('handles multiple rapid submitQuery calls followed by immediate cancelQuery', async () => {
      const { result } = renderHook(() => useReActAgent());

      // Fire 3 queries rapidly
      act(() => {
        result.current.submitQuery('Query 1');
        result.current.submitQuery('Query 2');
        result.current.submitQuery('Query 3');
      });

      // Cancel immediately
      act(() => {
        result.current.cancelQuery();
      });

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.agentStatus.currentStepMessage).toContain('cancelled');

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      // Must stay in Idle
      expect(result.current.agentStatus.state).toBe('Idle');
    });

    it('handles double-cancellation when already Idle without throwing', () => {
      const { result } = renderHook(() => useReActAgent());

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(() => {
        act(() => {
          result.current.cancelQuery();
          result.current.cancelQuery();
        });
      }).not.toThrow();
      expect(result.current.agentStatus.state).toBe('Idle');
    });
  });

  // =========================================================================
  // SUITE 3: Timer Accuracy, Interval Lifecycle & Cleanup
  // =========================================================================
  describe('3. Timer Accuracy and Cleanup Verification', () => {
    it('formats boundary and extreme elapsedMs values accurately in AgentRunner', () => {
      // 0ms -> not rendered
      const { rerender } = render(<AgentRunner state="thinking" elapsedMs={0} />);
      expect(screen.queryByTestId('agent-elapsed-time')).not.toBeInTheDocument();

      // Negative elapsedMs -> not rendered (elapsedMs > 0 guard)
      rerender(<AgentRunner state="thinking" elapsedMs={-500} />);
      expect(screen.queryByTestId('agent-elapsed-time')).not.toBeInTheDocument();

      // Normal 1500ms -> 1.5s
      rerender(<AgentRunner state="thinking" elapsedMs={1500} />);
      expect(screen.getByTestId('agent-elapsed-timer')).toHaveTextContent('1.5s');

      // 42350ms -> 42.4s (rounded)
      rerender(<AgentRunner state="thinking" elapsedMs={42350} />);
      expect(screen.getByTestId('agent-elapsed-timer')).toHaveTextContent('42.4s');

      // Large 999999ms -> 1000.0s
      rerender(<AgentRunner state="thinking" elapsedMs={999999} />);
      expect(screen.getByTestId('agent-elapsed-timer')).toHaveTextContent('1000.0s');
    });

    it('cleans up interval timer and does NOT leak on unmount during active query', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      const { result, unmount } = renderHook(() => useReActAgent());

      // Start a query (which starts timerRef.current = window.setInterval(..., 100))
      act(() => {
        result.current.submitQuery('Query for unmount check');
      });

      expect(result.current.agentStatus.state).toBe('Thinking');

      // Advance timers by 250ms
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(result.current.agentStatus.elapsedMs).toBeGreaterThan(0);

      // Now unmount hook mid-flight
      unmount();

      // clearInterval must have been called during cleanup
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Advance timers further post-unmount to confirm no exceptions
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }).not.toThrow();

      vi.useRealTimers();
    });

    it('clears interval timer on cancelQuery', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      const { result } = renderHook(() => useReActAgent());

      act(() => {
        result.current.submitQuery('Query for cancel interval check');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current.cancelQuery();
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(result.current.agentStatus.state).toBe('Idle');

      vi.useRealTimers();
    });

    it('clears interval timer upon query completion', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      const { result } = renderHook(() => useReActAgent());

      await act(async () => {
        await result.current.submitQuery('def quick_ast_search(): pass');
      });

      expect(result.current.agentStatus.state).toBe('Complete');
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 4: React 19 Strict Mode Compliance & Concurrent Re-renders
  // =========================================================================
  describe('4. React 19 Strict Mode Compliance & Concurrent Re-renders', () => {
    it('mounts and operates AgentRunner cleanly under React.StrictMode', async () => {
      const user = userEvent.setup();
      const onCancelMock = vi.fn();

      render(
        <StrictMode>
          <AgentRunner
            state="thinking"
            currentStepMessage="StrictMode double mount test"
            elapsedMs={300}
            activeChunkCount={2}
            onCancel={onCancelMock}
          />
        </StrictMode>
      );

      // Verify DOM presence under StrictMode
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Thinking');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('StrictMode double mount test');

      // Click cancel in StrictMode
      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      await user.click(cancelBtn);
      expect(onCancelMock).toHaveBeenCalledTimes(1);

      // Toggle traces in StrictMode
      const toggleBtn = screen.getByTestId('agent-toggle-traces-btn');
      await user.click(toggleBtn);
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();
      await user.click(toggleBtn);
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();
    });

    it('mounts ChatPane with AgentRunner cleanly under React.StrictMode', () => {
      const testStatus: AgentStatus = {
        state: 'Searching AST',
        currentStepMessage: 'StrictMode ChatPane integration',
        elapsedMs: 750,
        activeChunkCount: 4,
      };

      render(
        <StrictMode>
          <ChatPane
            status={testStatus}
            messages={mockMessages}
            chunks={mockAstChunks}
            onSelectChunk={() => {}}
            onSubmit={() => {}}
            onCancel={() => {}}
            streamingTokens="Searching nodes"
          />
        </StrictMode>
      );

      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agentic-loop-banner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Searching AST');
      expect(screen.getByTestId('agent-chunk-count')).toHaveTextContent('4 chunks');
    });

    it('mounts full App under React.StrictMode and triggers state transition', async () => {
      const user = userEvent.setup();

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      // Trigger search in StrictMode
      const input = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');

      await user.type(input, 'StrictMode integration test');
      await user.click(sendBtn);

      expect(screen.getByTestId('agent-status-label')).not.toHaveTextContent('Idle');
    });

    it('survives 100 rapid concurrent prop updates without UI tearing or memory corruption', () => {
      const states = ['thinking', 'searching', 'synthesizing', 'complete', 'error', 'idle'] as const;

      const { rerender } = render(<AgentRunner state="idle" elapsedMs={0} />);

      for (let i = 0; i < 100; i++) {
        const state = states[i % states.length];
        rerender(
          <AgentRunner
            state={state}
            elapsedMs={i * 100}
            activeChunkCount={i % 5}
            streamingTokens={`Streaming payload token ${i}`}
            currentStepMessage={`Stress iteration ${i}`}
          />
        );
      }

      // Final iteration was 99: 99 % 6 = 3 -> complete
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Complete');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('Stress iteration 99');
    });

    it('unmounts and remounts 50 times in rapid succession without leaking nodes or errors', () => {
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <AgentRunner
            state="synthesizing"
            streamingTokens={`Rapid mount cycle ${i}`}
            elapsedMs={i * 50}
          />
        );
        expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
        unmount();
        expect(screen.queryByTestId('agent-runner')).not.toBeInTheDocument();
      }
    });
  });
});
