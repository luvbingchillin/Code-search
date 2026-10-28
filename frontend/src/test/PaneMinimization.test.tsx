import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import App from '../App';

describe('Pane Minimization Acceptance & Interaction Suite', () => {
  beforeEach(() => {
    // Reset window size for consistent desktop view
    window.innerWidth = 1200;
  });

  it('renders both chat and code panes open by default', () => {
    render(<App />);

    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');
    expect(screen.getByTestId('code-viewer-pane')).not.toHaveClass('hidden');
    expect(screen.queryByTestId('restore-chat-rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('restore-code-rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('both-minimized-canvas')).not.toBeInTheDocument();
  });

  it('minimizes chat pane when minimize-chat-btn is clicked and renders left restore rail', async () => {
    const user = userEvent.setup();
    render(<App />);

    const minimizeChatBtn = screen.getByTestId('minimize-chat-btn');
    await user.click(minimizeChatBtn);

    // Chat pane is hidden
    expect(screen.getByTestId('chat-pane')).toHaveClass('hidden');

    // Left restore rail is visible
    expect(screen.getByTestId('restore-chat-rail')).toBeInTheDocument();
    expect(screen.getByTestId('restore-chat-btn')).toBeInTheDocument();

    // Code viewer pane expands to 100% width
    const codePane = screen.getByTestId('code-viewer-pane');
    expect(codePane).toHaveStyle({ width: '100%' });
  });

  it('restores chat pane when restore-chat-btn is clicked on the left rail', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Minimize first
    await user.click(screen.getByTestId('minimize-chat-btn'));
    expect(screen.getByTestId('chat-pane')).toHaveClass('hidden');

    // Click restore on the rail
    const restoreBtn = screen.getByTestId('restore-chat-btn');
    await user.click(restoreBtn);

    // Chat is back and visible
    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');
    expect(screen.queryByTestId('restore-chat-rail')).not.toBeInTheDocument();
  });

  it('minimizes code viewer pane when minimize-code-btn is clicked and renders right restore rail', async () => {
    const user = userEvent.setup();
    render(<App />);

    const minimizeCodeBtn = screen.getByTestId('minimize-code-btn');
    await user.click(minimizeCodeBtn);

    // Code pane is hidden
    expect(screen.getByTestId('code-viewer-pane')).toHaveClass('hidden');

    // Right restore rail is visible
    expect(screen.getByTestId('restore-code-rail')).toBeInTheDocument();
    expect(screen.getByTestId('restore-code-btn')).toBeInTheDocument();

    // Chat pane expands to 100% width
    const chatPane = screen.getByTestId('chat-pane');
    expect(chatPane).toHaveStyle({ width: '100%' });
  });

  it('restores code viewer pane when restore-code-btn is clicked on the right rail', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Minimize code pane first
    await user.click(screen.getByTestId('minimize-code-btn'));
    expect(screen.getByTestId('code-viewer-pane')).toHaveClass('hidden');

    // Click restore button on rail
    await user.click(screen.getByTestId('restore-code-btn'));

    // Code pane is restored
    expect(screen.getByTestId('code-viewer-pane')).not.toHaveClass('hidden');
    expect(screen.queryByTestId('restore-code-rail')).not.toBeInTheDocument();
  });

  it('minimizes BOTH chat and code panes and renders Focus Mode canvas', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Minimize chat
    await user.click(screen.getByTestId('minimize-chat-btn'));
    // Minimize code
    await user.click(screen.getByTestId('minimize-code-btn'));

    // Both panes are hidden
    expect(screen.getByTestId('chat-pane')).toHaveClass('hidden');
    expect(screen.getByTestId('code-viewer-pane')).toHaveClass('hidden');

    // Both rails are visible
    expect(screen.getByTestId('restore-chat-rail')).toBeInTheDocument();
    expect(screen.getByTestId('restore-code-rail')).toBeInTheDocument();

    // Focus mode canvas is rendered
    expect(screen.getByTestId('both-minimized-canvas')).toBeInTheDocument();
    expect(screen.getByText('Focus Mode: All Panes Minimized')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-restore-chat-btn')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-restore-code-btn')).toBeInTheDocument();
  });

  it('restores panes cleanly from the Focus Mode canvas buttons', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Minimize both
    await user.click(screen.getByTestId('minimize-chat-btn'));
    await user.click(screen.getByTestId('minimize-code-btn'));

    expect(screen.getByTestId('both-minimized-canvas')).toBeInTheDocument();

    // Restore chat from canvas
    await user.click(screen.getByTestId('canvas-restore-chat-btn'));
    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');
    expect(screen.queryByTestId('both-minimized-canvas')).not.toBeInTheDocument();

    // Restore code from right rail
    await user.click(screen.getByTestId('restore-code-btn'));
    expect(screen.getByTestId('code-viewer-pane')).not.toHaveClass('hidden');
  });

  it('toggles pane minimization via Header layout controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    const headerChatToggle = screen.getByTestId('toggle-chat-pane-btn');
    const headerCodeToggle = screen.getByTestId('toggle-code-pane-btn');

    // Toggle chat off
    await user.click(headerChatToggle);
    expect(screen.getByTestId('chat-pane')).toHaveClass('hidden');

    // Toggle chat back on
    await user.click(headerChatToggle);
    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');

    // Toggle code off
    await user.click(headerCodeToggle);
    expect(screen.getByTestId('code-viewer-pane')).toHaveClass('hidden');

    // Toggle code back on
    await user.click(headerCodeToggle);
    expect(screen.getByTestId('code-viewer-pane')).not.toHaveClass('hidden');
  });

  it('toggles chat pane via Ctrl+B keyboard shortcut', () => {
    render(<App />);

    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');

    // Press Ctrl+B to minimize chat
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getByTestId('chat-pane')).toHaveClass('hidden');

    // Press Ctrl+B again to restore chat
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');
  });

  it('maximizes code viewer (minimizing chat) and restores via toggle-maximize-code-btn', async () => {
    const user = userEvent.setup();
    render(<App />);

    const maxBtn = screen.getByTestId('toggle-maximize-code-btn');

    // Maximize code viewer
    await user.click(maxBtn);
    expect(screen.getByTestId('chat-pane')).toHaveClass('hidden');
    expect(screen.getByTestId('code-viewer-pane')).toHaveStyle({ width: '100%' });

    // Click again to restore
    await user.click(maxBtn);
    expect(screen.getByTestId('chat-pane')).not.toHaveClass('hidden');
  });
});
