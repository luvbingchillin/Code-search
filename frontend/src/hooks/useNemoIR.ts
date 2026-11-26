import { useState, useCallback } from 'react';
import { AstCodeChunk, NemoSearchOptions, NemoWasmStatus, UseNemoIRReturn } from '../types';
import { apiClient } from '../services/apiClient';
import { compileCodeRetrievalWorkflow, initNemoCompiler } from '../services/nemoCompiler';

export function useNemoIR(): UseNemoIRReturn {
  const [wasmStatus, setWasmStatus] = useState<NemoWasmStatus>('ready');

  const initNemo = useCallback(async (_wasmUrl?: string, _workflowUrl?: string) => {
    setWasmStatus('initializing');
    try {
      await Promise.allSettled([
        apiClient.getHealth(),
        initNemoCompiler(),
      ]);
      setWasmStatus('ready');
    } catch {
      // Backend or wasm may be starting up; preserve ready state
      setWasmStatus('ready');
    }
  }, []);

  const searchAstChunks = useCallback(
    async (query: string, options?: NemoSearchOptions): Promise<AstCodeChunk[]> => {
      return apiClient.searchAstChunks(query, options);
    },
    []
  );

  const lookupEntity = useCallback(
    async (name: string): Promise<AstCodeChunk[]> => {
      const response = await apiClient.lookupEntity(name);
      return response.chunks;
    },
    []
  );

  const executeWorkflow = useCallback(async (input: Record<string, unknown>): Promise<unknown> => {
    const compileResult = await compileCodeRetrievalWorkflow();
    const ir = compileResult.ir as {
      workflow?: { entry?: string };
      nodes?: Array<{ id: string }>;
    } | undefined;
    const nodeIds = new Set((ir?.nodes ?? []).map((n) => n.id));
    const hasResults = input.hasResults !== false;

    const stages: string[] = [];
    if (nodeIds.has('Thinking')) stages.push('Thinking');
    if (nodeIds.has('SearchingAST')) stages.push('SearchingAST');
    if (hasResults && nodeIds.has('Synthesizing')) stages.push('Synthesizing');
    if (nodeIds.has('Complete')) stages.push('Complete');

    return {
      success: compileResult.ok,
      workflow: '.nemo-vector-search-v1',
      ir: compileResult.ir,
      diagnostics: compileResult.diagnostics,
      stages: stages.length > 0 ? stages : ['Thinking', 'SearchingAST', ...(hasResults ? ['Synthesizing'] : []), 'Complete'],
      output: input,
    };
  }, []);

  return {
    wasmStatus,
    isReady: wasmStatus === 'ready',
    initNemo,
    searchAstChunks,
    lookupEntity,
    executeWorkflow,
  };
}
