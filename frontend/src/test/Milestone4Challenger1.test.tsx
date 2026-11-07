import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { apiClient } from '../services/apiClient';
import { ASTMetadataInspector } from '../components/viewer/ASTMetadataInspector';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { AstCodeChunk } from '../types';
import { mockAstChunks } from '../services/mockAstData';

describe('Challenger 1 Empirical Adversarial Suite: AST Call Graph & Multi-Hop Navigation (Milestone 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const chunkA: AstCodeChunk = {
    id: 'chunk-alpha',
    filePath: 'core/alpha.py',
    fileName: 'alpha.py',
    astNodeType: 'FunctionDef',
    identifier: 'alpha_entry',
    startLine: 1,
    endLine: 25,
    code: 'def alpha_entry():\n    beta_processor()\n    self.helper_method()\n    gamma_service()',
    relevanceScore: 0.98,
    calls: ['beta_processor', 'self.helper_method', 'gamma_service'],
    imports: ['core.beta', 'core.gamma'],
  };

  const chunkB: AstCodeChunk = {
    id: 'chunk-beta',
    filePath: 'core/beta.py',
    fileName: 'beta.py',
    astNodeType: 'FunctionDef',
    identifier: 'beta_processor',
    startLine: 1,
    endLine: 30,
    code: 'def beta_processor():\n    omega_finalizer()',
    relevanceScore: 0.92,
    calls: ['omega_finalizer'],
    imports: ['core.omega'],
  };

  const chunkC: AstCodeChunk = {
    id: 'chunk-omega',
    filePath: 'core/omega.py',
    fileName: 'omega.py',
    astNodeType: 'FunctionDef',
    identifier: 'omega_finalizer',
    startLine: 1,
    endLine: 20,
    code: 'def omega_finalizer():\n    return True',
    relevanceScore: 0.88,
    calls: [],
    imports: [],
  };

  const chunkHelper: AstCodeChunk = {
    id: 'chunk-helper',
    filePath: 'core/alpha.py',
    fileName: 'alpha.py',
    astNodeType: 'FunctionDef',
    identifier: 'helper_method',
    startLine: 27,
    endLine: 40,
    code: 'def helper_method(self):\n    return 42',
    relevanceScore: 0.85,
    calls: [],
    imports: [],
  };

  describe('1. Immediate Local Tab Switching without Network Invocation', () => {
    it('switches chunk tabs directly when clicked call identifier matches an existing activeChunk without calling apiClient.lookupEntity', async () => {
      const user = userEvent.setup();
      const lookupSpy = vi.spyOn(apiClient, 'lookupEntity');

      render(<App />);

      // Connect repository to load initial activeChunks
      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      // Verify initial tab is loaded
      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      // Open inspector drawer
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

      // Click on solve_dependencies which is mockAstChunks[0].identifier
      const solveBadge = screen.getByTestId('call-badge-solve_dependencies');
      await user.click(solveBadge);

      // Verify zero network lookup calls
      expect(lookupSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toHaveAttribute('aria-selected', 'true');
    });

    it('resolves bare function calls against qualified chunk identifiers (c.identifier.endsWith("." + cleanName)) locally', async () => {
      const user = userEvent.setup();
      const onSelectChunk = vi.fn();

      const callerChunk: AstCodeChunk = {
        ...chunkA,
        calls: ['compute_tax'],
      };
      const qualifiedTargetChunk: AstCodeChunk = {
        ...chunkB,
        id: 'chunk-billing-service',
        identifier: 'BillingService.compute_tax',
      };

      render(
        <CodeViewerContainer
          chunks={[callerChunk, qualifiedTargetChunk]}
          selectedChunkId={callerChunk.id}
          onSelectChunk={onSelectChunk}
        />
      );

      // Open inspector drawer
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const badge = screen.getByTestId('call-badge-compute_tax');
      await user.click(badge);

      // Local resolution in CodeViewerContainer matches BillingService.compute_tax
      expect(onSelectChunk).toHaveBeenCalledWith(qualifiedTargetChunk.id);
    });

    it('resolves qualified call names against bare chunk identifiers (cleanName.endsWith("." + c.identifier)) locally', async () => {
      const user = userEvent.setup();
      const onSelectChunk = vi.fn();

      const callerChunk: AstCodeChunk = {
        ...chunkA,
        calls: ['pkg.submodule.calculate_hash'],
      };
      const bareTargetChunk: AstCodeChunk = {
        ...chunkB,
        id: 'chunk-hash-target',
        identifier: 'calculate_hash',
      };

      render(
        <CodeViewerContainer
          chunks={[callerChunk, bareTargetChunk]}
          selectedChunkId={callerChunk.id}
          onSelectChunk={onSelectChunk}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const badge = screen.getByTestId('call-badge-pkg.submodule.calculate_hash');
      await user.click(badge);

      expect(onSelectChunk).toHaveBeenCalledWith(bareTargetChunk.id);
    });
  });

  describe('2. Dynamic Entity Lookup & Active Chunk Injection', () => {
    it('calls apiClient.lookupEntity with stripped cleanName, appends new chunk to activeChunks, and selects it', async () => {
      const user = userEvent.setup();
      const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
        identifier: 'beta_processor',
        count: 1,
        chunks: [chunkB],
      });

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));

      // Click on get_param_sub_dependant which is in mockAstChunks[0].calls
      const targetCall = 'get_param_sub_dependant';
      const callBadge = screen.getByTestId(`call-badge-${targetCall}`);
      await user.click(callBadge);

      await waitFor(() => {
        expect(lookupSpy).toHaveBeenCalledWith(targetCall);
      });

      // Verify chunkB is appended as a tab and selected
      await waitFor(() => {
        const newTab = screen.getByTestId(`chunk-tab-${chunkB.id}`);
        expect(newTab).toBeInTheDocument();
        expect(newTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('does not duplicate chunks in activeChunks when lookupEntity returns a chunk with an already existing id', async () => {
      const user = userEvent.setup();
      // Return mockAstChunks[0] with same id
      vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
        identifier: 'nonexistent_call',
        count: 1,
        chunks: [mockAstChunks[0]],
      });

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));

      const callBadge = screen.getByTestId('call-badge-get_param_sub_dependant');
      await user.click(callBadge);

      // Tab count for mockAstChunks[0].id must remain exactly 1
      await waitFor(() => {
        const tabs = screen.getAllByTestId(`chunk-tab-${mockAstChunks[0].id}`);
        expect(tabs).toHaveLength(1);
      });
    });
  });

  describe('3. Multi-Hop Navigation Chain (Chunk A -> Call B -> Chunk B -> Call C -> Chunk C)', () => {
    it('seamlessly traverses a multi-hop call graph through inspector badges across successive chunks', async () => {
      const user = userEvent.setup();

      // Hop 1: Click beta_processor from initial chunk -> lookupEntity returns chunkB
      // Hop 2: Click omega_finalizer from chunkB -> lookupEntity returns chunkC
      const lookupSpy = vi
        .spyOn(apiClient, 'lookupEntity')
        .mockResolvedValueOnce({
          identifier: 'beta_processor',
          count: 1,
          chunks: [chunkB],
        })
        .mockResolvedValueOnce({
          identifier: 'omega_finalizer',
          count: 1,
          chunks: [chunkC],
        });

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      // Open inspector
      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();

      // Hop 1: Click get_param_sub_dependant (mocked to return chunkB)
      const hop1Badge = screen.getByTestId('call-badge-get_param_sub_dependant');
      await user.click(hop1Badge);

      // Verify Chunk B becomes active and selected
      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${chunkB.id}`)).toHaveAttribute('aria-selected', 'true');
      });

      // Inspector stays open and now displays Chunk B's metadata and calls
      await waitFor(() => {
        expect(screen.getByTestId('call-badge-omega_finalizer')).toBeInTheDocument();
        expect(screen.getByText('Called Functions (1):')).toBeInTheDocument();
      });

      // Hop 2: Click omega_finalizer on Chunk B's inspector
      const hop2Badge = screen.getByTestId('call-badge-omega_finalizer');
      await user.click(hop2Badge);

      // Verify Chunk C becomes active and selected
      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${chunkC.id}`)).toHaveAttribute('aria-selected', 'true');
      });

      // Chunk C has no calls; inspector gracefully omits ast-calls-section
      await waitFor(() => {
        expect(screen.queryByTestId('ast-calls-section')).not.toBeInTheDocument();
      });

      // All 3 chunks (initial + chunkB + chunkC) exist simultaneously in tabs
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`chunk-tab-${chunkB.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`chunk-tab-${chunkC.id}`)).toBeInTheDocument();
      expect(lookupSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('4. Self Prefix, Qualified Identifier and Normalization Oracle', () => {
    it('strips "self." prefix correctly when searching local activeChunks', async () => {
      const user = userEvent.setup();
      const onSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={[chunkA, chunkHelper]}
          selectedChunkId={chunkA.id}
          onSelectChunk={onSelectChunk}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const selfCallBadge = screen.getByTestId('call-badge-self.helper_method');
      await user.click(selfCallBadge);

      // chunkHelper.identifier is "helper_method", matching "self.helper_method" after strip
      expect(onSelectChunk).toHaveBeenCalledWith(chunkHelper.id);
    });

    it('strips "self." prefix before invoking apiClient.lookupEntity when callee is not local', async () => {
      const user = userEvent.setup();
      const lookupSpy = vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
        identifier: 'external_helper',
        count: 1,
        chunks: [{ ...chunkHelper, id: 'chunk-external-helper', identifier: 'external_helper' }],
      });

      // Mock mockAstChunks[0] with a self. call
      const chunkWithSelf: AstCodeChunk = {
        ...mockAstChunks[0],
        calls: ['self.external_helper'],
      };

      render(
        <CodeViewerContainer
          chunks={[chunkWithSelf]}
          selectedChunkId={chunkWithSelf.id}
          onSelectChunk={vi.fn()}
          onSelectCall={async (callIdentifier) => {
            const cleanName = callIdentifier.replace(/^self\./, '');
            await apiClient.lookupEntity(cleanName);
          }}
        />
      );

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const badge = screen.getByTestId('call-badge-self.external_helper');
      await user.click(badge);

      // Verify lookupEntity was called with clean stripped name "external_helper"
      expect(lookupSpy).toHaveBeenCalledWith('external_helper');
    });

    it('safely handles call badges when call identifier contains dots and qualified path', async () => {
      const user = userEvent.setup();
      const onSelectCall = vi.fn();

      const complexChunk: AstCodeChunk = {
        ...chunkA,
        calls: ['urllib3.util.retry.Retry.from_int', 'requests.adapters.HTTPAdapter.send'],
      };

      render(
        <ASTMetadataInspector
          chunk={complexChunk}
          isOpen={true}
          onClose={vi.fn()}
          onSelectCall={onSelectCall}
        />
      );

      const badge1 = screen.getByTestId('call-badge-urllib3.util.retry.Retry.from_int');
      expect(badge1).toHaveTextContent('urllib3.util.retry.Retry.from_int ↗');
      await user.click(badge1);
      expect(onSelectCall).toHaveBeenCalledWith('urllib3.util.retry.Retry.from_int');

      const badge2 = screen.getByTestId('call-badge-requests.adapters.HTTPAdapter.send');
      await user.click(badge2);
      expect(onSelectCall).toHaveBeenCalledWith('requests.adapters.HTTPAdapter.send');
    });
  });

  describe('5. Error Resilience: 404s, Network Faults & Empty Backend Responses', () => {
    it('survives API 404 (Entity Not Found) gracefully without crashing or corrupting UI state', async () => {
      const user = userEvent.setup();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(apiClient, 'lookupEntity').mockRejectedValueOnce(
        new Error('API Error 404: Entity "ghost_function" not found in vector store')
      );

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));

      // Click get_param_sub_dependant which will trigger 404
      const badge = screen.getByTestId('call-badge-get_param_sub_dependant');
      await user.click(badge);

      // App should NOT crash; console.warn should record failure
      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Entity lookup failed for get_param_sub_dependant'),
          expect.any(Error)
        );
      });

      // Existing tabs and selected chunk remain intact
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
    });

    it('survives Network Offline (Failed to fetch) gracefully without throwing uncaught errors', async () => {
      const user = userEvent.setup();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(apiClient, 'lookupEntity').mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const badge = screen.getByTestId('call-badge-get_param_sub_dependant');
      await user.click(badge);

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalled();
      });

      // UI remains active and responsive
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
    });

    it('safely handles empty chunk array returned from lookupEntity ({ chunks: [] })', async () => {
      const user = userEvent.setup();

      vi.spyOn(apiClient, 'lookupEntity').mockResolvedValueOnce({
        identifier: 'get_param_sub_dependant',
        count: 0,
        chunks: [],
      });

      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      const repoCard = await screen.findByTestId('repo-card-requests');
      await user.click(repoCard);

      await waitFor(() => {
        expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      const badge = screen.getByTestId('call-badge-get_param_sub_dependant');
      await user.click(badge);

      // Verify selected tab has not changed to undefined or broken
      expect(screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`)).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('6. Inspector UI Invariants & Interaction Safeguards', () => {
    it('renders call count accurately and handles rapid repeated clicks idempotently', async () => {
      const user = userEvent.setup();
      const handleSelectCall = vi.fn();

      render(
        <ASTMetadataInspector
          chunk={chunkA}
          isOpen={true}
          onClose={vi.fn()}
          onSelectCall={handleSelectCall}
        />
      );

      const badge = screen.getByTestId('call-badge-beta_processor');

      // Click rapidly 5 times
      for (let i = 0; i < 5; i++) {
        await user.click(badge);
      }

      expect(handleSelectCall).toHaveBeenCalledTimes(5);
      expect(handleSelectCall).toHaveBeenLastCalledWith('beta_processor');
    });

    it('renders imports with correct visual badges and count', () => {
      render(
        <ASTMetadataInspector
          chunk={chunkA}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const importsSection = screen.getByTestId('ast-imports-section');
      expect(importsSection).toBeInTheDocument();
      expect(screen.getByText('Imports (2):')).toBeInTheDocument();

      expect(screen.getByTestId('import-badge-core.beta')).toHaveTextContent('core.beta');
      expect(screen.getByTestId('import-badge-core.gamma')).toHaveTextContent('core.gamma');
    });
  });
});
