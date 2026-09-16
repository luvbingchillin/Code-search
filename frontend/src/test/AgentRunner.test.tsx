import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { AgentRunner, normalizeAgentState, getDisplayStateLabel, AgentExecutionStep } from '../components/agent/AgentRunner';
import { ChatPane } from '../components/chat/ChatPane';
import App from '../App';
import { AgentStatus, AstCodeChunk, ChatMessage } from '../types';
import { mockAstChunks } from './fixtures/mockData';

describe('NemoIR AgentRunner Acceptance Suite (AC2)', () => {
  // =========================================================================
  // SUITE 1: DOM Mounting & Root Element Verification
  // =========================================================================
  describe('1. DOM Mounting & Element Verification', () => {
    it('successfully mounts in the React DOM with data-testid="agent-runner"', () => {
      render(<AgentRunner />);
      const runner = screen.getByTestId('agent-runner');
      expect(runner).toBeInTheDocument();
    });

    it('mounts cleanly when passed standard AgentStatus object', () => {
      const status: AgentStatus = {
        state: 'Idle',
        currentStepMessage: 'Ready to query codebase via Edge AI',
        elapsedMs: 0,
        activeChunkCount: 3,
      };
      render(<AgentRunner status={status} />);
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-badge')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
    });

    it('renders controls bar and trace toggle button', () => {
      render(<AgentRunner />);
      expect(screen.getByTestId('agent-controls')).toBeInTheDocument();
      expect(screen.getByTestId('agent-toggle-traces-btn')).toBeInTheDocument();
    });

    it('applies custom className to the runner container', () => {
      render(<AgentRunner className="custom-test-runner-class" />);
      const runner = screen.getByTestId('agent-runner');
      expect(runner).toHaveClass('custom-test-runner-class');
    });
  });

  // =========================================================================
  // SUITE 2: ReAct Loop State Transitions & Normalization
  // =========================================================================
  describe('2. ReAct Loop States Verification', () => {
    it('renders Idle state with idle badge and readiness message', () => {
      render(<AgentRunner state="idle" currentStepMessage="System ready for AST search" />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('System ready for AST search');
    });

    it('renders Thinking state with thinking badge and active planning step', () => {
      render(
        <AgentRunner
          state="thinking"
          currentStepMessage="Analyzing query intent and planning retrieval steps..."
          elapsedMs={350}
        />
      );
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Thinking');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('Analyzing query intent');
      expect(screen.getByTestId('agent-elapsed-time')).toBeInTheDocument();
    });

    it('renders Searching state with search badge and chunk count', () => {
      render(
        <AgentRunner
          state="searching"
          currentStepMessage="Querying vector index for AST nodes..."
          activeChunkCount={5}
          elapsedMs={800}
        />
      );
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Searching AST');
      expect(screen.getByTestId('agent-chunk-count')).toHaveTextContent('5 chunks');
    });

    it('renders Synthesizing state with synthesizing badge and token stream placeholder', () => {
      render(
        <AgentRunner
          state="synthesizing"
          currentStepMessage="Synthesizing response via WebLLM SLM engine..."
          elapsedMs={1200}
        />
      );
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Synthesizing');
      expect(screen.getByTestId('agent-streaming-output')).toBeInTheDocument();
      expect(screen.getByTestId('agent-streaming-placeholder')).toBeInTheDocument();
    });

    it('renders Complete state with complete badge and marks all steps completed', () => {
      render(
        <AgentRunner
          state="complete"
          currentStepMessage="Search completed successfully in 1.4s"
          elapsedMs={1400}
          activeChunkCount={3}
        />
      );
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Complete');
      const stepStatuses = screen.getAllByTestId('agent-step-status');
      stepStatuses.forEach((badge) => {
        expect(badge).toHaveTextContent('completed');
      });
    });

    it('renders Error state with error badge, error banner, and detailed message', () => {
      render(
        <AgentRunner
          state="error"
          error="WebGPU shader compilation failed: Out of memory"
          elapsedMs={500}
        />
      );
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Error');
      expect(screen.getByTestId('agent-error-banner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-error-message')).toHaveTextContent(
        'WebGPU shader compilation failed: Out of memory'
      );
    });

    it('normalizes lowercase and capitalized ReAct state strings correctly', () => {
      expect(normalizeAgentState('idle')).toBe('idle');
      expect(normalizeAgentState('Idle')).toBe('idle');
      expect(normalizeAgentState('thinking')).toBe('thinking');
      expect(normalizeAgentState('Thinking')).toBe('thinking');
      expect(normalizeAgentState('searching')).toBe('searching');
      expect(normalizeAgentState('Searching AST')).toBe('searching');
      expect(normalizeAgentState('searching ast')).toBe('searching');
      expect(normalizeAgentState('synthesizing')).toBe('synthesizing');
      expect(normalizeAgentState('Synthesizing')).toBe('synthesizing');
      expect(normalizeAgentState('complete')).toBe('complete');
      expect(normalizeAgentState('Complete')).toBe('complete');
      expect(normalizeAgentState('error')).toBe('error');
      expect(normalizeAgentState('Error')).toBe('error');
      expect(normalizeAgentState('unknown-state')).toBe('idle');
      expect(normalizeAgentState(undefined)).toBe('idle');

      expect(getDisplayStateLabel('idle')).toBe('Idle');
      expect(getDisplayStateLabel('thinking')).toBe('Thinking');
      expect(getDisplayStateLabel('searching')).toBe('Searching AST');
      expect(getDisplayStateLabel('synthesizing')).toBe('Synthesizing');
      expect(getDisplayStateLabel('complete')).toBe('Complete');
      expect(getDisplayStateLabel('error')).toBe('Error');
    });

    it('transitions sequentially across all states when rerendered', () => {
      const { rerender } = render(<AgentRunner state="idle" />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      rerender(<AgentRunner state="thinking" elapsedMs={200} />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Thinking');

      rerender(<AgentRunner state="searching" elapsedMs={600} activeChunkCount={2} />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Searching AST');

      rerender(<AgentRunner state="synthesizing" elapsedMs={1100} />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Synthesizing');

      rerender(<AgentRunner state="complete" elapsedMs={1300} />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Complete');
    });
  });

  // =========================================================================
  // SUITE 3: Streaming Tokens Display & Real-Time Generation
  // =========================================================================
  describe('3. Token Streaming Display & Live Stream Rendering', () => {
    it('renders streaming tokens output container and exact text content', () => {
      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="def verify_jwt_token(token: str) -> dict:"
        />
      );

      const output = screen.getByTestId('agent-streaming-output');
      expect(output).toBeInTheDocument();

      const tokens = screen.getByTestId('agent-streaming-tokens');
      expect(tokens).toHaveTextContent('def verify_jwt_token(token: str) -> dict:');
    });

    it('displays blinking cursor during active token generation', () => {
      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="Fetching AST node for solve_dependencies"
        />
      );

      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
    });

    it('does NOT display blinking cursor when state is complete', () => {
      render(
        <AgentRunner
          state="complete"
          streamingTokens="Synthesized output finished."
        />
      );

      expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
    });

    it('calculates and displays word/token count in streaming header', () => {
      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="The solve_dependencies function coordinates multi-hop parameter resolution."
        />
      );

      expect(screen.getByTestId('agent-token-count')).toHaveTextContent('7 tokens');
    });

    it('updates dynamically as tokens stream in incrementally', () => {
      const { rerender } = render(
        <AgentRunner state="synthesizing" streamingTokens="Token 1" />
      );
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent('Token 1');

      rerender(<AgentRunner state="synthesizing" streamingTokens="Token 1 Token 2" />);
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent('Token 1 Token 2');

      rerender(<AgentRunner state="synthesizing" streamingTokens="Token 1 Token 2 Token 3" />);
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent('Token 1 Token 2 Token 3');
    });

    it('safely handles hostile HTML and script tags in streaming tokens without XSS', () => {
      const hostilePayload = `<script>alert('xss')</script> & 5 < 10 && "quoted"`;
      const { container } = render(
        <AgentRunner state="synthesizing" streamingTokens={hostilePayload} />
      );

      expect(container.querySelectorAll('script').length).toBe(0);
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(hostilePayload);
    });

    it('handles large streaming payloads (1,000 words) without memory overflow or markup corruption', () => {
      const largePayload = 'Python AST chunk retrieval '.repeat(200);
      render(<AgentRunner state="synthesizing" streamingTokens={largePayload} />);

      const tokenEl = screen.getByTestId('agent-streaming-tokens');
      expect(tokenEl.textContent?.length).toBeGreaterThan(5000);
      expect(screen.getByTestId('agent-token-count')).toHaveTextContent('800 tokens');
    });
  });

  // =========================================================================
  // SUITE 4: Step List & Execution Traces
  // =========================================================================
  describe('4. Step List & Execution Traces', () => {
    it('renders the step list container and default ReAct steps', () => {
      render(<AgentRunner state="thinking" />);
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();

      const items = screen.getAllByTestId('agent-step-item');
      expect(items.length).toBe(4);

      // Default step titles
      expect(screen.getByText('Intent & Planning')).toBeInTheDocument();
      expect(screen.getByText('AST Vector Search')).toBeInTheDocument();
      expect(screen.getByText('WebLLM Synthesis')).toBeInTheDocument();
      expect(screen.getByText('Response Verified')).toBeInTheDocument();
    });

    it('highlights running step in Thinking state', () => {
      render(<AgentRunner state="thinking" />);
      const stepNames = screen.getAllByTestId('agent-step-item');
      expect(stepNames[0]).toHaveTextContent('Intent & Planning');
      expect(stepNames[0]).toHaveTextContent('running');
    });

    it('highlights running step in Searching state and marks previous step completed', () => {
      render(<AgentRunner state="searching" activeChunkCount={2} />);
      const steps = screen.getAllByTestId('agent-step-item');
      expect(steps[0]).toHaveTextContent('completed');
      expect(steps[1]).toHaveTextContent('running');
      expect(steps[2]).toHaveTextContent('pending');
    });

    it('renders custom execution steps when provided via steps prop', () => {
      const customSteps: AgentExecutionStep[] = [
        { id: 'step-tree-sitter', name: 'Tree-sitter AST Parse', status: 'completed' },
        { id: 'step-vector-search', name: 'LanceDB Hybrid Search', status: 'running', message: 'K=5 retrieved' },
        { id: 'step-qwen-inference', name: 'Qwen2.5-Coder Synthesis', status: 'pending' },
      ];

      render(<AgentRunner steps={customSteps} />);
      const items = screen.getAllByTestId('agent-step-item');
      expect(items.length).toBe(3);

      expect(screen.getByText('Tree-sitter AST Parse')).toBeInTheDocument();
      expect(screen.getByText('LanceDB Hybrid Search')).toBeInTheDocument();
      expect(screen.getByText('Qwen2.5-Coder Synthesis')).toBeInTheDocument();
    });

    it('toggles expandable body when clicking the toggle button', async () => {
      const user = userEvent.setup();
      render(<AgentRunner state="thinking" />);

      // Initially expanded
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();

      // Click toggle to collapse
      const toggleBtn = screen.getByTestId('agent-toggle-traces-btn');
      await user.click(toggleBtn);

      // Collapsed: steps list hidden
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();

      // Click toggle to expand again
      await user.click(toggleBtn);
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();
    });

    it('renders timeline items via WorkflowTraceDrawer when timeline is provided', () => {
      const testTimeline = [
        {
          kind: 'event' as const,
          seq: 1,
          event: {
            kind: 'stage_started' as const,
            runId: 'run-1',
            sequence: 1,
            timestamp: new Date().toISOString(),
            stageId: 'Thinking',
          },
        },
        {
          kind: 'delta_run' as const,
          firstSeq: 2,
          lastSeq: 3,
          stageId: 'Synthesizing',
          channel: 'assistant' as const,
          text: 'Generated synthesis token sequence',
        },
      ];

      render(<AgentRunner timeline={testTimeline} />);
      expect(screen.getByTestId('agent-trace-drawer')).toBeInTheDocument();
      expect(screen.getByText('Generated synthesis token sequence')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 5: Controls & User Interaction
  // =========================================================================
  describe('5. Controls & User Interactions', () => {
    it('renders Stop button during busy states and invokes onCancel on click', async () => {
      const user = userEvent.setup();
      const handleCancel = vi.fn();

      render(
        <AgentRunner
          state="thinking"
          onCancel={handleCancel}
        />
      );

      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      expect(cancelBtn).toBeInTheDocument();

      await user.click(cancelBtn);
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it('does NOT render Stop button when state is Idle or Complete', () => {
      const handleCancel = vi.fn();

      const { rerender } = render(
        <AgentRunner state="idle" onCancel={handleCancel} />
      );
      expect(screen.queryByTestId('agent-cancel-btn')).not.toBeInTheDocument();

      rerender(<AgentRunner state="complete" onCancel={handleCancel} />);
      expect(screen.queryByTestId('agent-cancel-btn')).not.toBeInTheDocument();
    });

    it('renders Reset button when complete or error and invokes onReset on click', async () => {
      const user = userEvent.setup();
      const handleReset = vi.fn();

      const { rerender } = render(
        <AgentRunner state="complete" onReset={handleReset} />
      );

      const resetBtn = screen.getByTestId('agent-reset-btn');
      expect(resetBtn).toBeInTheDocument();

      await user.click(resetBtn);
      expect(handleReset).toHaveBeenCalledTimes(1);

      rerender(<AgentRunner state="error" onReset={handleReset} />);
      const errorResetBtn = screen.getByTestId('agent-reset-btn');
      await user.click(errorResetBtn);
      expect(handleReset).toHaveBeenCalledTimes(2);
    });

    it('displays formatted elapsed timer when elapsedMs > 0', () => {
      render(<AgentRunner state="thinking" elapsedMs={2750} />);
      expect(screen.getByTestId('agent-elapsed-time')).toBeInTheDocument();
      expect(screen.getByTestId('agent-elapsed-timer')).toHaveTextContent('2.8s');
    });

    it('displays active chunks count badge when chunkCount > 0', () => {
      render(<AgentRunner state="searching" activeChunkCount={4} />);
      expect(screen.getByTestId('agent-chunk-count')).toBeInTheDocument();
      expect(screen.getByTestId('agent-active-chunks')).toHaveTextContent('4 chunks');
    });
  });

  // =========================================================================
  // SUITE 6: Integration in ChatPane & Full App
  // =========================================================================
  describe('6. ChatPane & App Integration', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Welcome to CodeSeek AI!',
        timestamp: '12:00 PM',
      },
    ];

    it('mounts AgentRunner with data-testid="agent-runner" inside ChatPane', () => {
      const status: AgentStatus = {
        state: 'Idle',
        currentStepMessage: 'Ready',
        elapsedMs: 0,
        activeChunkCount: 2,
      };

      render(
        <ChatPane
          status={status}
          messages={mockMessages}
          chunks={mockAstChunks}
          onSelectChunk={() => {}}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-badge')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
    });

    it('updates AgentRunner dynamically when ChatPane status prop updates', () => {
      const idleStatus: AgentStatus = {
        state: 'Idle',
        currentStepMessage: 'System ready',
        elapsedMs: 0,
        activeChunkCount: 2,
      };

      const { rerender } = render(
        <ChatPane
          status={idleStatus}
          messages={mockMessages}
          chunks={mockAstChunks}
          onSelectChunk={() => {}}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      // Update to Thinking
      const thinkingStatus: AgentStatus = {
        state: 'Thinking',
        currentStepMessage: 'Analyzing AST query',
        elapsedMs: 300,
        activeChunkCount: 2,
      };

      rerender(
        <ChatPane
          status={thinkingStatus}
          messages={mockMessages}
          chunks={mockAstChunks}
          onSelectChunk={() => {}}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Thinking');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('Analyzing AST query');
    });

    it('passes streamingTokens from ChatPane into AgentRunner', () => {
      const synthStatus: AgentStatus = {
        state: 'Synthesizing',
        currentStepMessage: 'Synthesizing solution',
        elapsedMs: 1200,
        activeChunkCount: 2,
      };

      render(
        <ChatPane
          status={synthStatus}
          messages={mockMessages}
          chunks={mockAstChunks}
          onSelectChunk={() => {}}
          onSubmit={() => {}}
          onCancel={() => {}}
          streamingTokens="def solve_dependencies(): pass"
        />
      );

      expect(screen.getByTestId('agent-streaming-output')).toBeInTheDocument();
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(
        'def solve_dependencies(): pass'
      );
    });

    it('mounts AgentRunner in full App component tree alongside all panes', () => {
      render(<App />);

      // AgentRunner in the DOM
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-badge')).toBeInTheDocument();

      // All existing core panes and components remain present with 0 regressions
      expect(screen.getByTestId('split-pane-layout')).toBeInTheDocument();
      expect(screen.getByTestId('chat-pane')).toBeInTheDocument();
      expect(screen.getByTestId('code-viewer-pane')).toBeInTheDocument();
      expect(screen.getByTestId('agentic-loop-banner')).toBeInTheDocument();
      expect(screen.getByTestId('chat-input-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('chat-send-btn')).toBeInTheDocument();
      expect(screen.getByTestId('code-display')).toBeInTheDocument();
    });

    it('triggers AgentRunner transition when query is submitted in full App', async () => {
      const user = userEvent.setup();
      render(<App />);

      const runner = screen.getByTestId('agent-runner');
      expect(runner).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      // Submit query
      const input = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');

      await user.type(input, 'Find JWT token validation');
      await user.click(sendBtn);

      // AgentRunner transitions to active state
      expect(screen.getByTestId('agent-status-label')).not.toHaveTextContent('Idle');
    });
  });
});
