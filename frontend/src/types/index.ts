export type AstNodeType =
  | 'FunctionDef'
  | 'AsyncFunctionDef'
  | 'ClassDef'
  | 'Module'
  | 'Assign';

export interface AstCodeChunk {
  id: string;
  filePath: string;
  fileName: string;
  astNodeType: AstNodeType;
  identifier: string; // functionName or className
  startLine: number;
  endLine: number;
  code: string;
  relevanceScore: number; // 0.0 - 1.0
  docstring?: string;
  parameters?: string[];
  decorators?: string[];
  language?: 'python';
  repoFullName?: string;
  summary?: string;
  imports?: string[];
  calls?: string[];
}

export type ReActState =
  | 'Idle'
  | 'Thinking'
  | 'Searching AST'
  | 'Synthesizing'
  | 'Complete'
  | 'Error';

export interface AgentStatus {
  state: ReActState;
  currentStepMessage: string;
  elapsedMs: number;
  activeChunkCount: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  reActState?: ReActState;
  thoughts?: string[];
  citedChunks?: string[]; // IDs of AstCodeChunk
  metrics?: {
    latencyMs: number;
    tokensGenerated?: number;
    astNodesSearched?: number;
  };
}

export type WebLLMLoadingStatus = 'unloaded' | 'loading' | 'ready' | 'generating' | 'error';

export interface UseWebLLMReturn {
  status: WebLLMLoadingStatus;
  progress: number;
  progressText: string;
  currentModel: string | null;
  error: string | null;
  isWebGPUSupported: boolean;
  engine: unknown | null;
  loadModel: (modelId?: string) => Promise<void>;
  generate: (
    prompt: string | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onToken?: (chunk: string, accumulated: string) => void
  ) => Promise<string>;
  generateStream: (
    prompt: string | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onToken?: (chunk: string, accumulated: string) => void
  ) => Promise<string>;
  initEngine: (modelId?: string) => Promise<void>;
  interrupt: () => void | Promise<void>;
  unload: () => Promise<void>;
}

export type NemoWasmStatus = 'uninitialized' | 'initializing' | 'ready' | 'error';

export interface NemoSearchOptions {
  topK?: number;
  filters?: {
    repo?: string;
    astNodeType?: AstNodeType;
    filePath?: string;
  };
}

export interface UseNemoIRReturn {
  wasmStatus: NemoWasmStatus;
  isReady: boolean;
  initNemo: (wasmUrl?: string, workflowUrl?: string) => Promise<void>;
  searchAstChunks: (query: string, options?: NemoSearchOptions) => Promise<AstCodeChunk[]>;
  executeWorkflow: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface UseReActAgentReturn {
  agentStatus: AgentStatus;
  messages: ChatMessage[];
  activeChunks: AstCodeChunk[];
  selectedChunkId: string | null;
  streamingTokens?: string;
  submitQuery: (query: string) => Promise<void>;
  cancelQuery: () => void;
  setSelectedChunkId: (id: string) => void;
  reset?: () => void;
}
