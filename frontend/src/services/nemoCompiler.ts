/**
 * NemoIR WebAssembly Compiler Service & JIT Compiler
 *
 * Provides in-browser and Node/test compilation of NemoIR (.nemo) workflow DSL
 * into lowered Agent Workflow IR JSON using @nemoir/compiler-wasm.
 */
import init, {
  analyze,
  metadata,
  type AnalyzeResponse,
  type CompilerDiagnostic,
  type InitInput,
} from '@nemoir/compiler-wasm';

export interface NemoCompileResult {
  ok: boolean;
  ir?: unknown;
  diagnostics: CompilerDiagnostic[];
  compilerVersion?: string;
  irVersion?: string;
  fromCache?: boolean;
}

/**
 * Standard ReAct workflow DSL for AST Code Retrieval.
 * Defines the state progression: Thinking -> SearchingAST -> Synthesizing -> Complete.
 */
export const DEFAULT_CODE_RETRIEVAL_WORKFLOW = `workflow CodeRetrievalAgent {
  input {
    query: string
  }

  stage @entry Thinking {
    prompt: "Analyze user query and formulate AST search strategy"
    output: {
      confidence: number
    }
    transition if confidence > 0.5 => SearchingAST
    transition else => Synthesizing
  }

  stage SearchingAST {
    prompt: "Search AST code chunks matching the query"
    output: {
      hasResults: bool {
        true => Synthesizing
        false => Complete
      }
    }
  }

  stage Synthesizing {
    prompt: "Synthesize explanation from retrieved AST chunks"
    transition else => Complete
  }

  stage @exit Complete {
    prompt: "Return code retrieval results to user"
  }
}
`;

// JIT Compilation Cache
const jitCache = new Map<string, NemoCompileResult>();

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initializes the NemoIR Wasm compiler.
 * Safe to call concurrently or repeatedly (singleton initialization).
 */
export async function initNemoCompiler(wasmInput?: InitInput): Promise<void> {
  if (isInitialized) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await init(wasmInput);
    isInitialized = true;
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    isInitialized = false;
    throw error;
  }
}

/**
 * Checks whether the Wasm compiler is initialized and ready.
 */
export function isNemoCompilerReady(): boolean {
  return isInitialized;
}

/**
 * Returns the current number of cached JIT-compiled workflows.
 */
export function getJitCacheSize(): number {
  return jitCache.size;
}

/**
 * Clears the JIT compilation cache.
 */
export function clearJitCache(): void {
  jitCache.clear();
}

/**
 * Compiles a .nemo workflow DSL string into Agent Workflow IR JSON.
 * Applies JIT caching to avoid recompiling unchanged workflow definitions.
 *
 * @param source The .nemo DSL source code.
 * @param filename Display filename (default: 'workflow.nemo').
 * @returns Compilation result containing ok status, lowered IR JSON, and any diagnostics.
 */
export async function compileNemoWorkflow(
  source: string,
  filename = 'workflow.nemo'
): Promise<NemoCompileResult> {
  await initNemoCompiler();

  const cacheKey = source.trim();
  if (jitCache.has(cacheKey)) {
    const cached = jitCache.get(cacheKey)!;
    return {
      ...cached,
      fromCache: true,
    };
  }

  try {
    const response: AnalyzeResponse = analyze({
      source,
      filename,
      includeIr: true,
    });

    const result: NemoCompileResult = {
      ok: response.ok,
      ir: response.ir,
      diagnostics: response.diagnostics || [],
      compilerVersion: response.compilerVersion,
      irVersion: response.irVersion,
      fromCache: false,
    };

    if (result.ok && result.ir) {
      jitCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    const diagnostic: CompilerDiagnostic = {
      phase: 'internal',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
    return {
      ok: false,
      ir: undefined,
      diagnostics: [diagnostic],
      fromCache: false,
    };
  }
}

/**
 * Compiles the default AST Code Retrieval workflow DSL.
 */
export async function compileCodeRetrievalWorkflow(): Promise<NemoCompileResult> {
  return compileNemoWorkflow(DEFAULT_CODE_RETRIEVAL_WORKFLOW, 'codeRetrieval.nemo');
}

/**
 * Returns version and target metadata from the Wasm compiler.
 */
export async function getNemoCompilerMetadata() {
  await initNemoCompiler();
  return metadata();
}
