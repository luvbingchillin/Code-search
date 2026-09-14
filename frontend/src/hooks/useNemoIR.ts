import { useState, useCallback, useMemo } from 'react';
import { AstCodeChunk, NemoSearchOptions, NemoWasmStatus, UseNemoIRReturn } from '../types';
import { AgentSimulator } from '../services/agentSimulator';
import { mockAstChunks } from '../services/mockAstData';

export function useNemoIR(): UseNemoIRReturn {
  const [wasmStatus, setWasmStatus] = useState<NemoWasmStatus>('ready');
  const simulator = useMemo(() => new AgentSimulator(), []);

  const initNemo = useCallback(async (_wasmUrl?: string, _workflowUrl?: string) => {
    setWasmStatus('initializing');
    await new Promise((resolve) => setTimeout(resolve, 150));
    setWasmStatus('ready');
  }, []);

  const searchAstChunks = useCallback(
    async (query: string, options?: NemoSearchOptions): Promise<AstCodeChunk[]> => {
      // Simulate WASM SIMD execution overhead
      await new Promise((resolve) => setTimeout(resolve, 50));
      let results = simulator.searchAstChunks(query);

      if (options?.filters?.astNodeType) {
        results = results.filter((c) => c.astNodeType === options.filters?.astNodeType);
      }
      if (options?.filters?.repo) {
        results = results.filter((c) => c.repoFullName === options.filters?.repo);
      }
      if (options?.topK && options.topK > 0) {
        results = results.slice(0, options.topK);
      }

      return results.length > 0 ? results : mockAstChunks.slice(0, 2);
    },
    [simulator]
  );

  const executeWorkflow = useCallback(async (input: Record<string, unknown>): Promise<unknown> => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return {
      success: true,
      workflow: '.nemo-vector-search-v1',
      output: input,
    };
  }, []);

  return {
    wasmStatus,
    isReady: wasmStatus === 'ready',
    initNemo,
    searchAstChunks,
    executeWorkflow,
  };
}
