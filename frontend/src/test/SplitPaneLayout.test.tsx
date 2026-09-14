import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('SplitPaneLayout Acceptance Suite', () => {
  it('renders the split-pane layout container', () => {
    render(<App />);
    const layoutContainer = screen.getByTestId('split-pane-layout');
    expect(layoutContainer).toBeInTheDocument();
  });

  it('renders the left chat pane with chat input, suggestions, and banner', () => {
    render(<App />);
    const chatPane = screen.getByTestId('chat-pane');
    expect(chatPane).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('chat-send-btn')).toBeInTheDocument();
    expect(screen.getByTestId('agentic-loop-banner')).toBeInTheDocument();
  });

  it('renders the right code viewer pane with header and code display area', () => {
    render(<App />);
    const codeViewerPane = screen.getByTestId('code-viewer-pane');
    expect(codeViewerPane).toBeInTheDocument();
    expect(screen.getByTestId('code-viewer-header')).toBeInTheDocument();
    expect(screen.getByTestId('code-display')).toBeInTheDocument();
  });

  it('maintains split-pane structure across viewport dimensions', () => {
    render(<App />);
    const leftPane = screen.getByTestId('chat-pane');
    const rightPane = screen.getByTestId('code-viewer-pane');
    expect(leftPane).toBeInTheDocument();
    expect(rightPane).toBeInTheDocument();
  });
});
