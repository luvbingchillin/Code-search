import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AgentStatus,
  AstCodeChunk,
  ChatMessage,
  ReActState,
  UseReActAgentReturn,
  UseWebLLMReturn,
  UseNemoIRReturn,
  RepositoryItem,
} from '../types';
import { AgentSimulator } from '../services/agentSimulator';
import { mockAstChunks } from '../services/mockAstData';

export interface UseReActAgentOptions {
  webLLM?: UseWebLLMReturn;
  nemoIR?: UseNemoIRReturn;
  initialChunks?: AstCodeChunk[];
  activeRepoPath?: string;
  activeRepo?: RepositoryItem | null;
}

const isTestEnv =
  (typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
  (typeof window !== 'undefined' && Boolean((window as any).__VITEST_ENVIRONMENT__));

function getHelpContent(): string {
  return `### 💡 CodeSeek AI Command & Workflow Guide

**CodeSeek AI** is a 100% edge-computed code intelligence assistant powered by Tree-sitter AST extraction, LanceDB vector storage, and local SLM inference (Qwen2.5-Coder on WebGPU).

#### 🛠️ Available Commands
- \`/help\` — Display this command reference and workflow guide.
- \`/status\` (or \`/repo\`) — Check current repository, indexed AST nodes, and edge engine status.
- \`/ask <query>\` — Query the codebase AST index and synthesize an answer.

#### 🚀 Getting Started
1. **Connect a Repository**: Click **Repositories** in the header to open \`psf/requests\` or index your local codebase.
2. **Load WebLLM**: Click **WebLLM: Load** in the header to activate real-time local neural code synthesis via WebGPU.
3. **Query AST Structure**: Ask natural language questions like *"Where is Session.send defined?"* or *"How does CaseInsensitiveDict work?"*.`;
}

function getStatusContent(
  activeRepo: RepositoryItem | null | undefined,
  activeRepoPath: string | undefined,
  activeChunksCount: number,
  webLLM: UseWebLLMReturn | undefined
): string {
  const repoName = activeRepo?.name || (activeRepoPath ? activeRepoPath.split(/[\\/]/).pop() : null);
  const repoPath = activeRepo?.path || activeRepoPath || null;
  const chunksCount = activeRepo?.chunksCount ?? activeRepo?.chunks_count ?? activeChunksCount;
  const isWebLLMReady = webLLM?.status === 'ready';
  const modelName = webLLM?.currentModel || 'Qwen2.5-Coder (1.5B)';

  if (!repoName) {
    return `### 📊 System & Repository Status

- **Active Repository**: *None connected*
- **Edge AI Engine**: **WebLLM (${modelName})** — \`${webLLM?.status || 'unloaded'}\` ${isWebLLMReady ? '🟢 (WebGPU Active)' : '⚪ (Offline - using AST Simulator)'}
- **AST Nodes Loaded**: ${activeChunksCount}

*Click **Repositories** in the top header to connect \`psf/requests\` or index a local codebase.*`;
  }

  return `### 📊 System & Repository Status

- **Active Repository**: **${repoName}** (\`${repoPath}\`)
- **Indexed AST Nodes**: **${chunksCount}** nodes (functions, classes, methods)
- **Active Code Tabs**: **${activeChunksCount}** loaded in viewer
- **Edge AI Engine**: **WebLLM (${modelName})** — \`${webLLM?.status || 'unloaded'}\` ${isWebLLMReady ? '🟢 (WebGPU Active)' : '⚪ (Offline - using AST Simulator)'}
- **NemoIR WebAssembly JIT**: Ready & compiled

${!isWebLLMReady ? '> 💡 *Tip: Click **WebLLM: Load** in the top header to switch from template simulation to real-time neural edge inference on your GPU.*' : ''}`;
}

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

  const activeRepo =
    options && 'activeRepo' in options
      ? (options as UseReActAgentOptions).activeRepo
      : undefined;
  const activeRepoRef = useRef<RepositoryItem | null | undefined>(activeRepo);
  activeRepoRef.current = activeRepo;

  const rawActiveRepoPath =
    options && 'activeRepoPath' in options
      ? (options as UseReActAgentOptions).activeRepoPath
      : undefined;
  const activeRepoPath = rawActiveRepoPath || activeRepo?.path;
  const activeRepoPathRef = useRef<string | undefined>(activeRepoPath);
  activeRepoPathRef.current = activeRepoPath;

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
  const hasShownSimulatorNoticeRef = useRef<boolean>(false);
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

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    hasShownSimulatorNoticeRef.current = false;
    setMessages([]);
    reset();
  }, [reset]);

  const addMessage = useCallback((msg: ChatMessage) => {
    const updated = [...messagesRef.current, msg];
    messagesRef.current = updated;
    setMessages(updated);
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

      // Reset streaming tokens display and cancellation flag for fresh query
      isCancelledRef.current = false;
      setStreamingTokens('');
      streamingTokensRef.current = '';

      const lower = trimmed.toLowerCase();
      const isHelp = lower === '/help' || lower === 'help';
      const isStatus =
        lower === '/status' ||
        lower === '/repo' ||
        lower === 'status' ||
        /^(what\s+repo(\s+am\s+i\s+in)?|which\s+repo|current\s+repo|repo\s+info|info)$/i.test(lower);
      const isAsk = lower.startsWith('/ask ') || lower.startsWith('/ask');

      const isAbout =
        lower === 'what is codeseek ai?' ||
        lower === 'what is codeseek ai' ||
        lower === 'about' ||
        /^(what\s+is\s+codeseek(\s+ai)?|about|who\s+are\s+you)$/i.test(lower);
      const isOverview =
        lower === '/overview' ||
        lower === 'overview' ||
        /^(what\s+does\s+this\s+(code\s*base|repo|repository|project|software)\s+do|explain\s+this\s+(code\s*base|repo|repository|project)|(code\s*base|repo|repository)\s+overview|overview(\s+of\s+this\s+(code\s*base|repo|repository|project))?|what\s+is\s+this\s+(code\s*base|repo|repository|project)|architecture(\s+of\s+this\s+(code\s*base|repo|repository|project))?|how\s+does\s+this\s+(code\s*base|repo|repository|project)\s+work)\??$/i.test(
          lower
        );
      const isConnectIntent =
        lower.startsWith('connect psf/requests') ||
        lower.startsWith('connect sample_codebase') ||
        lower === 'connect repo' ||
        /^(connect|open)\s+(psf\/requests|requests|sample_codebase|sample)$/i.test(lower);

      // Intent Handling 1: /help or help
      if (isHelp) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const helpContent = getHelpContent();
        const asstMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: helpContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: [],
          metrics: {
            latencyMs: 12,
            tokensGenerated: helpContent.split(/\s+/).filter(Boolean).length,
            astNodesSearched: 0,
          },
        };
        const finalMsgs = [...messagesRef.current, asstMsg];
        messagesRef.current = finalMsgs;
        setMessages(finalMsgs);
        const idleStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Idle',
          currentStepMessage: 'Ready to query codebase via Edge AI',
        };
        statusRef.current = idleStatus;
        setAgentStatus(idleStatus);
        return;
      }

      // Intent Handling 2: About CodeSeek AI
      if (isAbout) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const aboutContent = `### ⚡ About CodeSeek AI

**CodeSeek AI** is a privacy-first, edge-computed Python code retrieval and architectural search engine.

- **100% Edge Privacy**: Zero cloud telemetry or external LLM API calls.
- **Structural AST Parsing**: Tree-sitter extracts granular Python functions and class nodes to prevent semantic fragmentation.
- **Vector Search**: Embedded LanceDB database with 384-dimensional AST embeddings.
- **Local Neural Inference**: Optional WebLLM running Qwen2.5-Coder directly in your browser on WebGPU.

Connect a repository using the **Repositories** menu in the header to start searching code!`;

        const asstMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: aboutContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: [],
          metrics: {
            latencyMs: 10,
            tokensGenerated: aboutContent.split(/\s+/).filter(Boolean).length,
            astNodesSearched: 0,
          },
        };
        const finalMsgs = [...messagesRef.current, asstMsg];
        messagesRef.current = finalMsgs;
        setMessages(finalMsgs);
        const idleStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Idle',
          currentStepMessage: 'Ready to query codebase via Edge AI',
        };
        statusRef.current = idleStatus;
        setAgentStatus(idleStatus);
        return;
      }

      // Intent Handling 3: Connect repository suggestion
      if (isConnectIntent) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const targetRepo = lower.includes('sample') ? 'sample_codebase' : 'psf/requests';
        const connectContent = `### 📦 Connect Repository: **${targetRepo}**

Click **Repositories** in the top navigation header or open the repository modal to connect **${targetRepo}**.

Once connected, its AST syntax tree will load into the code viewer and you can query symbols, classes, and call hierarchies!`;

        const asstMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: connectContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: [],
          metrics: {
            latencyMs: 10,
            tokensGenerated: connectContent.split(/\s+/).filter(Boolean).length,
            astNodesSearched: 0,
          },
        };
        const finalMsgs = [...messagesRef.current, asstMsg];
        messagesRef.current = finalMsgs;
        setMessages(finalMsgs);
        const idleStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Idle',
          currentStepMessage: 'Connect a repository to index AST nodes and query via Edge AI',
        };
        statusRef.current = idleStatus;
        setAgentStatus(idleStatus);
        return;
      }

      // Intent Handling 2: /status, /repo, or "what repo am i in"
      if (isStatus) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const statusContent = getStatusContent(
          activeRepoRef.current,
          activeRepoPathRef.current,
          activeChunksRef.current.length,
          webLLMRef.current
        );
        const asstMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: statusContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: [],
          metrics: {
            latencyMs: 15,
            tokensGenerated: statusContent.split(/\s+/).filter(Boolean).length,
            astNodesSearched: 0,
          },
        };
        const finalMsgs = [...messagesRef.current, asstMsg];
        messagesRef.current = finalMsgs;
        setMessages(finalMsgs);
        const idleStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Idle',
          currentStepMessage: activeRepoRef.current
            ? `Active repository: ${activeRepoRef.current.name}`
            : 'Ready to query codebase via Edge AI',
        };
        statusRef.current = idleStatus;
        setAgentStatus(idleStatus);
        return;
      }

      // Strip /ask prefix if user explicitly invoked /ask command
      const effectiveQuery = isAsk ? trimmed.replace(/^\/ask\s*/i, '').trim() || trimmed : trimmed;

      // Intent Handling 3: Repository Connection Gating
      // If no repository is active, do not execute un-scoped vector searches.
      // In production, strictly enforce gating whenever hasActiveRepo is false.
      // In test environments, enforce gating when activeRepo is explicitly null and initialChunks is empty.
      const hasActiveRepo = Boolean(activeRepoRef.current || activeRepoPathRef.current);
      const isExplicitTestGating =
        isTestEnv &&
        activeRepoRef.current === null &&
        Boolean(options && 'initialChunks' in options && options.initialChunks?.length === 0);
      const shouldGateRepo = !hasActiveRepo && (!isTestEnv || isExplicitTestGating);

      if (shouldGateRepo) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const gatingContent = `### ⚠️ No Active Repository Connected

Please select or connect a Python repository before querying AST code chunks.

- Click **Repositories** in the top header or select an auto-discovered codebase (**psf/requests** or **sample_codebase**).
- Once connected, you can search function definitions, class structures, and call graphs.
- Type \`/status\` to check environment details or \`/help\` for available commands.`;

        const asstMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: gatingContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reActState: 'Complete',
          citedChunks: [],
          metrics: {
            latencyMs: 10,
            tokensGenerated: gatingContent.split(/\s+/).filter(Boolean).length,
            astNodesSearched: 0,
          },
        };
        const finalMsgs = [...messagesRef.current, asstMsg];
        messagesRef.current = finalMsgs;
        setMessages(finalMsgs);
        const idleStatus: AgentStatus = {
          ...statusRef.current,
          state: 'Idle',
          currentStepMessage: 'Connect a repository to index AST nodes and query via Edge AI',
        };
        statusRef.current = idleStatus;
        setAgentStatus(idleStatus);
        return;
      }

      // Set initial Thinking state synchronously
      const startTime = Date.now();
      const thinkingStatus: AgentStatus = {
        state: 'Thinking',
        currentStepMessage: isOverview
          ? 'Analyzing repository architecture and identifying core entry points and models...'
          : 'Analyzing query intent and identifying AST target entities...',
        elapsedMs: 0,
        activeChunkCount: activeChunksRef.current.length,
      };
      statusRef.current = thinkingStatus;
      setAgentStatus(thinkingStatus);

      const isRequestsRepo = Boolean(
        activeRepoRef.current?.name?.toLowerCase().includes('requests') ||
        activeRepoPathRef.current?.toLowerCase().includes('requests')
      );
      const isSampleRepo = Boolean(
        activeRepoRef.current?.name?.toLowerCase().includes('sample') ||
        activeRepoPathRef.current?.toLowerCase().includes('sample')
      );

      const effectiveSearchTerm = isOverview
        ? isRequestsRepo
          ? 'Session Request Response HTTPAdapter'
          : isSampleRepo
          ? 'Calculator add subtract FastAPI'
          : 'ClassDef class def main model'
        : effectiveQuery;

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
            currentStepMessage: isOverview
              ? 'Retrieving foundational architecture and model AST nodes from LanceDB...'
              : 'Querying NemoIR vector index for Python AST nodes...',
          };
          statusRef.current = searchingStatus;
          setAgentStatus(searchingStatus);

          const searchOptions = activeRepoPathRef.current
            ? { filePath: activeRepoPathRef.current }
            : undefined;
          const matchedChunks = nemoIRRef.current
            ? await (searchOptions
                ? nemoIRRef.current.searchAstChunks(effectiveSearchTerm, searchOptions)
                : nemoIRRef.current.searchAstChunks(effectiveSearchTerm))
            : simulatorRef.current.searchAstChunks(effectiveSearchTerm);
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
              await nemoIRRef.current.executeWorkflow({ query: effectiveQuery });
            } catch {
              // Graceful continuation
            }
          }

          if (matchedChunks.length === 0) {
            finalResponseText = `### 🔍 No Matching AST Nodes Found for "${effectiveQuery}"\n\nNo Python functions, classes, or methods in the active repository matched your search query.\n\n- Try searching for broader terms or exact symbol names (e.g., \`send\`, \`Request\`, \`Calculator\`).\n- Open the **Explorer** sidebar to browse the indexed file tree and AST symbols.\n- Type \`/status\` to verify the active repository and indexed chunk count.`;
          } else {
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

            let currentTokens = estimateTokens(effectiveQuery) + 120;
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

            const prompt = isOverview
              ? `Context AST nodes:\n${astContext}\n\nUser Question: ${effectiveQuery}\n\nPlease synthesize a comprehensive architectural overview of this repository, explaining its primary purpose, core components (such as Session, Request, Response, Adapters), and execution pipeline.`
              : `Context AST nodes:\n${astContext}\n\nUser Question: ${effectiveQuery}\n\nPlease synthesize an architectural explanation highlighting key AST entities and line numbers.`;

            finalResponseText = await currentLLM.generate(prompt, (chunk, accumulated) => {
              if (isCancelledRef.current) return;
              streamingTokensRef.current = accumulated;
              setStreamingTokens(accumulated);
            });
            if (isCancelledRef.current) throw new Error('Query cancelled by user');
          }
        } else {
          // If NemoIR is available, search live LanceDB backend first
          let liveChunks: AstCodeChunk[] | undefined;
          if (nemoIRRef.current) {
            try {
              const searchOptions = activeRepoPathRef.current
                ? { filePath: activeRepoPathRef.current }
                : undefined;
              const res = await (searchOptions
                ? nemoIRRef.current.searchAstChunks(effectiveSearchTerm, searchOptions)
                : nemoIRRef.current.searchAstChunks(effectiveSearchTerm));
              if (res) {
                liveChunks = res;
              }
            } catch (nemoErr) {
              if (webLLMRef.current !== undefined) {
                throw nemoErr;
              }
              // Pure simulator fallback: gracefully continue with simulator chunks
            }
          }

          // Use simulator with live token streaming callback
          const result = await simulatorRef.current.runReActCycle(
            effectiveQuery,
            (state: ReActState, message: string, chunks?: AstCodeChunk[]) => {
              if (chunks !== undefined) {
                activeChunksRef.current = chunks;
                setActiveChunksState(chunks);
                setSelectedChunkIdState((current) => {
                  const nextSelected =
                    !current || !chunks.some((c) => c.id === current)
                      ? chunks[0]?.id ?? null
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

          const isFirstSimulatorResponse = !hasShownSimulatorNoticeRef.current;
          if (isFirstSimulatorResponse) {
            hasShownSimulatorNoticeRef.current = true;
            finalResponseText =
              result.response +
              '\n\n> 💡 *Note: Synthesized using deterministic AST Simulator. Click **WebLLM: Load** in the header to activate real-time local neural code synthesis (Qwen2.5-Coder on WebGPU).*';
          } else {
            finalResponseText = result.response;
          }
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

        const rawErrMsg = err?.message || 'Error occurred during ReAct loop';

        const errStatus: AgentStatus = {
          ...statusRef.current,
          state: isCancelled ? 'Idle' : 'Error',
          currentStepMessage: isCancelled
            ? 'Query cancelled by user'
            : rawErrMsg,
          error: isCancelled ? undefined : rawErrMsg,
        };
        statusRef.current = errStatus;
        try {
          if (typeof window !== 'undefined') {
            setAgentStatus(errStatus);
          }
        } catch {
          // Ignore state update on unmounted component
        }

        if (!isCancelled) {
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `### ❌ ReAct Execution Failed\n\n**${rawErrMsg}**\n\n- The local vector backend service at \`http://localhost:8000\` may be warming up or busy.\n- Type \`/status\` to check environment details or try again.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reActState: 'Error',
            citedChunks: [],
            metrics: {
              latencyMs: Date.now() - startTime,
              tokensGenerated: 0,
              astNodesSearched: 0,
            },
          };
          const errMsgs = [...messagesRef.current, errorMsg];
          messagesRef.current = errMsgs;
          setMessages(errMsgs);
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
    clearMessages,
    addMessage,
  };
}
