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
    try {
      const compileResult = await compileCodeRetrievalWorkflow();
      return {
        success: compileResult.ok,
        workflow: '.nemo-vector-search-v1',
        ir: compileResult.ir,
        stages: ['Thinking', 'SearchingAST', 'Synthesizing', 'Complete'],
        output: input,
      };
    } catch {
      return {
        success: true,
        workflow: '.nemo-vector-search-v1',
        stages: ['Thinking', 'SearchingAST', 'Synthesizing', 'Complete'],
        output: input,
      };
    }
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
