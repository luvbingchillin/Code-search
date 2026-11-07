import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { apiClient } from '../services/apiClient';
import { ASTMetadataInspector } from '../components/viewer/ASTMetadataInspector';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { mockAstChunks } from '../services/mockAstData';
import { AstCodeChunk } from '../types';

describe('ASTMetadataInspector Component Suite', () => {
  const sampleChunk: AstCodeChunk = {
    id: 'test-chunk-1',
    filePath: 'sample/pipeline.py',
    fileName: 'pipeline.py',
    astNodeType: 'FunctionDef',
    identifier: 'execute_pipeline',
    startLine: 10,
    endLine: 45,
    language: 'python',
    repoFullName: 'acme/data-pipeline',
    relevanceScore: 0.95,
    docstring: 'Executes the multi-stage ETL data processing pipeline.',
    parameters: ['config: PipelineConfig', 'dry_run: bool = False'],
    decorators: ['@retry(max_attempts=3)', '@timed'],
    calls: ['validate_config', 'extract_sources', 'transform_records', 'load_destination'],
    imports: ['typing', 'pathlib', 'pydantic', 'acme.connectors'],
    code: 'def execute_pipeline(config: PipelineConfig, dry_run: bool = False):\n    pass',
  };

  it('renders nothing when isOpen is false or chunk is null', () => {
    const { rerender } = render(
      <ASTMetadataInspector
        chunk={sampleChunk}
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('ast-metadata-inspector')).not.toBeInTheDocument();

    rerender(
      <ASTMetadataInspector
        chunk={null}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('ast-metadata-inspector')).not.toBeInTheDocument();
  });

  it('renders called function badges with ↗ arrow when chunk.calls exists', () => {
    render(
      <ASTMetadataInspector
        chunk={sampleChunk}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const callsSection = screen.getByTestId('ast-calls-section');
    expect(callsSection).toBeInTheDocument();
    expect(screen.getByText('Called Functions (4):')).toBeInTheDocument();

    sampleChunk.calls!.forEach((call) => {
      const badge = screen.getByTestId(`call-badge-${call}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(`${call} ↗`);
    });
  });

  it('invokes onSelectCall callback when a call badge is clicked', async () => {
    const user = userEvent.setup();
    const handleSelectCall = vi.fn();

    render(
      <ASTMetadataInspector
        chunk={sampleChunk}
        isOpen={true}
        onClose={vi.fn()}
        onSelectCall={handleSelectCall}
      />
    );

    const transformBadge = screen.getByTestId('call-badge-transform_records');
    await user.click(transformBadge);

    expect(handleSelectCall).toHaveBeenCalledTimes(1);
    expect(handleSelectCall).toHaveBeenCalledWith('transform_records');

    const loadBadge = screen.getByTestId('call-badge-load_destination');
    await user.click(loadBadge);

    expect(handleSelectCall).toHaveBeenCalledTimes(2);
    expect(handleSelectCall).toHaveBeenCalledWith('load_destination');
  });

  it('safely handles clicking a call badge when onSelectCall is not provided', async () => {
    const user = userEvent.setup();

    render(
      <ASTMetadataInspector
        chunk={sampleChunk}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const callBadge = screen.getByTestId('call-badge-validate_config');
    // Clicking when onSelectCall is undefined should not throw
    await expect(user.click(callBadge)).resolves.not.toThrow();
  });

  it('renders imports section and badges when chunk.imports exists', () => {
    render(
      <ASTMetadataInspector
        chunk={sampleChunk}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const importsSection = screen.getByTestId('ast-imports-section');
    expect(importsSection).toBeInTheDocument();
    expect(screen.getByText('Imports (4):')).toBeInTheDocument();

    sampleChunk.imports!.forEach((imp) => {
      const badge = screen.getByTestId(`import-badge-${imp}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(imp);
    });
  });

  it('gracefully omits calls and imports sections when arrays are empty', () => {
    const chunkWithoutDeps: AstCodeChunk = {
      ...sampleChunk,
      calls: [],
      imports: [],
    };

    render(
      <ASTMetadataInspector
        chunk={chunkWithoutDeps}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
    expect(screen.queryByTestId('ast-calls-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ast-imports-section')).not.toBeInTheDocument();
    expect(screen.queryByText(/Called Functions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Imports/i)).not.toBeInTheDocument();
  });

  it('gracefully omits calls and imports sections when arrays are undefined', () => {
    const chunkWithUndefinedDeps: AstCodeChunk = {
      ...sampleChunk,
      calls: undefined,
      imports: undefined,
    };

    render(
      <ASTMetadataInspector
        chunk={chunkWithUndefinedDeps}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
    expect(screen.queryByTestId('ast-calls-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ast-imports-section')).not.toBeInTheDocument();
  });

  it('invokes onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <ASTMetadataInspector
        chunk={sampleChunk}
        isOpen={true}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders real mockAstChunks calls and imports accurately', async () => {
    const user = userEvent.setup();
    const handleSelectCall = vi.fn();

    // mockAstChunks[0] is solve_dependencies
    const solveDepsChunk = mockAstChunks[0];

    const { rerender } = render(
      <ASTMetadataInspector
        chunk={solveDepsChunk}
        isOpen={true}
        onClose={vi.fn()}
        onSelectCall={handleSelectCall}
      />
    );

    expect(screen.getByTestId('ast-calls-section')).toBeInTheDocument();
    expect(screen.getByTestId('call-badge-get_param_sub_dependant')).toHaveTextContent(
      'get_param_sub_dependant ↗'
    );
    expect(screen.getByTestId('call-badge-solve_dependencies')).toHaveTextContent(
      'solve_dependencies ↗'
    );

    expect(screen.getByTestId('import-badge-inspect')).toHaveTextContent('inspect');
    expect(screen.getByTestId('import-badge-typing')).toHaveTextContent('typing');
    expect(screen.getByTestId('import-badge-fastapi.params')).toHaveTextContent('fastapi.params');

    await user.click(screen.getByTestId('call-badge-get_param_sub_dependant'));
    expect(handleSelectCall).toHaveBeenCalledWith('get_param_sub_dependant');

    // Rerender with mockAstChunks[1] (WebSocketEndpoint)
    const wsChunk = mockAstChunks[1];
    rerender(
      <ASTMetadataInspector
        chunk={wsChunk}
        isOpen={true}
        onClose={vi.fn()}
        onSelectCall={handleSelectCall}
      />
    );

    expect(screen.getByTestId('call-badge-websocket.accept')).toHaveTextContent(
      'websocket.accept ↗'
    );
    expect(screen.getByTestId('import-badge-starlette.websockets')).toHaveTextContent(
      'starlette.websockets'
    );
  });
});

describe('CodeViewerContainer AST Call Graph Integration', () => {
  it('forwards onSelectCall from CodeViewerContainer down to ASTMetadataInspector', async () => {
    const user = userEvent.setup();
    const handleSelectCall = vi.fn();
    const handleSelectChunk = vi.fn();

    render(
      <CodeViewerContainer
        chunks={mockAstChunks}
        selectedChunkId={mockAstChunks[0].id}
        onSelectChunk={handleSelectChunk}
        onSelectCall={handleSelectCall}
      />
    );

    // Open the inspector drawer via the toggle inspector button in header
    const toggleInspectorBtn = screen.getByTestId('toggle-ast-inspector-btn');
    await user.click(toggleInspectorBtn);

    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

    // Click on call badge
    const badge = screen.getByTestId('call-badge-get_param_sub_dependant');
    await user.click(badge);

    expect(handleSelectCall).toHaveBeenCalledWith('get_param_sub_dependant');
  });

  it('falls back to onSelectChunk when onSelectCall is not provided and callee exists in chunks', async () => {
    const user = userEvent.setup();
    const handleSelectChunk = vi.fn();

    // Create chunks where chunk A calls chunk B
    const chunkA: AstCodeChunk = {
      ...mockAstChunks[0],
      id: 'chunk-caller',
      identifier: 'caller_fn',
      calls: ['receiver_fn'],
    };
    const chunkB: AstCodeChunk = {
      ...mockAstChunks[1],
      id: 'chunk-receiver',
      identifier: 'receiver_fn',
      calls: [],
    };

    render(
      <CodeViewerContainer
        chunks={[chunkA, chunkB]}
        selectedChunkId={chunkA.id}
        onSelectChunk={handleSelectChunk}
      />
    );

    // Open inspector drawer
    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

    // Click on receiver_fn call badge
    const badge = screen.getByTestId('call-badge-receiver_fn');
    await user.click(badge);

    // Fallback should switch chunk to chunkB
    expect(handleSelectChunk).toHaveBeenCalledWith(chunkB.id);
  });

  it('falls back to onSelectChunk handling self. prefix when onSelectCall is not provided', async () => {
    const user = userEvent.setup();
    const handleSelectChunk = vi.fn();

    const chunkA: AstCodeChunk = {
      ...mockAstChunks[0],
      id: 'chunk-caller-self',
      identifier: 'caller_fn',
      calls: ['self.helper_method'],
    };
    const chunkB: AstCodeChunk = {
      ...mockAstChunks[1],
      id: 'chunk-receiver-self',
      identifier: 'helper_method',
      calls: [],
    };

    render(
      <CodeViewerContainer
        chunks={[chunkA, chunkB]}
        selectedChunkId={chunkA.id}
        onSelectChunk={handleSelectChunk}
      />
    );

    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    const badge = screen.getByTestId('call-badge-self.helper_method');
    await user.click(badge);

    expect(handleSelectChunk).toHaveBeenCalledWith(chunkB.id);
  });
});

describe('App Call Graph Multi-Hop Navigation & Entity Lookup Suite', () => {
  it('switches directly when callee is already present in activeChunks', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Connect repository to immediately load mockAstChunks into activeChunks
    await user.click(screen.getByTestId('connect-repo-btn'));
    const repoCard = await screen.findByTestId('repo-card-requests');
    await user.click(repoCard);

    // Wait for active chunks to load in code viewer tabs
    await waitFor(() => {
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
    });

    // Open inspector drawer
    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

    const lookupSpy = vi.spyOn(apiClient, 'lookupEntity');

    // Click on solve_dependencies call badge (which is chunk 0's own identifier)
    const callBadge = screen.getByTestId('call-badge-solve_dependencies');
    await user.click(callBadge);

    // Should NOT have called lookupEntity because it's locally present
    expect(lookupSpy).not.toHaveBeenCalled();
    // And chunk 0 remains or is selected
    expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toHaveAttribute('aria-selected', 'true');
  });

  it('invokes apiClient.lookupEntity and appends newly retrieved chunk when not in activeChunks', async () => {
    const user = userEvent.setup();
    const externalChunk: AstCodeChunk = {
      id: 'chunk-external-callee-1',
      filePath: 'fastapi/dependencies/models.py',
      fileName: 'models.py',
      astNodeType: 'FunctionDef',
      identifier: 'get_param_sub_dependant',
      startLine: 120,
      endLine: 160,
      code: 'def get_param_sub_dependant(param):\n    return Dependant()',
      relevanceScore: 0.99,
      calls: [],
      imports: ['fastapi.params'],
    };

    const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
      identifier: 'get_param_sub_dependant',
      count: 1,
      chunks: [externalChunk],
    });

    render(<App />);

    // Connect repository to load mockAstChunks
    await user.click(screen.getByTestId('connect-repo-btn'));
    const repoCard = await screen.findByTestId('repo-card-requests');
    await user.click(repoCard);

    await waitFor(() => {
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
    });

    // Open inspector drawer
    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

    // Click on get_param_sub_dependant call badge (which is NOT in activeChunks initially)
    const callBadge = screen.getByTestId('call-badge-get_param_sub_dependant');
    await user.click(callBadge);

    // Verify lookupEntity was called with clean identifier
    await waitFor(() => {
      expect(lookupSpy).toHaveBeenCalledWith('get_param_sub_dependant');
    });

    // Verify externalChunk was appended to activeChunks and selected
    await waitFor(() => {
      expect(screen.getByTestId(`chunk-tab-${externalChunk.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`chunk-tab-${externalChunk.id}`)).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('navigates to callee and invokes apiClient.lookupEntity when clicking call badge in App', async () => {
    const user = userEvent.setup();
    const externalChunk: AstCodeChunk = {
      id: 'chunk-external-ws-1',
      filePath: 'fastapi/websockets.py',
      fileName: 'websockets.py',
      astNodeType: 'FunctionDef',
      identifier: 'websocket.accept',
      startLine: 100,
      endLine: 120,
      code: 'def accept(self):\n    return None',
      relevanceScore: 0.95,
      calls: [],
      imports: [],
    };

    const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
      identifier: 'websocket.accept',
      count: 1,
      chunks: [externalChunk],
    });

    render(<App />);

    await user.click(screen.getByTestId('connect-repo-btn'));
    const repoCard = await screen.findByTestId('repo-card-requests');
    await user.click(repoCard);

    // Switch to WebSocketEndpoint tab (mockAstChunks[1])
    const wsTab = await screen.findByTestId(`chunk-tab-${mockAstChunks[1].id}`);
    await user.click(wsTab);

    // Open inspector
    await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
    expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

    // Click on websocket.accept call badge
    const callBadge = screen.getByTestId('call-badge-websocket.accept');
    await user.click(callBadge);

    await waitFor(() => {
      expect(lookupSpy).toHaveBeenCalledWith('websocket.accept');
    });

    await waitFor(() => {
      expect(screen.getByTestId(`chunk-tab-${externalChunk.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`chunk-tab-${externalChunk.id}`)).toHaveAttribute('aria-selected', 'true');
    });
  });
});

