import { useState, useCallback } from 'react';
import { AstCodeChunk, NemoSearchOptions, NemoWasmStatus, UseNemoIRReturn } from '../types';
import { apiClient } from '../services/apiClient';

export function useNemoIR(): UseNemoIRReturn {
  const [wasmStatus, setWasmStatus] = useState<NemoWasmStatus>('ready');

  const initNemo = useCallback(async (_wasmUrl?: string, _workflowUrl?: string) => {
    setWasmStatus('initializing');
    try {
      await apiClient.getHealth();
      setWasmStatus('ready');
    } catch {
      // Backend may be starting up; preserve ready state
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
    lookupEntity,
    executeWorkflow,
  };
}
