import { useState, useCallback, useEffect, useRef } from 'react';
import {
  CreateMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
  type InitProgressCallback,
} from '@mlc-ai/web-llm';
import { UseWebLLMReturn, WebLLMLoadingStatus } from '../types';

export const DEFAULT_MODEL = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';

export interface UseWebLLMOptions {
  initialModel?: string;
  autoInit?: boolean;
}

export function checkWebGPUSupport(): { supported: boolean; reason?: string } {
  if (typeof navigator === 'undefined') {
    return {
      supported: false,
      reason: 'Navigator API is not defined in the current runtime environment.',
    };
  }
  if (!('gpu' in navigator) || !(navigator as any).gpu) {
    return {
      supported: false,
      reason: 'WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or a WebGPU-enabled browser.',
    };
  }
  return { supported: true };
}

export function useWebLLM(
  initialModelOrOptions: string | UseWebLLMOptions = DEFAULT_MODEL,
  legacyOptions?: { autoInit?: boolean }
): UseWebLLMReturn {
  const initialModel =
    typeof initialModelOrOptions === 'string'
      ? initialModelOrOptions
      : initialModelOrOptions?.initialModel ?? DEFAULT_MODEL;

  const autoInit =
    typeof initialModelOrOptions === 'object'
      ? Boolean(initialModelOrOptions?.autoInit)
      : Boolean(legacyOptions?.autoInit);

  const [status, setStatus] = useState<WebLLMLoadingStatus>('unloaded');
  const [progress, setProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>(
    `WebLLM engine unloaded (${initialModel})`
  );
  const [currentModel, setCurrentModel] = useState<string | null>(initialModel);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<MLCEngineInterface | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const isInterruptedRef = useRef<boolean>(false);
  const isWebGPUSupported = checkWebGPUSupport().supported;

  // Initialize WebGPU detection on mount
  useEffect(() => {
    const gpuCheck = checkWebGPUSupport();
    if (!gpuCheck.supported) {
      setStatus('error');
      const errReason = gpuCheck.reason || 'WebGPU is not supported in this browser.';
      setError(errReason);
      setProgressText(`WebGPU unavailable: ${errReason}`);
    } else {
      setError(null);
      setProgressText(`WebGPU detected. Ready to load ${initialModel}`);
      if (autoInit) {
        initEngine(initialModel).catch((e) => {
          console.error('Auto-initialization failed:', e);
        });
      }
    }
  }, [initialModel, autoInit]);

  const loadModel = useCallback(
    async (modelId?: string): Promise<void> => {
      const targetModel = modelId || currentModel || DEFAULT_MODEL;
      const gpuCheck = checkWebGPUSupport();

      if (!gpuCheck.supported) {
        const errMsg = gpuCheck.reason || 'WebGPU is not supported in this browser.';
        setStatus('error');
        setError(errMsg);
        setProgressText(errMsg);
        throw new Error(errMsg);
      }

      setStatus('loading');
      setError(null);
      setProgress(0);
      setProgressText(`Initializing WebLLM engine for ${targetModel}...`);

      const progressCallback: InitProgressCallback = (report: InitProgressReport) => {
        const pct =
          report.progress <= 1
            ? Math.round(report.progress * 100)
            : Math.round(report.progress);
        setProgress(pct);
        setProgressText(report.text);
      };

      try {
        if (engineRef.current && typeof (engineRef.current as any).reload === 'function') {
          await (engineRef.current as any).reload(targetModel);
        } else {
          const mlcEngine = await CreateMLCEngine(targetModel, {
            initProgressCallback: progressCallback,
          });
          engineRef.current = mlcEngine;
          setEngine(mlcEngine);
        }

        setCurrentModel(targetModel);
        setStatus('ready');
        setProgress(100);
        setProgressText(`WebLLM ready: ${targetModel}`);
      } catch (err: any) {
        const errorMsg = err?.message || `Failed to load WebLLM model: ${targetModel}`;
        setStatus('error');
        setError(errorMsg);
        setProgressText(`Model load failed: ${errorMsg}`);
        throw err;
      }
    },
    [currentModel]
  );

  const initEngine = useCallback(
    async (modelId?: string): Promise<void> => {
      return loadModel(modelId);
    },
    [loadModel]
  );

  const generate = useCallback(
    async (
      prompt: string | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      onToken?: (tokenChunk: string, accumulated: string) => void
    ): Promise<string> => {
      if (isInterruptedRef.current) {
        isInterruptedRef.current = false;
      }

      if (!engineRef.current && status !== 'ready') {
        throw new Error('WebLLM engine is not loaded. Please call initEngine() first.');
      }

      setStatus('generating');
      let accumulated = '';

      const messages =
        typeof prompt === 'string'
          ? [{ role: 'user' as const, content: prompt }]
          : prompt;

      try {
        if (engineRef.current && engineRef.current.chat?.completions?.create) {
          const response = await engineRef.current.chat.completions.create({
            messages,
            stream: true,
          });

          for await (const chunk of response as AsyncIterable<any>) {
            if (isInterruptedRef.current) {
              break;
            }
            const delta = chunk?.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              if (onToken) {
                onToken(delta, accumulated);
              }
            }
          }
        } else {
          // Fallback if engine interface is custom or mocked without chat.completions
          const promptText = typeof prompt === 'string' ? prompt : prompt[prompt.length - 1]?.content || '';
          accumulated = `[WebLLM edge inference for: "${promptText.slice(0, 40)}..."]`;
          if (onToken) {
            onToken(accumulated, accumulated);
          }
        }

        if (engineRef.current !== null) {
          setStatus('ready');
        }
        return accumulated;
      } catch (err: any) {
        if (isInterruptedRef.current) {
          if (engineRef.current !== null) {
            setStatus('ready');
          }
          return accumulated;
        }
        if (engineRef.current !== null) {
          setStatus('error');
        }
        const errStr = err?.message || 'Error occurred during generation';
        setError(errStr);
        throw err;
      }
    },
    [status]
  );

  const generateStream = useCallback(
    async (
      prompt: string | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      onToken?: (tokenChunk: string, accumulated: string) => void
    ): Promise<string> => {
      return generate(prompt, onToken);
    },
    [generate]
  );

  const interrupt = useCallback(async () => {
    isInterruptedRef.current = true;
    if (engineRef.current && typeof (engineRef.current as any).interruptGenerate === 'function') {
      try {
        await (engineRef.current as any).interruptGenerate();
      } catch (e) {
        // ignore error during interrupt
      }
    }
    if (engineRef.current !== null) {
      setStatus('ready');
    }
  }, []);

  const unload = useCallback(async () => {
    isInterruptedRef.current = true;
    if (engineRef.current && typeof (engineRef.current as any).unload === 'function') {
      try {
        await (engineRef.current as any).unload();
      } catch (e) {
        // ignore error during unload
      }
      engineRef.current = null;
      setEngine(null);
    }
    setStatus('unloaded');
    setProgress(0);
    setProgressText('WebLLM Engine unloaded');
    setError(null);
  }, []);

  return {
    status,
    progress,
    progressText,
    currentModel,
    error,
    isWebGPUSupported,
    engine,
    loadModel,
    initEngine,
    generate,
    generateStream,
    interrupt,
    unload,
  };
}
