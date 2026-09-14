import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { mockAstChunks } from './fixtures/mockData';

describe('CodeViewerPane & Syntax Highlighting Suite', () => {
  it('renders AST chunk tabs and switches active chunk on click', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={handleSelect}
      />
    );

    // Tab presence
    const tab1 = screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`);
    const tab2 = screen.getByTestId(`chunk-tab-${mockAstChunks[1].id}`);
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    // Click tab 2
    await user.click(tab2);
    expect(handleSelect).toHaveBeenCalledWith(mockAstChunks[1].id);
  });

  it('renders Python syntax tokens via Prism in code-display', () => {
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    const codeDisplay = screen.getByTestId('code-display');
    expect(codeDisplay).toBeInTheDocument();
    // Verify Python keyword token was rendered by Prism
    expect(codeDisplay.innerHTML).toContain('class="token keyword"');
    expect(codeDisplay.innerHTML).toContain('def');
  });

  it('displays accurate line numbers starting from AST startLine', () => {
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    const lineNumbers = screen.getAllByTestId('line-number');
    expect(lineNumbers[0]).toHaveTextContent(String(mockAstChunks[0].startLine)); // 45
  });

  it('copies code to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    const copyBtn = screen.getByTestId('copy-code-btn');
    await user.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAstChunks[0].code);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });
});
