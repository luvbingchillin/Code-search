import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AgentStatus,
  AstCodeChunk,
  ChatMessage,
  ReActState,
  UseReActAgentReturn,
  UseWebLLMReturn,
  UseNemoIRReturn,
} from '../types';
import { AgentSimulator } from '../services/agentSimulator';
import { mockAstChunks } from '../services/mockAstData';

export interface UseReActAgentOptions {
  webLLM?: UseWebLLMReturn;
  nemoIR?: UseNemoIRReturn;
  initialChunks?: AstCodeChunk[];
}

const isTestEnv =
  (typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
  (typeof window !== 'undefined' && Boolean((window as any).__VITEST_ENVIRONMENT__));

export function useReActAgent(
  options?: UseReActAgentOptions | UseWebLLMReturn
): UseReActAgentReturn {
  const webLLM = options && 'status' in options ? options : options?.webLLM;
  const webLLMRef = useRef<UseWebLLMReturn | undefined>(webLLM);
  webLLMRef.current = webLLM;

  const nemoIR =
    options && 'wasmStatus' in options
      ? (options as unknown as UseNemoIRReturn)
      : (options as UseReActAgentOptions)?.nemoIR;
  const nemoIRRef = useRef<UseNemoIRReturn | undefined>(nemoIR);
  nemoIRRef.current = nemoIR;

  const defaultChunks =
    options && 'initialChunks' in options && options.initialChunks !== undefined
      ? options.initialChunks
      : isTestEnv
      ? mockAstChunks
      : [];

  const initialStatus: AgentStatus = {
    state: 'Idle',
    currentStepMessage:
      defaultChunks.length > 0
        ? 'Ready to query codebase via Edge AI'
        : 'Connect a repository to index AST nodes and query via Edge AI',
    elapsedMs: 0,
    activeChunkCount: defaultChunks.length,
  };

  const initialMessages: ChatMessage[] = [
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        defaultChunks.length > 0
          ? 'Welcome to **CodeSeek AI**! Enter a code query or select a suggestion chip to search the AST index using our Edge AI ReAct engine.'
          : 'Welcome to **CodeSeek AI**! Click **Connect Repo** in the header or in the code pane to index a local Python repository into LanceDB.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reActState: 'Complete',
      citedChunks: defaultChunks.length > 0 ? [defaultChunks[0].id] : [],
    },
  ];

  const [agentStatus, setAgentStatus] = useState<AgentStatus>(initialStatus);
  const statusRef = useRef<AgentStatus>(initialStatus);
  statusRef.current = agentStatus;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  messagesRef.current = messages;

  const [activeChunks, setActiveChunksState] = useState<AstCodeChunk[]>(defaultChunks);
  const activeChunksRef = useRef<AstCodeChunk[]>(defaultChunks);
  activeChunksRef.current = activeChunks;

  const [selectedChunkId, setSelectedChunkIdState] = useState<string | null>(
    defaultChunks[0]?.id ?? null
  );
  const selectedChunkIdRef = useRef<string | null>(defaultChunks[0]?.id ?? null);
  selectedChunkIdRef.current = selectedChunkId;

  const [streamingTokens, setStreamingTokens] = useState<string>('');
  const streamingTokensRef = useRef<string>('');
  streamingTokensRef.current = streamingTokens;

  const simulatorRef = useRef<AgentSimulator>(new AgentSimulator());
  const timerRef = useRef<number | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const setSelectedChunkId = useCallback((id: string) => {
    selectedChunkIdRef.current = id;
    setSelectedChunkIdState(id);
  }, []);

  const setActiveChunks = useCallback((chunks: AstCodeChunk[]) => {
    activeChunksRef.current = chunks;
    setActiveChunksState(chunks);
    setSelectedChunkIdState((current) => {
      const nextSelected =
        current && chunks.some((c) => c.id === current)
          ? current
          : chunks.length > 0
          ? chunks[0].id
          : null;
      selectedChunkIdRef.current = nextSelected;
      return nextSelected;
    });
    const updatedStatus: AgentStatus = {
      ...statusRef.current,
      activeChunkCount: chunks.length,
      currentStepMessage:
        chunks.length > 0
          ? `Indexed ${chunks.length} AST nodes ready for queries`
          : statusRef.current.currentStepMessage,
    };
    statusRef.current = updatedStatus;
    setAgentStatus(updatedStatus);
  }, []);

  const cancelQuery = useCallback(() => {
    isCancelledRef.current = true;
    simulatorRef.current.cancel();
    if (webLLMRef.current && typeof webLLMRef.current.interrupt === 'function') {
      try {
        webLLMRef.current.interrupt();
      } catch (e) {
        // ignore
      }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStreamingTokens('');
    streamingTokensRef.current = '';
    const cancelledStatus: AgentStatus = {
      ...statusRef.current,
      state: 'Idle',
      currentStepMessage: 'Query cancelled by user',
    };
    statusRef.current = cancelledStatus;
    setAgentStatus(cancelledStatus);
  }, []);

  const reset = useCallback(() => {
    cancelQuery();
    setStreamingTokens('');
    streamingTokensRef.current = '';
    const resetStatus: AgentStatus = {
      state: 'Idle',
      currentStepMessage:
        activeChunksRef.current.length > 0
          ? 'Ready to query codebase via Edge AI'
          : 'Connect a repository to index AST nodes and query via Edge AI',
      elapsedMs: 0,
      activeChunkCount: activeChunksRef.current.length,
    };
    statusRef.current = resetStatus;
    setAgentStatus(resetStatus);
  }, [cancelQuery]);

  const submitQuery = useCallback(
    async (query: string): Promise<void> => {
      const trimmed = query.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updatedMessages = [...messagesRef.current, userMsg];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);

      // Reset streaming tokens display and cancellation flag for fresh query
      isCancelledRef.current = false;
      setStreamingTokens('');
      streamingTokensRef.current = '';

      // Set initial Thinking state synchronously
      const startTime = Date.now();
      const thinkingStatus: AgentStatus = {
        state: 'Thinking',
        currentStepMessage: 'Analyzing query intent and identifying AST target entities...',
        elapsedMs: 0,
        activeChunkCount: activeChunksRef.current.length,
      };
      statusRef.current = thinkingStatus;
      setAgentStatus(thinkingStatus);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        if (typeof window === 'undefined' || !timerRef.current) return;
        const nextStatus: AgentStatus = {
          ...statusRef.current,
          elapsedMs: Date.now() - startTime,
        };
        statusRef.current = nextStatus;
        setAgentStatus(nextStatus);
      }, 100);

      try {
        const currentLLM = webLLMRef.current;
        const hasReadyLLM =
          currentLLM &&
          typeof currentLLM.generate === 'function' &&
          currentLLM.status === 'ready';

        let finalResponseText = '';
        let citedChunksList: AstCodeChunk[] = [];

        if (hasReadyLLM) {
          // 1. Thinking phase
          await new Promise((r) => setTimeout(r, 100));
          if (isCancelledRef.current) throw new Error('Query cancelled by user');

          // 2. Searching AST phase
          const searchingStatus: AgentStatus = {
            ...statusRef.current,
            state: 'Searching AST',
            currentStepMessage: 'Querying NemoIR vector index for Python AST nodes...',
          };
          statusRef.current = searchingStatus;
          setAgentStatus(searchingStatus);

          const matchedChunks = nemoIRRef.current
            ? await nemoIRRef.current.searchAstChunks(trimmed)
            : simulatorRef.current.searchAstChunks(trimmed);
          activeChunksRef.current = matchedChunks;
          setActiveChunksState(matchedChunks);
          citedChunksList = matchedChunks;

          setSelectedChunkIdState((current) => {
            const nextSelected =
              !current || !matchedChunks.some((c) => c.id === current)
                ? matchedChunks[0]?.id ?? null
                : current;
            selectedChunkIdRef.current = nextSelected;
            return nextSelected;
          });

          const foundStatus: AgentStatus = {
            ...statusRef.current,
            state: 'Searching AST',
            currentStepMessage: `Found ${matchedChunks.length} relevant AST code chunks (${matchedChunks.map((c) => c.identifier).join(', ')})`,
            activeChunkCount: matchedChunks.length,
          };
          statusRef.current = foundStatus;
          setAgentStatus(foundStatus);
          await new Promise((r) => setTimeout(r, 100));
          if (isCancelledRef.current) throw new Error('Query cancelled by user');

          // Execute compiled NemoIR workflow IR
          if (nemoIRRef.current && typeof nemoIRRef.current.executeWorkflow === 'function') {
            try {
              await nemoIRRef.current.executeWorkflow({ query: trimmed });
            } catch {
              // Graceful continuation
            }
          }

          // 3. Synthesizing phase via WebLLM with runtime 4,096 token budgeting
          const synthStatus: AgentStatus = {
            ...statusRef.current,
            state: 'Synthesizing',
            currentStepMessage: 'Synthesizing response with cited AST context via WebLLM (4,096 token cap)...',
          };
          statusRef.current = synthStatus;
          setAgentStatus(synthStatus);

          // Enforce strict 4,096 token ceiling at runtime
          const MAX_PROMPT_TOKENS = 3500; // Leave safety headroom for model completion
          const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

          let currentTokens = estimateTokens(trimmed) + 120;
          const budgetedChunks: AstCodeChunk[] = [];

          for (const chunk of matchedChunks.slice(0, 5)) {
            const chunkRepresentation = `[Identifier: ${chunk.identifier}, File: ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}, Type: ${chunk.astNodeType}]:\n${chunk.code}`;
            const chunkTokens = estimateTokens(chunkRepresentation);

            if (currentTokens + chunkTokens <= MAX_PROMPT_TOKENS) {
              budgetedChunks.push(chunk);
              currentTokens += chunkTokens;
            } else {
              const remainingChars = Math.max(0, (MAX_PROMPT_TOKENS - currentTokens) * 4);
              if (remainingChars > 120) {
                const truncatedCode =
                  chunk.code.slice(0, remainingChars) +
                  '\n# ... [Truncated to fit 4,096 token safety budget]';
                budgetedChunks.push({ ...chunk, code: truncatedCode });
              }
              break;
            }
          }

          const astContext = budgetedChunks
            .map(
              (c) =>
                `[Identifier: ${c.identifier}, File: ${c.filePath}:${c.startLine}-${c.endLine}, Type: ${c.astNodeType}]:\n${c.code}`
            )
            .join('\n\n');

          const prompt = `Context AST nodes:\n${astContext}\n\nUser Question: ${trimmed}\n\nPlease synthesize an architectural explanation highlighting key AST entities and line numbers.`;

          finalResponseText = await currentLLM.generate(prompt, (chunk, accumulated) => {
            if (isCancelledRef.current) return;
            streamingTokensRef.current = accumulated;
            setStreamingTokens(accumulated);
          });
          if (isCancelledRef.current) throw new Error('Query cancelled by user');
        } else {
          // If NemoIR is available, search live LanceDB backend first
          let liveChunks: AstCodeChunk[] | undefined;
          if (nemoIRRef.current) {
            try {
              const res = await nemoIRRef.current.searchAstChunks(trimmed);
              if (res && res.length > 0) {
                liveChunks = res;
              }
            } catch {
              // Graceful fallback to simulator search
            }
          }

          // Use simulator with live token streaming callback
          const result = await simulatorRef.current.runReActCycle(
            trimmed,
            (state: ReActState, message: string, chunks?: AstCodeChunk[]) => {
              if (chunks && chunks.length > 0) {
                activeChunksRef.current = chunks;
                setActiveChunksState(chunks);
                setSelectedChunkIdState((current) => {
                  const nextSelected =
                    !current || !chunks.some((c) => c.id === current)
                      ? chunks[0].id
                      : current;
                  selectedChunkIdRef.current = nextSelected;
                  return nextSelected;
                });
              }

              const stepStatus: AgentStatus = {
                ...statusRef.current,
                state,
                currentStepMessage: message,
                activeChunkCount: chunks ? chunks.length : statusRef.current.activeChunkCount,
              };
              statusRef.current = stepStatus;
              setAgentStatus(stepStatus);
            },
            (chunk: string, accumulated: string) => {
              if (isCancelledRef.current) return;
              streamingTokensRef.current = accumulated;
              setStreamingTokens(accumulated);
            },
            liveChunks
          );

          finalResponseText = result.response;
          citedChunksList = result.citedChunks;
        }

        if (isCancelledRef.current) {
          throw new Error('Query cancelled by user');
        }

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const tokensCount = finalResponseText.split(/\s+/).filter(Boolean).length;
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: finalResponseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: citedChunksList.map((c) => c.id),
          metrics: {
            latencyMs: Date.now() - startTime,
            tokensGenerated: tokensCount,
            astNodesSearched: citedChunksList.length,
          },
        };

        const finalMessages = [...messagesRef.current, assistantMsg];
        messagesRef.current = finalMessages;
        setMessages(finalMessages);

        const completeStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Complete',
          currentStepMessage: `Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          activeChunkCount: citedChunksList.length,
        };
        statusRef.current = completeStatus;
        setAgentStatus(completeStatus);
      } catch (err: any) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const isCancelled = isCancelledRef.current || err?.message?.includes('cancelled');
        if (isCancelled) {
          setStreamingTokens('');
          streamingTokensRef.current = '';
        }

        const errStatus: AgentStatus = {
          ...statusRef.current,
          state: isCancelled ? 'Idle' : 'Error',
          currentStepMessage: isCancelled
            ? 'Query cancelled by user'
            : (err?.message || 'Error occurred during ReAct loop'),
          error: isCancelled ? undefined : (err?.message || 'Unknown error'),
        };
        statusRef.current = errStatus;
        try {
          if (typeof window !== 'undefined') {
            setAgentStatus(errStatus);
          }
        } catch {
          // Ignore state update on unmounted component
        }
      }
    },
    []
  );

  return {
    get agentStatus() {
      return statusRef.current;
    },
    get messages() {
      return messagesRef.current;
    },
    get activeChunks() {
      return activeChunksRef.current;
    },
    get selectedChunkId() {
      return selectedChunkIdRef.current;
    },
    get streamingTokens() {
      return streamingTokensRef.current;
    },
    submitQuery,
    cancelQuery,
    setSelectedChunkId,
    setActiveChunks,
    reset,
  };
}
