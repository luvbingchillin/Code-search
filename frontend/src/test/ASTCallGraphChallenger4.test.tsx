import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { apiClient } from '../services/apiClient';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { AstCodeChunk } from '../types';

describe('Adversarial Challenger Suite: Milestone 4 AST Call Graph & Navigation', () => {
  it('Challenger 1: Multi-hop cascading navigation (A -> B -> C)', async () => {
    const user = userEvent.setup();

    const chunkA: AstCodeChunk = {
      id: 'chunk-a',
      filePath: 'pkg/a.py',
      fileName: 'a.py',
      astNodeType: 'FunctionDef',
      identifier: 'alpha',
      startLine: 1,
      endLine: 10,
      code: 'def alpha(): beta()',
      relevanceScore: 1.0,
      calls: ['beta'],
      imports: ['pkg.b'],
    };

    const chunkB: AstCodeChunk = {
      id: 'chunk-b',
      filePath: 'pkg/b.py',
      fileName: 'b.py',
      astNodeType: 'FunctionDef',
      identifier: 'beta',
      startLine: 1,
      endLine: 10,
      code: 'def beta(): gamma()',
      relevanceScore: 1.0,
      calls: ['gamma'],
      imports: ['pkg.c'],
    };

    const chunkC: AstCodeChunk = {
      id: 'chunk-c',
      filePath: 'pkg/c.py',
      fileName: 'c.py',
      astNodeType: 'FunctionDef',
      identifier: 'gamma',
      startLine: 1,
      endLine: 10,
      code: 'def gamma(): pass',
      relevanceScore: 1.0,
      calls: [],
      imports: [],
    };

    const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockImplementation(async (identifier: string) => {
      if (identifier === 'beta') {
        return { identifier: 'beta', count: 1, chunks: [chunkB] };
      }
      if (identifier === 'gamma') {
        return { identifier: 'gamma', count: 1, chunks: [chunkC] };
      }
      return { identifier, count: 0, chunks: [] };
    });

    vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValueOnce([chunkA]);

    render(<App />);

    // Connect repository to load chunkA via open-repo-btn-requests
    await user.click(screen.getByTestId('connect-repo-btn'));
    const openBtn = await screen.findByTestId('open-repo-btn-requests');
    await user.click(openBtn);

    // Verify chunkA is displayed
    await waitFor(() => {
      expect(screen.getByTestId('chunk-tab-chunk-a')).toBeInTheDocument();
    });

    // Open inspector drawer
    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

    // Hop 1: Click 'beta ↗' -> should fetch chunkB and switch to it
    const betaBadge = screen.getByTestId('call-badge-beta');
    await user.click(betaBadge);

    await waitFor(() => {
      expect(lookupSpy).toHaveBeenCalledWith('beta');
      expect(screen.getByTestId('chunk-tab-chunk-b')).toBeInTheDocument();
      expect(screen.getByTestId('chunk-tab-chunk-b')).toHaveAttribute('aria-selected', 'true');
    });

    // In chunkB, the inspector now shows 'gamma ↗'
    await waitFor(() => {
      expect(screen.getByTestId('call-badge-gamma')).toBeInTheDocument();
    });

    // Hop 2: Click 'gamma ↗' -> should fetch chunkC and switch to it
    const gammaBadge = screen.getByTestId('call-badge-gamma');
    await user.click(gammaBadge);

    await waitFor(() => {
      expect(lookupSpy).toHaveBeenCalledWith('gamma');
      expect(screen.getByTestId('chunk-tab-chunk-c')).toBeInTheDocument();
      expect(screen.getByTestId('chunk-tab-chunk-c')).toHaveAttribute('aria-selected', 'true');
    });

    // All three chunks should now be co-present in active chunks tabs without duplicate accumulation
    expect(screen.getByTestId('chunk-tab-chunk-a')).toBeInTheDocument();
    expect(screen.getByTestId('chunk-tab-chunk-b')).toBeInTheDocument();
    expect(screen.getByTestId('chunk-tab-chunk-c')).toBeInTheDocument();
  });

  it('Challenger 2: Network error / 500 rejection in lookupEntity degrades gracefully', async () => {
    const user = userEvent.setup();

    const chunkRoot: AstCodeChunk = {
      id: 'chunk-root',
      filePath: 'root.py',
      fileName: 'root.py',
      astNodeType: 'FunctionDef',
      identifier: 'main_handler',
      startLine: 1,
      endLine: 20,
      code: 'def main_handler(): missing_service()',
      relevanceScore: 1.0,
      calls: ['missing_service'],
      imports: [],
    };

    vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValueOnce([chunkRoot]);
    const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockRejectedValueOnce(
      new Error('500 Internal Server Error: LanceDB connection timed out')
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<App />);

    await user.click(screen.getByTestId('connect-repo-btn'));
    await user.click(await screen.findByTestId('open-repo-btn-requests'));

    await waitFor(() => {
      expect(screen.getByTestId('chunk-tab-chunk-root')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    const badge = screen.getByTestId('call-badge-missing_service');

    // Clicking should invoke lookupEntity, catch the error, log a warning, and NOT crash App
    await user.click(badge);

    await waitFor(() => {
      expect(lookupSpy).toHaveBeenCalledWith('missing_service');
      expect(warnSpy).toHaveBeenCalledWith(
        'Entity lookup failed for missing_service:',
        expect.any(Error)
      );
    });

    // App and viewer remain completely responsive and intact
    expect(screen.getByTestId('chunk-tab-chunk-root')).toHaveAttribute('aria-selected', 'true');
    warnSpy.mockRestore();
  });

  it('Challenger 3: Entity lookup returning 0 chunks leaves activeChunks and selection stable', async () => {
    const user = userEvent.setup();

    const chunkA: AstCodeChunk = {
      id: 'chunk-empty-res',
      filePath: 'empty.py',
      fileName: 'empty.py',
      astNodeType: 'FunctionDef',
      identifier: 'producer',
      startLine: 1,
      endLine: 15,
      code: 'def producer(): nonexistent()',
      relevanceScore: 1.0,
      calls: ['nonexistent'],
      imports: [],
    };

    vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValueOnce([chunkA]);
    vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
      identifier: 'nonexistent',
      count: 0,
      chunks: [],
    });

    render(<App />);

    await user.click(screen.getByTestId('connect-repo-btn'));
    await user.click(await screen.findByTestId('open-repo-btn-requests'));

    await waitFor(() => {
      expect(screen.getByTestId('chunk-tab-chunk-empty-res')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    await user.click(screen.getByTestId('call-badge-nonexistent'));

    // Still selected on chunkA
    expect(screen.getByTestId('chunk-tab-chunk-empty-res')).toHaveAttribute('aria-selected', 'true');
  });

  it('Challenger 4: Rapid consecutive badge clicks do not corrupt chunk state or duplicate tabs', async () => {
    const user = userEvent.setup();

    const chunkTarget: AstCodeChunk = {
      id: 'chunk-target-unique',
      filePath: 'target.py',
      fileName: 'target.py',
      astNodeType: 'FunctionDef',
      identifier: 'target_func',
      startLine: 1,
      endLine: 10,
      code: 'def target_func(): pass',
      relevanceScore: 1.0,
      calls: [],
      imports: [],
    };

    const chunkSource: AstCodeChunk = {
      id: 'chunk-source',
      filePath: 'source.py',
      fileName: 'source.py',
      astNodeType: 'FunctionDef',
      identifier: 'source_func',
      startLine: 1,
      endLine: 10,
      code: 'def source_func(): target_func()',
      relevanceScore: 1.0,
      calls: ['target_func'],
      imports: [],
    };

    vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValueOnce([chunkSource]);
    vi.spyOn(apiClient, 'lookupEntity').mockResolvedValue({
      identifier: 'target_func',
      count: 1,
      chunks: [chunkTarget],
    });

    render(<App />);

    await user.click(screen.getByTestId('connect-repo-btn'));
    await user.click(await screen.findByTestId('open-repo-btn-requests'));

    await waitFor(() => {
      expect(screen.getByTestId('chunk-tab-chunk-source')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    const badge = screen.getByTestId('call-badge-target_func');

    // Click 5 times in rapid succession
    await user.click(badge);
    await user.click(badge);
    await user.click(badge);
    await user.click(badge);
    await user.click(badge);

    await waitFor(() => {
      expect(screen.getByTestId('chunk-tab-chunk-target-unique')).toBeInTheDocument();
    });

    // Verify there is exactly ONE tab for chunk-target-unique, not 5 duplicates
    const tabs = screen.getAllByTestId('chunk-tab-chunk-target-unique');
    expect(tabs).toHaveLength(1);
  });

  it('Challenger 5: Fallback in CodeViewerContainer matches qualified method suffixes and self calls', async () => {
    const user = userEvent.setup();
    const handleSelectChunk = vi.fn();

    const chunkCaller: AstCodeChunk = {
      id: 'caller-id',
      filePath: 'class_mod.py',
      fileName: 'class_mod.py',
      astNodeType: 'ClassDef',
      identifier: 'OrderService',
      startLine: 1,
      endLine: 50,
      code: 'class OrderService:\n  def create_order(): self._validate_cart()',
      relevanceScore: 1.0,
      calls: ['self._validate_cart', 'tax_engine.compute'],
      imports: [],
    };

    const chunkCart: AstCodeChunk = {
      id: 'cart-id',
      filePath: 'class_mod.py',
      fileName: 'class_mod.py',
      astNodeType: 'FunctionDef',
      identifier: '_validate_cart',
      startLine: 20,
      endLine: 35,
      code: 'def _validate_cart(): pass',
      relevanceScore: 1.0,
      calls: [],
      imports: [],
    };

    const chunkTax: AstCodeChunk = {
      id: 'tax-id',
      filePath: 'tax.py',
      fileName: 'tax.py',
      astNodeType: 'FunctionDef',
      identifier: 'compute',
      startLine: 1,
      endLine: 25,
      code: 'def compute(): pass',
      relevanceScore: 1.0,
      calls: [],
      imports: [],
    };

    render(
      <CodeViewerContainer
        chunks={[chunkCaller, chunkCart, chunkTax]}
        selectedChunkId={chunkCaller.id}
        onSelectChunk={handleSelectChunk}
      />
    );

    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));

    // Click self._validate_cart
    await user.click(screen.getByTestId('call-badge-self._validate_cart'));
    expect(handleSelectChunk).toHaveBeenCalledWith(chunkCart.id);

    // Click tax_engine.compute
    await user.click(screen.getByTestId('call-badge-tax_engine.compute'));
    expect(handleSelectChunk).toHaveBeenCalledWith(chunkTax.id);
  });
});
