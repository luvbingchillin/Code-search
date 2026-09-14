import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReActAgent } from '../hooks/useReActAgent';
import { useWebLLM } from '../hooks/useWebLLM';
import { useNemoIR } from '../hooks/useNemoIR';

describe('Edge AI Hooks & State Machine Suite', () => {
  it('useWebLLM provides engine loading status and model generation placeholder', async () => {
    const { result } = renderHook(() => useWebLLM());

    expect(result.current.status).toBeDefined();
    expect(typeof result.current.generate).toBe('function');
    expect(typeof result.current.initEngine).toBe('function');
  });

  it('useNemoIR provides AST search capability and wasm status', async () => {
    const { result } = renderHook(() => useNemoIR());

    expect(result.current.isReady).toBe(true);
    expect(typeof result.current.searchAstChunks).toBe('function');

    const chunks = await result.current.searchAstChunks('JWT token validation');
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('astNodeType');
  });

  it('useReActAgent coordinates full agentic loop cycle', async () => {
    const { result } = renderHook(() => useReActAgent());

    expect(result.current.agentStatus.state).toBe('Idle');

    await act(async () => {
      const promise = result.current.submitQuery('Find connection pool handler');
      expect(result.current.agentStatus.state).toBe('Thinking');
      await promise;
    });

    expect(result.current.agentStatus.state).toBe('Complete');
    expect(result.current.activeChunks.length).toBeGreaterThan(0);
    expect(result.current.messages.length).toBeGreaterThan(0);
  });
});
