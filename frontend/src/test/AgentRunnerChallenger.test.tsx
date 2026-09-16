import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import {
  AgentRunner,
  normalizeAgentState,
  getDisplayStateLabel,
  AgentExecutionStep,
  NormalizedAgentState,
} from '../components/agent/AgentRunner';
import { AgentStatus, AstCodeChunk } from '../types';
import type { CoalescedTimelineItem } from '@nemoir/web-ui';

describe('Empirical Challenger: AgentRunner Adversarial Stress & Edge Cases', () => {
  // =========================================================================
  // SUITE 1: Rapid State Cycling & Concurrency Stress
  // =========================================================================
  describe('1. Rapid State Cycling & High-Frequency Transitions', () => {
    it('survives 36 rapid sequential state transitions (6 complete ReAct cycles) without DOM corruption or memory leaks', () => {
      const states: Array<{ state: string; label: string; busy: boolean }> = [
        { state: 'idle', label: 'Idle', busy: false },
        { state: 'thinking', label: 'Thinking', busy: true },
        { state: 'searching', label: 'Searching AST', busy: true },
        { state: 'synthesizing', label: 'Synthesizing', busy: true },
        { state: 'complete', label: 'Complete', busy: false },
        { state: 'error', label: 'Error', busy: false },
      ];

      const { rerender } = render(<AgentRunner state="idle" />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      // Execute 36 rapid transitions (6 full cycles through all states)
      for (let i = 0; i < 36; i++) {
        const target = states[i % states.length];
        rerender(
          <AgentRunner
            state={target.state}
            elapsedMs={i * 50}
            activeChunkCount={target.busy ? (i % 5) + 1 : 0}
            error={target.state === 'error' ? `Simulated failure at cycle ${i}` : undefined}
          />
        );

        const label = screen.getByTestId('agent-status-label');
        expect(label).toHaveTextContent(target.label);

        if (target.state === 'error') {
          expect(screen.getByTestId('agent-error-banner')).toBeInTheDocument();
          expect(screen.getByTestId('agent-error-message')).toHaveTextContent(
            `Simulated failure at cycle ${i}`
          );
        }
      }

      // Re-normalize to idle
      rerender(<AgentRunner state="idle" />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
    }, 30000);

    it('survives chaotic non-linear state jumps (synthesizing -> idle -> error -> searching)', () => {
      const chaoticSequence = [
        'synthesizing',
        'idle',
        'error',
        'searching',
        'complete',
        'thinking',
        'error',
        'idle',
        'complete',
      ];

      const { rerender } = render(<AgentRunner state="idle" />);

      for (const st of chaoticSequence) {
        rerender(
          <AgentRunner
            state={st}
            error={st === 'error' ? 'Chaos test error' : undefined}
            currentStepMessage={`State transition to ${st}`}
          />
        );

        const expectedLabel = getDisplayStateLabel(normalizeAgentState(st));
        expect(screen.getByTestId('agent-status-label')).toHaveTextContent(expectedLabel);
        expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      }
    });

    it('handles user cancellation triggered during rapid state shifts', async () => {
      const user = userEvent.setup();
      const cancelSpy = vi.fn();

      const { rerender } = render(
        <AgentRunner state="thinking" onCancel={cancelSpy} />
      );

      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      await user.click(cancelBtn);
      expect(cancelSpy).toHaveBeenCalledTimes(1);

      // Immediately transition to searching and click cancel again
      rerender(<AgentRunner state="searching" onCancel={cancelSpy} />);
      const cancelBtn2 = screen.getByTestId('agent-cancel-btn');
      await user.click(cancelBtn2);
      expect(cancelSpy).toHaveBeenCalledTimes(2);

      // Transition to complete -> cancel button is removed, reset appears
      const resetSpy = vi.fn();
      rerender(<AgentRunner state="complete" onReset={resetSpy} />);
      expect(screen.queryByTestId('agent-cancel-btn')).not.toBeInTheDocument();
      const resetBtn = screen.getByTestId('agent-reset-btn');
      await user.click(resetBtn);
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SUITE 2: Extreme Streaming Tokens & High Payload Stress
  // =========================================================================
  describe('2. Extreme Streaming Tokens & High Payload Stress', () => {
    it('handles massive token streams (10,000 words / 80,000+ characters) without DoS or crash', () => {
      // Build a 10,000-word payload
      const wordChunk = 'ast_token_retrieval ';
      const massivePayload = wordChunk.repeat(10000);

      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens={massivePayload}
        />
      );

      const streamEl = screen.getByTestId('agent-streaming-tokens');
      expect(streamEl.textContent?.length).toBeGreaterThan(80000);

      // Token counter parses accurately
      const countEl = screen.getByTestId('agent-token-count');
      expect(countEl).toHaveTextContent('10000 tokens');
    });

    it('handles extreme whitespace combinations without regex catastrophic backtracking', () => {
      // 20,000 mixed whitespace characters
      const whitespaceChaos = '   \t\t\r\n   \n\r  '.repeat(2000) + 'valid_token' + ' \t\n '.repeat(1000);

      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens={whitespaceChaos}
        />
      );

      const countEl = screen.getByTestId('agent-token-count');
      expect(countEl).toHaveTextContent('1 tokens');
    });

    it('renders complex Unicode, multi-byte emojis, ZWJ sequences, and RTL text correctly', () => {
      const unicodePayload = [
        '🚀 Multi-Rocket: 🚀🚀🚀',
        '👨‍💻 ZWJ Technologist & 🏳️‍🌈 Flag',
        'Chinese: 递归抽象语法树检索',
        'Japanese: 抽象構文木インデックス検索',
        'Arabic (RTL): البحث في شجرة البنية المجردة',
        'Devanagari: प्रोग्रामिंग भाषा पार्सिंग',
        'Special Symbols: ∑ ∏ ∫ √ ≠ ≈ ≤ ≥ ⌘ ⌥ ⎋ ⏎',
      ].join('\n');

      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens={unicodePayload}
        />
      );

      const streamEl = screen.getByTestId('agent-streaming-tokens');
      expect(streamEl.textContent).toContain('🚀 Multi-Rocket');
      expect(streamEl.textContent).toContain('👨‍💻 ZWJ Technologist & 🏳️‍🌈 Flag');
      expect(streamEl.textContent).toContain('递归抽象语法树检索');
      expect(streamEl.textContent).toContain('البحث في شجرة البنية المجردة');
      expect(streamEl.textContent).toContain('∑ ∏ ∫ √');
    });

    it('sanitizes hostile script injections and HTML attributes without execution (XSS defense)', () => {
      const xssAttacks = [
        '<script>window.__xss_attack_triggered__ = true;</script>',
        '<img src="invalid-image.png" onerror="window.__xss_attack_triggered__ = true" />',
        '<svg onload="window.__xss_attack_triggered__ = true"></svg>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '"><script>alert(document.cookie)</script>',
      ].join(' ');

      const { container } = render(
        <AgentRunner
          state="synthesizing"
          streamingTokens={xssAttacks}
        />
      );

      // Verify no injected elements were inserted as live DOM elements
      expect(container.querySelectorAll('script')).toHaveLength(0);
      expect(container.querySelectorAll('img')).toHaveLength(0);
      expect(container.querySelectorAll('iframe')).toHaveLength(0);
      expect((window as any).__xss_attack_triggered__).toBeUndefined();

      // Content safely rendered as plain text
      const streamEl = screen.getByTestId('agent-streaming-tokens');
      expect(streamEl.textContent).toContain('<script>');
    });

    it('simulates 150 consecutive rapid token stream updates (incremental SLM generation)', () => {
      const { rerender } = render(
        <AgentRunner state="synthesizing" streamingTokens="" />
      );

      // Initially empty streamingTokens in synthesizing state displays placeholder
      expect(screen.getByTestId('agent-streaming-placeholder')).toBeInTheDocument();

      let accumulated = '';
      for (let i = 1; i <= 150; i++) {
        accumulated += `word${i} `;
        rerender(
          <AgentRunner
            state="synthesizing"
            streamingTokens={accumulated}
          />
        );
      }

      const streamEl = screen.getByTestId('agent-streaming-tokens');
      expect(streamEl.textContent).toContain('word150');
      expect(screen.getByTestId('agent-token-count')).toHaveTextContent('150 tokens');
      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();

      // Transition to complete: cursor must disappear
      rerender(
        <AgentRunner
          state="complete"
          streamingTokens={accumulated}
        />
      );
      expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 3: Missing, Undefined, Null, and Malformed Props Edge Cases
  // =========================================================================
  describe('3. Missing, Undefined, Null & Boundary Props', () => {
    it('renders robustly with zero props supplied', () => {
      render(<AgentRunner />);
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('NemoIR ReAct Agent Ready');
      expect(screen.queryByTestId('agent-elapsed-time')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-chunk-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-cancel-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-reset-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-error-banner')).not.toBeInTheDocument();
    });

    it('safely handles null values for all props without unhandled exceptions', () => {
      render(
        <AgentRunner
          status={null as any}
          state={null as any}
          currentStepMessage={null as any}
          elapsedMs={null as any}
          activeChunkCount={null as any}
          error={null as any}
          streamingTokens={null as any}
          steps={null as any}
          timeline={null as any}
          onCancel={null as any}
          onReset={null as any}
        />
      );

      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
    });

    it('safely handles numeric and boundary edge cases (negative, zero, NaN, Infinity)', () => {
      const { rerender } = render(
        <AgentRunner
          state="thinking"
          elapsedMs={-500}
          activeChunkCount={-10}
        />
      );

      // Negative values do not render badges (> 0 check)
      expect(screen.queryByTestId('agent-elapsed-time')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-chunk-count')).not.toBeInTheDocument();

      // Zero values do not render badges
      rerender(
        <AgentRunner
          state="thinking"
          elapsedMs={0}
          activeChunkCount={0}
        />
      );
      expect(screen.queryByTestId('agent-elapsed-time')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-chunk-count')).not.toBeInTheDocument();

      // NaN values do not crash
      rerender(
        <AgentRunner
          state="thinking"
          elapsedMs={NaN}
          activeChunkCount={NaN}
        />
      );
      expect(screen.queryByTestId('agent-elapsed-time')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-chunk-count')).not.toBeInTheDocument();

      // Large numeric values format without overflow
      rerender(
        <AgentRunner
          state="searching"
          elapsedMs={9999999}
          activeChunkCount={1000000}
        />
      );
      expect(screen.getByTestId('agent-elapsed-timer')).toHaveTextContent('10000.0s');
      expect(screen.getByTestId('agent-active-chunks')).toHaveTextContent('1000000 chunks');
    });

    it('safely handles malformed and custom steps arrays', () => {
      const stepsWithVariations: AgentExecutionStep[] = [
        { id: '', name: 'Empty ID Step', status: 'pending' },
        { id: 'step-err', name: 'Error Step', status: 'error', message: 'Fail reason' },
        { id: 'step-unknown', name: 'Unknown Status Step', status: 'invalid-status' as any },
      ];

      render(<AgentRunner steps={stepsWithVariations} />);
      const stepItems = screen.getAllByTestId('agent-step-item');
      expect(stepItems).toHaveLength(3);
      expect(screen.getByText('Empty ID Step')).toBeInTheDocument();
      expect(screen.getByText('Error Step')).toBeInTheDocument();
      expect(screen.getByText('Unknown Status Step')).toBeInTheDocument();
    });

    it('safely handles non-string and bizarre inputs to normalizeAgentState', () => {
      expect(normalizeAgentState(undefined)).toBe('idle');
      expect(normalizeAgentState('')).toBe('idle');
      expect(normalizeAgentState('   ')).toBe('idle');
      expect(normalizeAgentState('UNKNOWN_STATE_VAL')).toBe('idle');
      expect(normalizeAgentState('THINKING_IN_PROGRESS')).toBe('thinking');
      expect(normalizeAgentState('search_ast_nodes')).toBe('searching');
      expect(normalizeAgentState('synthesize_webllm')).toBe('synthesizing');
      expect(normalizeAgentState('SUCCESS_COMPLETE')).toBe('complete');
      expect(normalizeAgentState('FAILURE_ABORTED')).toBe('error');
    });
  });

  // =========================================================================
  // SUITE 4: Component Unmounting During Active Operations
  // =========================================================================
  describe('4. Component Unmounting & Interrupted Lifecycle', () => {
    it('unmounts cleanly during active synthesizing state with streaming tokens', () => {
      const { unmount } = render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="Active streaming tokens in flight..."
        />
      );

      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();

      // Unmount while cursor is animating
      expect(() => unmount()).not.toThrow();
      expect(screen.queryByTestId('agent-runner')).not.toBeInTheDocument();
    });

    it('survives 50 rapid mount/unmount cycles in tight succession', () => {
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <AgentRunner
            state={i % 2 === 0 ? 'thinking' : 'synthesizing'}
            streamingTokens={`Loop token payload ${i}`}
            elapsedMs={i * 100}
          />
        );
        expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
        unmount();
        expect(screen.queryByTestId('agent-runner')).not.toBeInTheDocument();
      }
    });

    it('unmounts cleanly when callback functions are invoked right before unmount', async () => {
      const user = userEvent.setup();
      const cancelSpy = vi.fn();

      const { unmount } = render(
        <AgentRunner state="thinking" onCancel={cancelSpy} />
      );

      const cancelBtn = screen.getByTestId('agent-cancel-btn');
      await user.click(cancelBtn);
      expect(cancelSpy).toHaveBeenCalledTimes(1);

      unmount();
      expect(screen.queryByTestId('agent-runner')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 5: UI Expansion & Trace Drawer Interactions
  // =========================================================================
  describe('5. Trace Drawer & UI Expansion Stress', () => {
    it('handles 20 rapid expand/collapse toggle clicks cleanly', async () => {
      const user = userEvent.setup();
      render(<AgentRunner state="thinking" />);

      const toggleBtn = screen.getByTestId('agent-toggle-traces-btn');
      expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();

      // Rapidly toggle 20 times
      for (let i = 0; i < 20; i++) {
        await user.click(toggleBtn);
        if (i % 2 === 0) {
          // Odd iteration: collapsed
          expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();
        } else {
          // Even iteration: expanded
          expect(screen.getByTestId('agent-steps-list')).toBeInTheDocument();
        }
      }
    });

    it('renders empty timeline without throwing', () => {
      render(<AgentRunner timeline={[]} />);
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.queryByTestId('agent-trace-drawer')).not.toBeInTheDocument();
    });

    it('renders multi-event timeline items via WorkflowTraceDrawer without errors', () => {
      const timelineItems: CoalescedTimelineItem[] = [
        {
          kind: 'event',
          seq: 1,
          event: {
            kind: 'stage_started',
            runId: 'run-adv-1',
            sequence: 1,
            timestamp: new Date().toISOString(),
            stageId: 'Intent Analysis',
          },
        },
        {
          kind: 'delta_run',
          firstSeq: 2,
          lastSeq: 4,
          stageId: 'AST Search',
          channel: 'assistant',
          text: 'Found 4 matching AST nodes with high semantic similarity.',
        },
        {
          kind: 'event',
          seq: 5,
          event: {
            kind: 'stage_completed',
            runId: 'run-adv-1',
            sequence: 5,
            timestamp: new Date().toISOString(),
            stageId: 'Synthesizing',
          },
        },
      ];

      render(<AgentRunner timeline={timelineItems} />);
      expect(screen.getByTestId('agent-trace-drawer')).toBeInTheDocument();
      expect(
        screen.getByText('Found 4 matching AST nodes with high semantic similarity.')
      ).toBeInTheDocument();
    });

    it('respects compact mode and hides expandable body even when expanded', () => {
      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="Compact tokens"
          compact={true}
        />
      );

      // Header is still present
      expect(screen.getByTestId('agent-status-badge')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Synthesizing');

      // Expandable body elements are hidden in compact mode
      expect(screen.queryByTestId('agent-steps-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-streaming-output')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 6: ChatPane Integration & Advanced Adversarial Invariants
  // =========================================================================
  describe('6. ChatPane Integration & Advanced Invariants', () => {
    it('verifies explicit prop precedence over status object properties', () => {
      const statusObj: AgentStatus = {
        state: 'Thinking',
        currentStepMessage: 'Status message',
        elapsedMs: 100,
        activeChunkCount: 1,
      };

      render(
        <AgentRunner
          status={statusObj}
          state="searching"
          currentStepMessage="Explicit prop message"
          elapsedMs={500}
          activeChunkCount={10}
        />
      );

      // Explicit props should take precedence
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Searching AST');
      expect(screen.getByTestId('agent-step-message')).toHaveTextContent('Explicit prop message');
      expect(screen.getByTestId('agent-elapsed-timer')).toHaveTextContent('0.5s');
      expect(screen.getByTestId('agent-active-chunks')).toHaveTextContent('10 chunks');
    });

    it('safely handles invisible, zero-width, and bidirectional control characters', () => {
      const invisiblePayload = '\u200B\u200C\u200D\uFEFF\u00A0\u202E\u202D';
      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens={invisiblePayload}
        />
      );

      expect(screen.getByTestId('agent-streaming-output')).toBeInTheDocument();
      expect(screen.getByTestId('agent-streaming-tokens')).toBeInTheDocument();
    });

    it('handles empty string error property without rendering ghost banner', () => {
      render(<AgentRunner state="error" error="" />);
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Error');
      // When error is empty string, error banner should not render
      expect(screen.queryByTestId('agent-error-banner')).not.toBeInTheDocument();
    });
  });
});

