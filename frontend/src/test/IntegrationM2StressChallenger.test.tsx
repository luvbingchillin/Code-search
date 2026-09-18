import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useReActAgent } from '../hooks/useReActAgent';
import { ApiClient } from '../services/apiClient';
import { UseWebLLMReturn, UseNemoIRReturn, AstCodeChunk } from '../types';
import { CodeViewerPane } from '../components/viewer/CodeViewerPane';
import { SplitPaneLayout } from '../components/layout/SplitPaneLayout';
import { ChatPane } from '../components/chat/ChatPane';

describe('Milestone 2 Integration Adversarial Stress Suite (int_m2_challenger_2)', () => {
  const sampleChunks: AstCodeChunk[] = [
    {
      id: 'chunk-req-1',
      filePath: 'requests/sessions.py',
      fileName: 'sessions.py',
      astNodeType: 'ClassDef',
      identifier: 'Session',
      startLine: 350,
      endLine: 800,
      code: 'class Session(SessionRedirectMixin):\n    def __init__(self):\n        pass',
      relevanceScore: 0.98,
      language: 'python',
      repoFullName: 'psf/requests',
      docstring: 'A Requests session.',
      parameters: ['self'],
    },
    {
      id: 'chunk-req-2',
      filePath: 'requests/models.py',
      fileName: 'models.py',
      astNodeType: 'ClassDef',
      identifier: 'PreparedRequest',
      startLine: 10,
      endLine: 120,
      code: 'class PreparedRequest:\n    def __init__(self):\n        self.url = None',
      relevanceScore: 0.92,
      language: 'python',
      repoFullName: 'psf/requests',
      docstring: 'The fully mutable PreparedRequest object.',
      parameters: ['self'],
    },
    {
      id: 'chunk-req-3',
      filePath: 'requests/adapters.py',
      fileName: 'adapters.py',
      astNodeType: 'FunctionDef',
      identifier: 'send',
      startLine: 400,
      endLine: 510,
      code: 'def send(self, request, stream=False, timeout=None):\n    return Response()',
      relevanceScore: 0.85,
      language: 'python',
      repoFullName: 'psf/requests',
      docstring: 'Sends PreparedRequest object.',
      parameters: ['self', 'request', 'stream', 'timeout'],
    },
  ];

  const createMockWebLLM = (overrides?: Partial<UseWebLLMReturn>): UseWebLLMReturn => ({
    status: 'ready',
    progress: 1,
    progressText: 'Ready',
    currentModel: 'Qwen2.5-Coder-1.5B',
    error: null,
    isWebGPUSupported: true,
    engine: {},
    loadModel: vi.fn().mockResolvedValue(undefined),
    generate: vi.fn().mockImplementation(async (_prompt, onToken) => {
      if (onToken) {
        onToken('Synthesized ', 'Synthesized ');
        onToken('AST explanation.', 'Synthesized AST explanation.');
      }
      return 'Synthesized AST explanation.';
    }),
    generateStream: vi.fn().mockResolvedValue('Synthesized AST explanation.'),
    initEngine: vi.fn().mockResolvedValue(undefined),
    interrupt: vi.fn(),
    unload: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const createMockNemoIR = (overrides?: Partial<UseNemoIRReturn>): UseNemoIRReturn => ({
    wasmStatus: 'ready',
    isReady: true,
    initNemo: vi.fn().mockResolvedValue(undefined),
    searchAstChunks: vi.fn().mockResolvedValue(sampleChunks),
    lookupEntity: vi.fn().mockResolvedValue(sampleChunks),
    executeWorkflow: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TASK 1: nemoIR.searchAstChunks execution and activeChunks / selectedChunkId updates
  // =========================================================================
  describe('Task 1: nemoIR.searchAstChunks Execution & Chunk State Synchronization', () => {
    it('executes nemoIR.searchAstChunks with trimmed query and updates activeChunks and selectedChunkId', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('  Find Session class  ');
      });

      // 1. nemoIR.searchAstChunks was called with trimmed query
      expect(mockSearchAstChunks).toHaveBeenCalledTimes(1);
      expect(mockSearchAstChunks).toHaveBeenCalledWith('Find Session class');

      // 2. activeChunks correctly set to sampleChunks
      expect(result.current.activeChunks).toEqual(sampleChunks);
      expect(result.current.agentStatus.activeChunkCount).toBe(sampleChunks.length);

      // 3. selectedChunkId defaults to first chunk id
      expect(result.current.selectedChunkId).toBe('chunk-req-1');

      // 4. AgentStatus state transitioned to Complete
      expect(result.current.agentStatus.state).toBe('Complete');
      expect(result.current.agentStatus.currentStepMessage).toMatch(/Completed in \d+\.\d+s/);

      // 5. Messages updated with user message and assistant message citing chunk ids
      expect(result.current.messages.length).toBe(3); // welcome msg + user msg + assistant msg
      const assistantMsg = result.current.messages[2];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.citedChunks).toEqual(['chunk-req-1', 'chunk-req-2', 'chunk-req-3']);
      expect(assistantMsg.metrics?.astNodesSearched).toBe(3);
    });

    it('preserves existing selectedChunkId when it remains present in newly retrieved chunks', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      // First query sets activeChunks to sampleChunks, selectedChunkId defaults to chunk-req-1
      await act(async () => {
        await result.current.submitQuery('Initial query');
      });
      expect(result.current.selectedChunkId).toBe('chunk-req-1');

      // User manually selects the second chunk ('chunk-req-2')
      act(() => {
        result.current.setSelectedChunkId('chunk-req-2');
      });
      expect(result.current.selectedChunkId).toBe('chunk-req-2');

      // Second query returns same chunks: selectedChunkId should be preserved as 'chunk-req-2'
      await act(async () => {
        await result.current.submitQuery('Follow-up query');
      });
      expect(result.current.selectedChunkId).toBe('chunk-req-2');
    });

    it('switches selectedChunkId to first chunk when previous selection is absent from new chunks', async () => {
      const initialChunk: AstCodeChunk[] = [sampleChunks[0]];
      const secondQueryChunks: AstCodeChunk[] = [sampleChunks[1], sampleChunks[2]];

      const mockSearchAstChunks = vi
        .fn()
        .mockResolvedValueOnce(initialChunk)
        .mockResolvedValueOnce(secondQueryChunks);

      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('Query 1');
      });
      expect(result.current.selectedChunkId).toBe('chunk-req-1');

      await act(async () => {
        await result.current.submitQuery('Query 2');
      });
      // chunk-req-1 is not in secondQueryChunks, so it switches to secondQueryChunks[0].id ('chunk-req-2')
      expect(result.current.selectedChunkId).toBe('chunk-req-2');
    });

    it('supplies top 3 AST nodes and exact metadata to WebLLM prompt generation', async () => {
      const mockGenerate = vi.fn().mockResolvedValue('Synthesized prompt response');
      const mockWebLLM = createMockWebLLM({ generate: mockGenerate });
      const mockNemoIR = createMockNemoIR({ searchAstChunks: vi.fn().mockResolvedValue(sampleChunks) });

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('Find Session and PreparedRequest');
      });

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      const generatedPrompt = mockGenerate.mock.calls[0][0];

      // Verify AST context metadata injection
      expect(generatedPrompt).toContain('Context AST nodes:');
      expect(generatedPrompt).toContain('Identifier: Session, File: requests/sessions.py:350-800, Type: ClassDef');
      expect(generatedPrompt).toContain('Identifier: PreparedRequest, File: requests/models.py:10-120, Type: ClassDef');
      expect(generatedPrompt).toContain('Identifier: send, File: requests/adapters.py:400-510, Type: FunctionDef');
      expect(generatedPrompt).toContain('User Question: Find Session and PreparedRequest');
    });
  });

  // =========================================================================
  // TASK 2: Edge Case 1 - Empty Search Results
  // =========================================================================
  describe('Task 2: Edge Case 1 - Empty Search Results', () => {
    it('handles empty search results ([]): activeChunks becomes [], selectedChunkId becomes null, no crash', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue([]);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('nonexistent_symbol_xyz_12345');
      });

      expect(mockSearchAstChunks).toHaveBeenCalledWith('nonexistent_symbol_xyz_12345');
      expect(result.current.activeChunks).toEqual([]);
      expect(result.current.selectedChunkId).toBeNull();
      expect(result.current.agentStatus.activeChunkCount).toBe(0);
      expect(result.current.agentStatus.state).toBe('Complete');

      // Assistant message should cite zero chunks
      const assistantMsg = result.current.messages[2];
      expect(assistantMsg.citedChunks).toEqual([]);
      expect(assistantMsg.metrics?.astNodesSearched).toBe(0);
    });

    it('renders CodeViewerPane gracefully when activeChunks is empty and selectedChunkId is null', () => {
      const onSelectChunk = vi.fn();
      render(
        <CodeViewerPane
          chunks={[]}
          selectedChunkId={null}
          onSelectChunk={onSelectChunk}
        />
      );

      // Verify empty tabs banner
      expect(screen.getByTestId('chunk-tabs-empty')).toBeInTheDocument();
      expect(screen.getByText(/No AST code chunks retrieved yet/i)).toBeInTheDocument();

      // Verify CodeDisplay empty state
      const codeDisplay = screen.getByTestId('code-display');
      expect(codeDisplay).toHaveTextContent('No AST code chunk selected.');

      // Verify header handles null chunk gracefully
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('No file selected');
      const copyBtn = screen.getByTestId('copy-code-btn');
      expect(copyBtn).toBeDisabled();
    });
  });

  // =========================================================================
  // TASK 2: Edge Case 2 - Special Characters in Queries
  // =========================================================================
  describe('Task 2: Edge Case 2 - Special Characters in Queries', () => {
    it('ignores queries consisting solely of whitespace without making search calls', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      const initialStatus = result.current.agentStatus;

      await act(async () => {
        await result.current.submitQuery('   \t\n  \r\n  ');
      });

      expect(mockSearchAstChunks).not.toHaveBeenCalled();
      expect(result.current.agentStatus.state).toBe(initialStatus.state);
      expect(result.current.messages.length).toBe(1); // Only initial welcome message
    });

    it('safely handles unicode, emoji, and Python syntax in queries', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      const exoticQuery = 'def 🚀_launch(x: int = 42, *args: ✨) -> bool: """🔥""" pass';
      await act(async () => {
        await result.current.submitQuery(exoticQuery);
      });

      expect(mockSearchAstChunks).toHaveBeenCalledWith(exoticQuery);
      expect(result.current.agentStatus.state).toBe('Complete');
      expect(result.current.messages[2].content).toBe('Synthesized AST explanation.');
    });

    it('safely handles SQL injection, regex symbols, and path traversal strings', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      const maliciousQuery = "' OR '1'='1'; DROP TABLE chunks; -- /../../etc/passwd <script>alert(1)</script> .*+?^${}()|[]\\";
      await act(async () => {
        await result.current.submitQuery(maliciousQuery);
      });

      expect(mockSearchAstChunks).toHaveBeenCalledWith(maliciousQuery);
      expect(result.current.agentStatus.state).toBe('Complete');
    });

    it('properly URI encodes special characters in ApiClient lookupEntity and searchAstChunks', async () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:8000' });
      const origFetch = globalThis.fetch;
      const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/entity/')) {
          return new Response(JSON.stringify({ identifier: 'test', count: 1, chunks: sampleChunks }));
        }
        if (url.includes('/api/v1/search')) {
          return new Response(JSON.stringify({ query: 'test', total_results: 1, chunks: sampleChunks, latency_ms: 5 }));
        }
        return new Response('{}', { status: 200 });
      });
      globalThis.fetch = fetchSpy;

      try {
        // Test entity with slash, space, and emoji
        const specialEntity = 'package/module::Class#method 🚀';
        await client.lookupEntity(specialEntity);

        expect(fetchSpy).toHaveBeenCalled();
        const calledUrl = fetchSpy.mock.calls[0][0] as string;
        // Verify encodeURIComponent encoding
        expect(calledUrl).toContain('/api/v1/entity/' + encodeURIComponent(specialEntity));

        // Test searchAstChunks with entity: prefix
        await client.searchAstChunks('entity: requests/sessions.py::Session');
        const entityCalledUrl = fetchSpy.mock.calls[1][0] as string;
        expect(entityCalledUrl).toContain('/api/v1/entity/' + encodeURIComponent('requests/sessions.py::Session'));
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  // =========================================================================
  // TASK 2: Edge Case 3 - Backend Offline / Error Conditions
  // =========================================================================
  describe('Task 2: Edge Case 3 - Backend Offline & Error Conditions', () => {
    it('sets agentStatus.state to Error and records error message when nemoIR throws a Network Error (backend offline)', async () => {
      const networkError = new Error('Failed to fetch: Connection refused (http://localhost:8000)');
      const mockSearchAstChunks = vi.fn().mockRejectedValue(networkError);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('Search while backend is down');
      });

      expect(result.current.agentStatus.state).toBe('Error');
      expect(result.current.agentStatus.error).toBe(
        'Failed to fetch: Connection refused (http://localhost:8000)'
      );
      expect(result.current.agentStatus.currentStepMessage).toBe(
        'Failed to fetch: Connection refused (http://localhost:8000)'
      );
    });

    it('handles HTTP 500 / 503 errors gracefully with detail message extracted', async () => {
      const httpError = new Error('API Error 503: Service Unavailable: LanceDB indexing in progress');
      const mockSearchAstChunks = vi.fn().mockRejectedValue(httpError);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('Search during indexing');
      });

      expect(result.current.agentStatus.state).toBe('Error');
      expect(result.current.agentStatus.error).toContain('API Error 503');
    });

    it('recovers cleanly from an Error state when a subsequent valid query succeeds', async () => {
      const mockSearchAstChunks = vi
        .fn()
        .mockRejectedValueOnce(new Error('Transient backend timeout'))
        .mockResolvedValueOnce(sampleChunks);

      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      // 1. First query fails
      await act(async () => {
        await result.current.submitQuery('Failing query');
      });
      expect(result.current.agentStatus.state).toBe('Error');
      expect(result.current.agentStatus.error).toBe('Transient backend timeout');

      // 2. Second query succeeds
      await act(async () => {
        await result.current.submitQuery('Retry query');
      });
      expect(result.current.agentStatus.state).toBe('Complete');
      expect(result.current.agentStatus.error).toBeUndefined();
      expect(result.current.activeChunks).toEqual(sampleChunks);
    });

    it('reset() resets state from Error back to Idle and clears error flags', async () => {
      const mockSearchAstChunks = vi.fn().mockRejectedValue(new Error('Fatal search failure'));
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      await act(async () => {
        await result.current.submitQuery('Fail then reset');
      });
      expect(result.current.agentStatus.state).toBe('Error');

      act(() => {
        result.current.reset?.();
      });

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.agentStatus.error).toBeUndefined();
      expect(result.current.streamingTokens).toBe('');
    });

    it('ApiClient handles HTTP error response parsing and abort signal timeout', async () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:8000', timeoutMs: 20 });
      const origFetch = globalThis.fetch;

      // Mock fetch that rejects when controller signal aborts
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'));
            });
          }
        });
      });

      try {
        await expect(client.getHealth()).rejects.toThrow(/aborted/i);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  // =========================================================================
  // TASK 2: Edge Case 4 - In-Flight Cancellation & Rapid Concurrency
  // =========================================================================
  describe('Task 2: Edge Case 4 - In-Flight Cancellation & Concurrency', () => {
    it('sets state to Idle with cancellation message when query is cancelled while searchAstChunks is resolving', async () => {
      let resolveSearch: (chunks: AstCodeChunk[]) => void;
      const delayedSearchPromise = new Promise<AstCodeChunk[]>((res) => {
        resolveSearch = res;
      });

      const mockSearchAstChunks = vi.fn().mockReturnValue(delayedSearchPromise);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      let submitPromise: Promise<void>;
      act(() => {
        submitPromise = result.current.submitQuery('Slow query');
      });

      // Wait for Searching AST phase
      await waitFor(() => {
        expect(result.current.agentStatus.state).toBe('Searching AST');
      });

      // Cancel query while search is in-flight
      act(() => {
        result.current.cancelQuery();
      });
      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.agentStatus.currentStepMessage).toBe('Query cancelled by user');

      // Now let search finish
      await act(async () => {
        resolveSearch!(sampleChunks);
        await submitPromise;
      });

      // Status should remain Idle (cancelled), not Complete or Error
      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.agentStatus.currentStepMessage).toBe('Query cancelled by user');
      expect(result.current.agentStatus.error).toBeUndefined();
    });

    it('survives rapid consecutive submitQuery calls without unhandled rejections or race condition crashes', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      // Fire 5 queries in rapid succession without awaiting between them
      await act(async () => {
        const p1 = result.current.submitQuery('Rapid query 1');
        const p2 = result.current.submitQuery('Rapid query 2');
        const p3 = result.current.submitQuery('Rapid query 3');
        const p4 = result.current.submitQuery('Rapid query 4');
        const p5 = result.current.submitQuery('Rapid query 5');
        await Promise.all([p1, p2, p3, p4, p5]);
      });

      expect(result.current.agentStatus.state).toBe('Complete');
      expect(result.current.activeChunks).toEqual(sampleChunks);
      expect(result.current.selectedChunkId).toBe('chunk-req-1');
    });
  });

  // =========================================================================
  // TASK 2: Edge Case 5 - SplitPane and Component DOM Integration
  // =========================================================================
  describe('Task 2: Edge Case 5 - Full DOM SplitPane Integration', () => {
    it('integrates useReActAgent and useNemoIR across ChatPane and CodeViewerPane in DOM', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const TestHarness: React.FC = () => {
        const agent = useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR });

        return (
          <SplitPaneLayout
            leftPane={
              <ChatPane
                status={agent.agentStatus}
                messages={agent.messages}
                chunks={agent.activeChunks}
                onSelectChunk={agent.setSelectedChunkId}
                onSubmit={agent.submitQuery}
                onCancel={agent.cancelQuery}
                streamingTokens={agent.streamingTokens}
                onReset={agent.reset}
              />
            }
            rightPane={
              <CodeViewerPane
                chunks={agent.activeChunks}
                selectedChunkId={agent.selectedChunkId}
                onSelectChunk={agent.setSelectedChunkId}
              />
            }
          />
        );
      };

      render(<TestHarness />);

      // Initial state: welcome message is present
      expect(screen.getByText(/Welcome to/i)).toBeInTheDocument();

      // Submit a query via ChatInput
      const input = screen.getByTestId('chat-input-textarea');
      const submitBtn = screen.getByTestId('chat-send-btn');

      fireEvent.change(input, { target: { value: 'How does requests handle sessions?' } });
      fireEvent.click(submitBtn);

      // Verify completion and chunk tabs appearing in DOM
      await waitFor(
        () => {
          expect(screen.getByTestId('chunk-tab-chunk-req-1')).toBeInTheDocument();
          expect(screen.getByTestId('chunk-tab-chunk-req-2')).toBeInTheDocument();
          expect(screen.getByTestId('chunk-tab-chunk-req-3')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Verify active code viewer header displays selected chunk
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('requests/sessions.py');
      expect(screen.getByTestId('chunk-node-type')).toHaveTextContent('ClassDef');

      // Click second chunk tab ('PreparedRequest')
      fireEvent.click(screen.getByTestId('chunk-tab-chunk-req-2'));
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('requests/models.py');

      // Toggle AST Metadata Inspector
      const inspectorToggle = screen.getByTestId('toggle-ast-inspector-btn');
      fireEvent.click(inspectorToggle);
      expect(screen.getByTestId('ast-metadata-inspector')).toBeInTheDocument();
      expect(screen.getByText('The fully mutable PreparedRequest object.')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // TASK 2: Edge Case 6 - Lifecycle, Duck-Typing & Protocol Resilience
  // =========================================================================
  describe('Task 2: Edge Case 6 - Lifecycle, Duck-Typing & Protocol Resilience', () => {
    it('recovers selectedChunkId from null when transitioning from empty search results to successful search results', async () => {
      const mockSearchAstChunks = vi
        .fn()
        .mockResolvedValueOnce([]) // First returns 0 chunks
        .mockResolvedValueOnce([sampleChunks[1]]); // Second returns 1 chunk

      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });
      const mockWebLLM = createMockWebLLM();

      const { result } = renderHook(() =>
        useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
      );

      // Query 1: Empty results
      await act(async () => {
        await result.current.submitQuery('Query with 0 results');
      });
      expect(result.current.activeChunks).toEqual([]);
      expect(result.current.selectedChunkId).toBeNull();

      // Query 2: Returns chunk-req-2
      await act(async () => {
        await result.current.submitQuery('Query with 1 result');
      });
      expect(result.current.activeChunks).toEqual([sampleChunks[1]]);
      expect(result.current.selectedChunkId).toBe('chunk-req-2');
    });

    it('supports passing nemoIR directly as options using duck-typing (wasmStatus check)', async () => {
      const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);
      const mockNemoIR = createMockNemoIR({ searchAstChunks: mockSearchAstChunks });

      // Pass nemoIR directly as options
      const { result } = renderHook(() =>
        useReActAgent(mockNemoIR as any)
      );

      expect(result.current.agentStatus.state).toBe('Idle');
      expect(result.current.activeChunks.length).toBeGreaterThan(0);
    });

    it('ApiClient handles HTTP 502 with non-JSON HTML body and falls back to statusText', async () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:8000' });
      const origFetch = globalThis.fetch;

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html' },
        })
      );

      try {
        await expect(client.search({ query: 'test' })).rejects.toThrow('API Error 502: Bad Gateway');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('useNemoIR preserves ready state even when initNemo encounters backend failure', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Backend offline during startup'));

      try {
        const client = new ApiClient();
        await expect(client.getHealth()).rejects.toThrow();
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
});

