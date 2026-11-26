import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StrataCanvas } from '../components/strata/StrataCanvas';
import { computeStrataLayout, RawStrataNode, RawStrataEdge } from '../services/strata/strataLayout';

describe('StrataCanvas Component Suite', () => {
  const sampleNodes: RawStrataNode[] = [
    { id: 'node-1', identifier: 'BaseModel', filePath: 'models/base.py', astNodeType: 'ClassDef', tier: 0 },
    { id: 'node-2', identifier: 'DbService', filePath: 'services/db.py', astNodeType: 'ClassDef', tier: 1 },
    { id: 'node-3', identifier: 'PipelineLogic', filePath: 'core/pipe.py', astNodeType: 'ClassDef', tier: 2 },
    { id: 'node-4', identifier: 'api_handler', filePath: 'api/routes.py', astNodeType: 'FunctionDef', tier: 3 },
  ];

  const sampleEdges: RawStrataEdge[] = [
    { id: 'e1', source: 'node-4', target: 'node-3' },
    { id: 'e2', source: 'node-3', target: 'node-2' },
    { id: 'e3', source: 'node-2', target: 'node-1' },
  ];

  const graphData = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });

  it('renders the canvas container with data-testid="strata-canvas" in JSDOM fallback mode', () => {
    render(<StrataCanvas graphData={graphData} />);

    const canvasElement = screen.getByTestId('strata-canvas');
    expect(canvasElement).toBeInTheDocument();
  });

  it('displays architectural tiers and node counts', () => {
    render(<StrataCanvas graphData={graphData} />);

    expect(screen.getByText(/3D Strata Architecture Canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/4 nodes · 3 caller-callee edges · 4 layered tiers/i)).toBeInTheDocument();

    expect(screen.getByText('Tier 0')).toBeInTheDocument();
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
    expect(screen.getByText('Tier 2')).toBeInTheDocument();
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
  });

  it('renders interactive node chips and triggers onSelectNode on click', () => {
    const handleSelectNode = vi.fn();
    render(
      <StrataCanvas
        graphData={graphData}
        onSelectNode={handleSelectNode}
        selectedChunkId="node-2"
        highlightedChunkIds={new Set(['node-3', 'node-4'])}
      />
    );

    const node1Btn = screen.getByTestId('strata-node-node-1');
    const node2Btn = screen.getByTestId('strata-node-node-2');
    const node3Btn = screen.getByTestId('strata-node-node-3');

    expect(node1Btn).toBeInTheDocument();
    expect(node2Btn).toBeInTheDocument();
    expect(node3Btn).toBeInTheDocument();

    // Verify selected state
    expect(node2Btn.className).toContain('bg-[#38bdf8]');

    // Verify highlighted state
    expect(node3Btn.className).toContain('border-[#38bdf8]');

    // Click node 1
    fireEvent.click(node1Btn);
    expect(handleSelectNode).toHaveBeenCalledTimes(1);
    expect(handleSelectNode).toHaveBeenCalledWith('node-1');
  });

  it('handles empty graph data cleanly without crashing', () => {
    const emptyGraph = computeStrataLayout({ nodes: [], edges: [] });
    render(<StrataCanvas graphData={emptyGraph} />);

    expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
    expect(screen.getByText(/0 nodes · 0 caller-callee edges/i)).toBeInTheDocument();
  });

  it('allows isolating a specific tier and toggling edge display modes in headless fallback', () => {
    render(<StrataCanvas graphData={graphData} />);

    // Initially all 4 nodes are visible
    expect(screen.getByTestId('strata-node-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('strata-node-node-2')).toBeInTheDocument();

    // Isolate Tier 1
    fireEvent.click(screen.getByTestId('strata-tier-filter-1'));
    expect(screen.getByTestId('strata-node-node-2')).toBeInTheDocument();
    expect(screen.queryByTestId('strata-node-node-1')).not.toBeInTheDocument();

    // Toggle edge mode
    const crossTierBtn = screen.getByTestId('strata-edge-mode-cross-tier');
    fireEvent.click(crossTierBtn);
    expect(crossTierBtn.className).toContain('text-sky-300');

    // Toggle focus dim control
    const dimBtn = screen.getByTestId('strata-toggle-dim-btn');
    expect(dimBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dimBtn);
    expect(dimBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
