import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { AgenticLoopBanner } from '../components/chat/AgenticLoopBanner';
import { AgentStatus } from '../types';

describe('AgenticLoopState Transitions Acceptance Suite', () => {
  it('transitions sequentially through Idle -> Thinking -> Searching AST -> Synthesizing -> Complete', async () => {
    const statuses: AgentStatus[] = [
      { state: 'Idle', currentStepMessage: 'System ready', elapsedMs: 0, activeChunkCount: 0 },
      { state: 'Thinking', currentStepMessage: 'Analyzing code semantics & query intent...', elapsedMs: 250, activeChunkCount: 0 },
      { state: 'Searching AST', currentStepMessage: 'Querying NemoIR vector index for Python AST nodes...', elapsedMs: 650, activeChunkCount: 3 },
      { state: 'Synthesizing', currentStepMessage: 'Synthesizing response via WebLLM model...', elapsedMs: 1200, activeChunkCount: 3 },
      { state: 'Complete', currentStepMessage: 'Search completed successfully in 1.4s', elapsedMs: 1400, activeChunkCount: 3 },
    ];

    const { rerender } = render(<AgenticLoopBanner status={statuses[0]} />);
    expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Idle');

    // 1. Thinking
    rerender(<AgenticLoopBanner status={statuses[1]} />);
    expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Thinking');
    expect(screen.getByTestId('agentic-step-description')).toHaveTextContent('Analyzing code semantics');

    // 2. Searching AST
    rerender(<AgenticLoopBanner status={statuses[2]} />);
    expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Searching AST');
    expect(screen.getByTestId('agentic-step-description')).toHaveTextContent('Querying NemoIR vector index');

    // 3. Synthesizing
    rerender(<AgenticLoopBanner status={statuses[3]} />);
    expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Synthesizing');
    expect(screen.getByTestId('agentic-step-description')).toHaveTextContent('Synthesizing response');

    // 4. Complete
    rerender(<AgenticLoopBanner status={statuses[4]} />);
    expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Complete');
  });

  it('triggers agentic loop transition on user query submission in full App', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByTestId('chat-input-textarea');
    const sendBtn = screen.getByTestId('chat-send-btn');

    await user.type(input, 'Find JWT token validation');
    await user.click(sendBtn);

    // Verify transition into active state
    expect(screen.getByTestId('agentic-state-label')).not.toHaveTextContent('Idle');
  });

  it('displays Error state gracefully when loop encounters a failure', () => {
    const errorStatus: AgentStatus = {
      state: 'Error',
      currentStepMessage: 'NemoIR index lookup failed',
      elapsedMs: 500,
      activeChunkCount: 0,
      error: 'WASM memory allocation exceeded',
    };
    render(<AgenticLoopBanner status={errorStatus} />);
    expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Error');
    expect(screen.getByText('WASM memory allocation exceeded')).toBeInTheDocument();
  });
});
