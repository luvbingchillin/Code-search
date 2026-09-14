import { useState, useCallback, useRef } from 'react';
import { AgentStatus, AstCodeChunk, ChatMessage, ReActState, UseReActAgentReturn } from '../types';
import { AgentSimulator } from '../services/agentSimulator';
import { mockAstChunks } from '../services/mockAstData';

const initialStatus: AgentStatus = {
  state: 'Idle',
  currentStepMessage: 'Ready to query codebase via Edge AI',
  elapsedMs: 0,
  activeChunkCount: mockAstChunks.length,
};

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome-msg',
    role: 'assistant',
    content: 'Welcome to **CodeSeek AI**! Enter a code query or select a suggestion chip to search the AST index using our Edge AI ReAct engine.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reActState: 'Complete',
    citedChunks: [mockAstChunks[0].id],
  },
];

export function useReActAgent(): UseReActAgentReturn {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(initialStatus);
  const statusRef = useRef<AgentStatus>(initialStatus);
  statusRef.current = agentStatus;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  messagesRef.current = messages;

  const [activeChunks, setActiveChunks] = useState<AstCodeChunk[]>(mockAstChunks);
  const activeChunksRef = useRef<AstCodeChunk[]>(mockAstChunks);
  activeChunksRef.current = activeChunks;

  const [selectedChunkId, setSelectedChunkIdState] = useState<string | null>(mockAstChunks[0].id);
  const selectedChunkIdRef = useRef<string | null>(mockAstChunks[0].id);
  selectedChunkIdRef.current = selectedChunkId;

  const simulatorRef = useRef<AgentSimulator>(new AgentSimulator());
  const timerRef = useRef<number | null>(null);

  const setSelectedChunkId = useCallback((id: string) => {
    selectedChunkIdRef.current = id;
    setSelectedChunkIdState(id);
  }, []);

  const cancelQuery = useCallback(() => {
    simulatorRef.current.cancel();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const cancelledStatus: AgentStatus = {
      ...statusRef.current,
      state: 'Idle',
      currentStepMessage: 'Query cancelled by user',
    };
    statusRef.current = cancelledStatus;
    setAgentStatus(cancelledStatus);
  }, []);

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
        const nextStatus: AgentStatus = {
          ...statusRef.current,
          elapsedMs: Date.now() - startTime,
        };
        statusRef.current = nextStatus;
        setAgentStatus(nextStatus);
      }, 100);

      try {
        const result = await simulatorRef.current.runReActCycle(
          trimmed,
          (state: ReActState, message: string, chunks?: AstCodeChunk[]) => {
            if (chunks && chunks.length > 0) {
              activeChunksRef.current = chunks;
              setActiveChunks(chunks);
              setSelectedChunkIdState((current) => {
                const nextSelected = !current || !chunks.some((c) => c.id === current)
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
          }
        );

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: result.citedChunks.map((c) => c.id),
          metrics: {
            latencyMs: Date.now() - startTime,
            tokensGenerated: 145,
            astNodesSearched: result.citedChunks.length,
          },
        };

        const finalMessages = [...messagesRef.current, assistantMsg];
        messagesRef.current = finalMessages;
        setMessages(finalMessages);

        const completeStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Complete',
          currentStepMessage: `Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          activeChunkCount: result.citedChunks.length,
        };
        statusRef.current = completeStatus;
        setAgentStatus(completeStatus);
      } catch (err: any) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const isCancelled = err?.message?.includes('cancelled');
        const errStatus: AgentStatus = {
          ...statusRef.current,
          state: isCancelled ? 'Idle' : 'Error',
          currentStepMessage: isCancelled ? 'Query cancelled' : (err?.message || 'Error occurred during ReAct loop'),
          error: isCancelled ? undefined : (err?.message || 'Unknown error'),
        };
        statusRef.current = errStatus;
        setAgentStatus(errStatus);
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
    submitQuery,
    cancelQuery,
    setSelectedChunkId,
  };
}
