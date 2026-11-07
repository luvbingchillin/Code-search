import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('highlights matching search terms with <mark> tags inside code display without corrupting Prism tokens', async () => {
    const user = userEvent.setup();
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    // Click open search
    const openSearchBtn = screen.getByTestId('open-code-search-btn');
    await user.click(openSearchBtn);

    const searchInput = screen.getByTestId('code-search-input');
    expect(searchInput).toBeInTheDocument();

    // Type "token"
    await user.type(searchInput, 'token');

    // Match count pill reflects 7 occurrences in mockAstChunks[0]
    const matchCountPill = screen.getByTestId('search-match-count');
    expect(matchCountPill).toHaveTextContent('7 matches');

    // Verify <mark> tags highlight occurrences in code display
    const codeDisplay = screen.getByTestId('code-display');
    expect(codeDisplay.innerHTML).toContain('<mark class="bg-amber-400/30 text-amber-200 border-b border-amber-400 font-semibold px-0.5 rounded">token</mark>');

    // Crucial: verify HTML tag attributes were NOT corrupted by the search term
    // Prism's keyword class should be intact: <span class="token keyword">def</span>, NOT <span class="<mark>token</mark> keyword">
    expect(codeDisplay.innerHTML).toContain('class="token keyword"');
    expect(codeDisplay.innerHTML).not.toContain('class="<mark');
  });

  it('displays "1 match" for singular match and "0 matches" for non-matching search', async () => {
    const user = userEvent.setup();
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    await user.click(screen.getByTestId('open-code-search-btn'));
    const searchInput = screen.getByTestId('code-search-input');

    // Singular match
    await user.type(searchInput, 'verify');
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('1 match');

    // Clear and type non-matching term
    await user.clear(searchInput);
    await user.type(searchInput, 'nonexistent_symbol_123');
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('0 matches');

    const codeDisplay = screen.getByTestId('code-display');
    expect(codeDisplay.innerHTML).not.toContain('<mark');
  });

  it('safely handles special regex characters in search term without throwing errors', async () => {
    const user = userEvent.setup();
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    await user.click(screen.getByTestId('open-code-search-btn'));
    const searchInput = screen.getByTestId('code-search-input');

    // Test bracket metacharacter '['
    fireEvent.change(searchInput, { target: { value: '[' } });
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('1 match');
    const codeDisplay = screen.getByTestId('code-display');
    expect(codeDisplay.innerHTML).toContain('<mark class="bg-amber-400/30 text-amber-200 border-b border-amber-400 font-semibold px-0.5 rounded">[</mark>');

    // Test asterisk '*' (no match, does not throw SyntaxError)
    fireEvent.change(searchInput, { target: { value: '*' } });
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('0 matches');

    // Test parenthesis '(' (metacharacter, does not throw SyntaxError)
    fireEvent.change(searchInput, { target: { value: '(' } });
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('2 matches');

    // Test dot '.' (metacharacter, safely matches literal dots, not wildcard for every char)
    fireEvent.change(searchInput, { target: { value: '.' } });
    expect(screen.getByTestId('search-match-count')).toHaveTextContent('4 matches');
  });

  it('clears highlights and match count when search is closed or cleared', async () => {
    const user = userEvent.setup();
    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={() => {}}
      />
    );

    await user.click(screen.getByTestId('open-code-search-btn'));
    const searchInput = screen.getByTestId('code-search-input');
    await user.type(searchInput, 'token');

    expect(screen.getByTestId('search-match-count')).toBeInTheDocument();
    const codeDisplay = screen.getByTestId('code-display');
    expect(codeDisplay.innerHTML).toContain('<mark');

    // Click close/clear button
    const clearBtn = screen.getByTestId('clear-code-search-btn');
    await user.click(clearBtn);

    // Search bar is closed, open button restored
    expect(screen.queryByTestId('code-search-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
    expect(screen.getByTestId('open-code-search-btn')).toBeInTheDocument();

    // Highlighting is cleared
    expect(codeDisplay.innerHTML).not.toContain('<mark');
  });
});
