import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { CodeViewerPane } from '../components/viewer/CodeViewerPane';
import { ASTMetadataInspector } from '../components/viewer/ASTMetadataInspector';
import { apiClient } from '../services/apiClient';
import { AstCodeChunk } from '../types';
import { mockAstChunks } from '../services/mockAstData';

describe('Challenger 2 Empirical Verification: Milestone 4 Component Integration & Adversarial Suite', () => {
  // Test fixture chunks
  const chunkAlpha: AstCodeChunk = {
    id: 'chunk-alpha',
    filePath: 'core/engine.py',
    fileName: 'engine.py',
    astNodeType: 'FunctionDef',
    identifier: 'start_engine',
    startLine: 10,
    endLine: 40,
    language: 'python',
    repoFullName: 'acme/core-engine',
    relevanceScore: 0.95,
    docstring: 'Starts the primary processing engine.',
    parameters: ['timeout: int = 30', 'verbose: bool = True'],
    decorators: ['@logged'],
    calls: ['check_fuel', 'self.verify_ignition', 'Telemetry.broadcast'],
    imports: ['sys', 'os', 'logging'],
    code: 'def start_engine(timeout: int = 30, verbose: bool = True):\n    # Alpha code content\n    check_fuel()\n    self.verify_ignition()\n    Telemetry.broadcast()\n    return True',
  };

  const chunkBeta: AstCodeChunk = {
    id: 'chunk-beta',
    filePath: 'core/fuel.py',
    fileName: 'fuel.py',
    astNodeType: 'FunctionDef',
    identifier: 'check_fuel',
    startLine: 50,
    endLine: 75,
    language: 'python',
    repoFullName: 'acme/core-engine',
    relevanceScore: 0.88,
    docstring: 'Verifies fuel levels.',
    parameters: ['min_threshold: float = 0.2'],
    decorators: [],
    calls: ['self.read_sensors'],
    imports: ['sensors'],
    code: 'def check_fuel(min_threshold: float = 0.2):\n    # Beta code content\n    return True',
  };

  const chunkGamma: AstCodeChunk = {
    id: 'chunk-gamma',
    filePath: 'core/ignition.py',
    fileName: 'ignition.py',
    astNodeType: 'FunctionDef',
    identifier: 'verify_ignition',
    startLine: 80,
    endLine: 110,
    language: 'python',
    repoFullName: 'acme/core-engine',
    relevanceScore: 0.82,
    docstring: 'Checks ignition spark.',
    parameters: [],
    decorators: [],
    calls: [],
    imports: [],
    code: 'def verify_ignition():\n    # Gamma code content\n    return True',
  };

  const chunkDelta: AstCodeChunk = {
    id: 'chunk-delta',
    filePath: 'telemetry/broadcast.py',
    fileName: 'broadcast.py',
    astNodeType: 'ClassDef',
    identifier: 'Telemetry.broadcast',
    startLine: 120,
    endLine: 160,
    language: 'python',
    repoFullName: 'acme/core-engine',
    relevanceScore: 0.79,
    docstring: 'Broadcasts telemetry status.',
    parameters: ['msg: str'],
    decorators: [],
    calls: [],
    imports: ['network'],
    code: 'class Telemetry:\n    @staticmethod\n    def broadcast(msg: str):\n        pass',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* =========================================================================
   * Suite 1: onSelectCall Prop Plumbing and Defensive Fallback in CodeViewerContainer & CodeViewerPane
   * ========================================================================= */
  describe('Suite 1: onSelectCall Prop Plumbing and Defensive Fallback', () => {
    it('1.1 forwards onSelectCall when provided to CodeViewerContainer', async () => {
      const user = userEvent.setup();
      const mockOnSelectCall = vi.fn();
      const mockOnSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={[chunkAlpha, chunkBeta]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={mockOnSelectChunk}
          onSelectCall={mockOnSelectCall}
        />
      );

      // Open inspector drawer
      const toggleBtn = screen.getByTestId('toggle-ast-inspector-btn');
      await user.click(toggleBtn);
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

      // Click on call badge
      const callBadge = screen.getByTestId('call-badge-check_fuel');
      await user.click(callBadge);

      expect(mockOnSelectCall).toHaveBeenCalledTimes(1);
      expect(mockOnSelectCall).toHaveBeenCalledWith('check_fuel');
      // Because onSelectCall was provided, onSelectChunk fallback is NOT invoked directly by container
      expect(mockOnSelectChunk).not.toHaveBeenCalled();
    });

    it('1.2 works identically via CodeViewerPane re-export alias', async () => {
      const user = userEvent.setup();
      const mockOnSelectCall = vi.fn();
      const mockOnSelectChunk = vi.fn();

      render(
        <CodeViewerPane
          chunks={[chunkAlpha, chunkBeta]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={mockOnSelectChunk}
          onSelectCall={mockOnSelectCall}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      await user.click(screen.getByTestId('call-badge-check_fuel'));

      expect(mockOnSelectCall).toHaveBeenCalledWith('check_fuel');
      expect(mockOnSelectChunk).not.toHaveBeenCalled();
    });

    it('1.3 falls back to onSelectChunk when onSelectCall is omitted (exact match)', async () => {
      const user = userEvent.setup();
      const mockOnSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={[chunkAlpha, chunkBeta]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={mockOnSelectChunk}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      await user.click(screen.getByTestId('call-badge-check_fuel'));

      // Fallback searches chunks and finds chunkBeta
      expect(mockOnSelectChunk).toHaveBeenCalledTimes(1);
      expect(mockOnSelectChunk).toHaveBeenCalledWith(chunkBeta.id);
    });

    it('1.4 falls back to onSelectChunk handling self. prefix when onSelectCall is omitted', async () => {
      const user = userEvent.setup();
      const mockOnSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={[chunkAlpha, chunkGamma]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={mockOnSelectChunk}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      // chunkAlpha calls 'self.verify_ignition', chunkGamma identifier is 'verify_ignition'
      const selfCallBadge = screen.getByTestId('call-badge-self.verify_ignition');
      await user.click(selfCallBadge);

      expect(mockOnSelectChunk).toHaveBeenCalledTimes(1);
      expect(mockOnSelectChunk).toHaveBeenCalledWith(chunkGamma.id);
    });

    it('1.5 falls back to onSelectChunk handling qualified name (Telemetry.broadcast)', async () => {
      const user = userEvent.setup();
      const mockOnSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={[chunkAlpha, chunkDelta]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={mockOnSelectChunk}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const broadcastBadge = screen.getByTestId('call-badge-Telemetry.broadcast');
      await user.click(broadcastBadge);

      expect(mockOnSelectChunk).toHaveBeenCalledTimes(1);
      expect(mockOnSelectChunk).toHaveBeenCalledWith(chunkDelta.id);
    });

    it('1.6 safely no-ops without throwing when callee does not match any chunk in chunks', async () => {
      const user = userEvent.setup();
      const mockOnSelectChunk = vi.fn();

      const chunkWithUnknownCall: AstCodeChunk = {
        ...chunkAlpha,
        calls: ['unknown_external_func', 'another_missing_func'],
      };

      render(
        <CodeViewerContainer
          chunks={[chunkWithUnknownCall]}
          selectedChunkId={chunkWithUnknownCall.id}
          onSelectChunk={mockOnSelectChunk}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const unknownBadge = screen.getByTestId('call-badge-unknown_external_func');

      await expect(user.click(unknownBadge)).resolves.not.toThrow();
      expect(mockOnSelectChunk).not.toHaveBeenCalled();
    });
  });

  /* =========================================================================
   * Suite 2: Active Tab Selection and Code Display View Updates upon Call Badge Click
   * ========================================================================= */
  describe('Suite 2: Active Tab Selection and Code Display View Updates', () => {
    // Harness component simulating stateful container parent
    const InteractiveViewerHarness: React.FC<{
      initialChunks: AstCodeChunk[];
      initialSelectedId: string;
    }> = ({ initialChunks, initialSelectedId }) => {
      const [chunks, setChunks] = useState<AstCodeChunk[]>(initialChunks);
      const [selectedId, setSelectedId] = useState<string>(initialSelectedId);

      const handleSelectCall = (callIdentifier: string) => {
        const cleanName = callIdentifier.replace(/^self\./, '');
        const match = chunks.find(
          (c) =>
            c.identifier === callIdentifier ||
            c.identifier === cleanName ||
            c.identifier.endsWith(`.${cleanName}`) ||
            cleanName.endsWith(`.${c.identifier}`)
        );
        if (match) {
          setSelectedId(match.id);
        }
      };

      return (
        <CodeViewerPane
          chunks={chunks}
          selectedChunkId={selectedId}
          onSelectChunk={setSelectedId}
          onSelectCall={handleSelectCall}
        />
      );
    };

    it('2.1 clicking call badge updates active tab selection and code display view (Local match)', async () => {
      const user = userEvent.setup();

      render(
        <InteractiveViewerHarness
          initialChunks={[chunkAlpha, chunkBeta, chunkGamma]}
          initialSelectedId={chunkAlpha.id}
        />
      );

      // Verify initial state: chunkAlpha is active
      const tabAlpha = screen.getByTestId(`chunk-tab-${chunkAlpha.id}`);
      const tabBeta = screen.getByTestId(`chunk-tab-${chunkBeta.id}`);
      expect(tabAlpha).toHaveAttribute('aria-selected', 'true');
      expect(tabBeta).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByText(/# Alpha code content/)).toBeInTheDocument();

      // Open inspector drawer
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

      // Click on check_fuel call badge
      const callBadge = screen.getByTestId('call-badge-check_fuel');
      await user.click(callBadge);

      // Tab selection should update to chunkBeta
      expect(tabAlpha).toHaveAttribute('aria-selected', 'false');
      expect(tabBeta).toHaveAttribute('aria-selected', 'true');

      // Code display view should update to chunkBeta's code
      expect(screen.getByText(/# Beta code content/)).toBeInTheDocument();
      expect(screen.queryByText(/# Alpha code content/)).not.toBeInTheDocument();
    });

    it('2.2 clicking call badge with fallback updates active tab and code display when onSelectCall is omitted', async () => {
      const user = userEvent.setup();

      const FallbackViewerHarness: React.FC = () => {
        const [selectedId, setSelectedId] = useState<string>(chunkAlpha.id);
        return (
          <CodeViewerPane
            chunks={[chunkAlpha, chunkBeta]}
            selectedChunkId={selectedId}
            onSelectChunk={setSelectedId}
          />
        );
      };

      render(<FallbackViewerHarness />);

      expect(screen.getByTestId(`chunk-tab-${chunkAlpha.id}`)).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/# Alpha code content/)).toBeInTheDocument();

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      await user.click(screen.getByTestId('call-badge-check_fuel'));

      expect(screen.getByTestId(`chunk-tab-${chunkBeta.id}`)).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/# Beta code content/)).toBeInTheDocument();
    });

    it('2.3 App integration: clicking call badge not in activeChunks triggers apiClient.lookupEntity, adds tab, and updates code display', async () => {
      const user = userEvent.setup();

      const externalCallee: AstCodeChunk = {
        id: 'chunk-dynamically-resolved',
        filePath: 'services/dynamic.py',
        fileName: 'dynamic.py',
        astNodeType: 'FunctionDef',
        identifier: 'verify_system_clock',
        startLine: 1,
        endLine: 20,
        language: 'python',
        repoFullName: 'psf/requests',
        relevanceScore: 0.99,
        docstring: 'Dynamically retrieved clock verification entity.',
        parameters: [],
        decorators: [],
        calls: [],
        imports: ['time'],
        code: 'def verify_system_clock():\n    # Dynamic code loaded via lookupEntity\n    return time.monotonic()',
      };

      // Mock repo list
      vi.spyOn(apiClient, 'getRepositories').mockResolvedValue([
        {
          id: 'requests',
          name: 'psf/requests',
          path: 'fixtures/requests',
          chunksCount: 284,
          filesCount: 17,
          status: 'indexed',
          description: 'Python HTTP for Humans',
        },
      ]);

      const chunkWithExternalCall: AstCodeChunk = {
        ...mockAstChunks[0],
        id: 'chunk-caller-external',
        identifier: 'caller_of_clock',
        calls: ['verify_system_clock'],
        imports: [],
        code: 'def caller_of_clock():\n    # Caller initial code\n    verify_system_clock()',
      };

      vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValue([chunkWithExternalCall]);

      const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockResolvedValue({
        identifier: 'verify_system_clock',
        count: 1,
        chunks: [externalCallee],
      });

      render(<App />);

      // Connect repository to load chunkWithExternalCall
      await user.click(screen.getByTestId('connect-repo-btn'));
      const openBtn = await screen.findByTestId('open-repo-btn-requests');
      await user.click(openBtn);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${chunkWithExternalCall.id}`)).toBeInTheDocument();
      });

      // Verify initial code view
      expect(screen.getByText(/# Caller initial code/)).toBeInTheDocument();

      // Open inspector
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

      // Click on verify_system_clock badge
      const callBadge = screen.getByTestId('call-badge-verify_system_clock');
      await user.click(callBadge);

      // Wait for lookupEntity to resolve and new tab to be added
      await waitFor(() => {
        expect(lookupSpy).toHaveBeenCalledWith('verify_system_clock');
      });

      await waitFor(() => {
        const newTab = screen.getByTestId(`chunk-tab-${externalCallee.id}`);
        expect(newTab).toBeInTheDocument();
        expect(newTab).toHaveAttribute('aria-selected', 'true');
      });

      // Code view should now show the newly fetched code
      await waitFor(() => {
        expect(screen.getByText(/# Dynamic code loaded via lookupEntity/)).toBeInTheDocument();
      });
    });

    it('2.4 App handles lookupEntity rejection gracefully without breaking UI or active tabs', async () => {
      const user = userEvent.setup();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(apiClient, 'getRepositories').mockResolvedValue([
        {
          id: 'requests',
          name: 'psf/requests',
          path: 'fixtures/requests',
          chunksCount: 284,
          filesCount: 17,
          status: 'indexed',
          description: 'Python HTTP for Humans',
        },
      ]);

      const chunkWithBrokenCall: AstCodeChunk = {
        ...mockAstChunks[0],
        id: 'chunk-caller-broken',
        identifier: 'caller_broken',
        calls: ['failing_network_call'],
        imports: [],
        code: 'def caller_broken():\n    # Unbroken code\n    failing_network_call()',
      };

      vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValue([chunkWithBrokenCall]);
      vi.spyOn(apiClient, 'lookupEntity').mockRejectedValue(new Error('500 Internal Server Error'));

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const openBtn = await screen.findByTestId('open-repo-btn-requests');
      await user.click(openBtn);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${chunkWithBrokenCall.id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const failingBadge = screen.getByTestId('call-badge-failing_network_call');

      // Click badge that fails in lookupEntity
      await user.click(failingBadge);

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalled();
      });

      // Existing tab remains active and UI does not crash
      expect(screen.getByTestId(`chunk-tab-${chunkWithBrokenCall.id}`)).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/# Unbroken code/)).toBeInTheDocument();

      warnSpy.mockRestore();
    });
  });

  /* =========================================================================
   * Suite 3: ASTMetadataInspector Open/Close Toggle Smoothness & Section Rendering
   * ========================================================================= */
  describe('Suite 3: ASTMetadataInspector Open/Close Toggle Smoothness', () => {
    it('3.1 toggles open and closed via CodeViewerHeader button', async () => {
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={[chunkAlpha]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={vi.fn()}
        />
      );

      // Initially closed
      expect(screen.queryByTestId('ast-metadata-inspector')).not.toBeInTheDocument();

      // Click toggle button -> opens
      const toggleBtn = screen.getByTestId('toggle-ast-inspector-btn');
      await user.click(toggleBtn);
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
      expect(screen.getByTestId('ast-calls-section')).toBeInTheDocument();
      expect(screen.getByTestId('ast-imports-section')).toBeInTheDocument();

      // Click toggle button again -> closes
      await user.click(toggleBtn);
      expect(screen.queryByTestId('ast-metadata-inspector')).not.toBeInTheDocument();
    });

    it('3.2 closes cleanly via Inspector internal Close button', async () => {
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={[chunkAlpha]}
          selectedChunkId={chunkAlpha.id}
          onSelectChunk={vi.fn()}
        />
      );

      // Open inspector
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

      // Click Close button inside drawer
      const closeBtn = screen.getByRole('button', { name: /close/i });
      await user.click(closeBtn);

      expect(screen.queryByTestId('ast-metadata-inspector')).not.toBeInTheDocument();
    });

    it('3.3 smoothly renders when chunk has calls but no imports', () => {
      const chunkCallsOnly: AstCodeChunk = {
        ...chunkAlpha,
        calls: ['call_one', 'call_two'],
        imports: [],
      };

      render(
        <ASTMetadataInspector
          chunk={chunkCallsOnly}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
      expect(screen.getByTestId('ast-calls-section')).toBeInTheDocument();
      expect(screen.getByText('Called Functions (2):')).toBeInTheDocument();
      expect(screen.queryByTestId('ast-imports-section')).not.toBeInTheDocument();
    });

    it('3.4 smoothly renders when chunk has imports but no calls', () => {
      const chunkImportsOnly: AstCodeChunk = {
        ...chunkAlpha,
        calls: [],
        imports: ['math', 'json'],
      };

      render(
        <ASTMetadataInspector
          chunk={chunkImportsOnly}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
      expect(screen.queryByTestId('ast-calls-section')).not.toBeInTheDocument();
      expect(screen.getByTestId('ast-imports-section')).toBeInTheDocument();
      expect(screen.getByText('Imports (2):')).toBeInTheDocument();
    });

    it('3.5 smoothly updates content when active chunk changes while inspector remains open', async () => {
      const user = userEvent.setup();

      const DynamicChunkHarness: React.FC = () => {
        const [selectedId, setSelectedId] = useState<string>(chunkAlpha.id);
        return (
          <CodeViewerContainer
            chunks={[chunkAlpha, chunkGamma]}
            selectedChunkId={selectedId}
            onSelectChunk={setSelectedId}
          />
        );
      };

      render(<DynamicChunkHarness />);

      // Open inspector while on chunkAlpha (has 3 calls, 3 imports)
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      expect(screen.getByTestId('ast-calls-section')).toBeInTheDocument();
      expect(screen.getByText('Called Functions (3):')).toBeInTheDocument();
      expect(screen.getByText('Imports (3):')).toBeInTheDocument();

      // Switch to chunkGamma via tab click (chunkGamma has 0 calls, 0 imports)
      const gammaTab = screen.getByTestId(`chunk-tab-${chunkGamma.id}`);
      await user.click(gammaTab);

      // Inspector remains open and updates smoothly
      const inspector = screen.getByTestId('ast-metadata-inspector');
      expect(inspector).toBeInTheDocument();
      expect(within(inspector).getByText('verify_ignition')).toBeInTheDocument();
      // Calls and imports sections should now be absent
      expect(screen.queryByTestId('ast-calls-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ast-imports-section')).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
   * Suite 4: Adversarial Stress & Edge Cases
   * ========================================================================= */
  describe('Suite 4: Adversarial Stress & Edge Cases', () => {
    it('4.1 handles massive numbers of calls and imports (50 calls, 50 imports) without crashing', async () => {
      const user = userEvent.setup();
      const onSelectCallMock = vi.fn();

      const manyCalls = Array.from({ length: 50 }, (_, i) => `func_call_${i}`);
      const manyImports = Array.from({ length: 50 }, (_, i) => `package.module_${i}`);

      const stressChunk: AstCodeChunk = {
        ...chunkAlpha,
        calls: manyCalls,
        imports: manyImports,
      };

      render(
        <ASTMetadataInspector
          chunk={stressChunk}
          isOpen={true}
          onClose={vi.fn()}
          onSelectCall={onSelectCallMock}
        />
      );

      expect(screen.getByTestId('ast-calls-section')).toBeInTheDocument();
      expect(screen.getByText('Called Functions (50):')).toBeInTheDocument();
      expect(screen.getByText('Imports (50):')).toBeInTheDocument();

      // Click 50th badge
      const lastBadge = screen.getByTestId('call-badge-func_call_49');
      await user.click(lastBadge);
      expect(onSelectCallMock).toHaveBeenCalledWith('func_call_49');
    });

    it('4.2 handles unusual call identifiers (deep nesting, underscores, dots)', async () => {
      const user = userEvent.setup();
      const onSelectCallMock = vi.fn();

      const oddChunk: AstCodeChunk = {
        ...chunkAlpha,
        calls: ['a.b.c.d.e', '_private_func', '__dunder_call__'],
        imports: [],
      };

      render(
        <ASTMetadataInspector
          chunk={oddChunk}
          isOpen={true}
          onClose={vi.fn()}
          onSelectCall={onSelectCallMock}
        />
      );

      const nestedBadge = screen.getByTestId('call-badge-a.b.c.d.e');
      expect(nestedBadge).toHaveTextContent('a.b.c.d.e ↗');
      await user.click(nestedBadge);
      expect(onSelectCallMock).toHaveBeenCalledWith('a.b.c.d.e');
    });

    it('4.3 handles lookupEntity returning empty chunks array without crashing', async () => {
      const user = userEvent.setup();

      vi.spyOn(apiClient, 'getRepositories').mockResolvedValue([
        {
          id: 'requests',
          name: 'psf/requests',
          path: 'fixtures/requests',
          chunksCount: 284,
          filesCount: 17,
          status: 'indexed',
          description: 'Python HTTP for Humans',
        },
      ]);

      const chunkEmptyLookup: AstCodeChunk = {
        ...mockAstChunks[0],
        id: 'chunk-empty-lookup',
        identifier: 'caller_empty',
        calls: ['non_existent_symbol'],
        imports: [],
      };

      vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValue([chunkEmptyLookup]);
      vi.spyOn(apiClient, 'lookupEntity').mockResolvedValue({
        identifier: 'non_existent_symbol',
        count: 0,
        chunks: [],
      });

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const openBtn = await screen.findByTestId('open-repo-btn-requests');
      await user.click(openBtn);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${chunkEmptyLookup.id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const badge = screen.getByTestId('call-badge-non_existent_symbol');

      await user.click(badge);

      // Verify original chunk remains selected and active
      expect(screen.getByTestId(`chunk-tab-${chunkEmptyLookup.id}`)).toHaveAttribute('aria-selected', 'true');
    });
  });
});
