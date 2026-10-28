import React from 'react';
import { Cpu, Database, Sparkles, Terminal, AlertCircle, Loader2 } from 'lucide-react';
import { AgentStatus, UseWebLLMReturn, UseNemoIRReturn } from '../../types';

interface HeaderProps {
  webLLM: UseWebLLMReturn;
  nemoIR: UseNemoIRReturn;
  agentStatus: AgentStatus;
}

export const Header: React.FC<HeaderProps> = ({ webLLM, nemoIR }) => {
  const getWebLLMStatusColor = () => {
    switch (webLLM.status) {
      case 'ready':
        return 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30';
      case 'loading':
        return 'text-amber-400 border-amber-800/50 bg-amber-950/30';
      case 'error':
        return 'text-rose-400 border-rose-800/50 bg-rose-950/30';
      case 'unloaded':
      default:
        return 'text-gray-400 border-gray-700/60 bg-gray-800/80';
    }
  };

  const getWebLLMIcon = () => {
    if (webLLM.status === 'loading') {
      return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
    }
    if (webLLM.status === 'error') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
    }
    return <Cpu className={`w-3.5 h-3.5 ${webLLM.status === 'ready' ? 'text-emerald-400' : 'text-gray-400'}`} />;
  };

  const getWebLLMLabel = () => {
    if (webLLM.status === 'ready') return 'WebGPU';
    if (webLLM.status === 'loading') {
      return webLLM.progress > 0 ? `${Math.round(webLLM.progress * 100)}%` : 'loading';
    }
    return webLLM.status;
  };

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-3">
        {/* Distinctive Developer Brand Icon */}
        <div className="w-8 h-8 rounded-lg bg-gray-950 border border-indigo-500/40 flex items-center justify-center shadow-md shadow-indigo-950/30">
          <Terminal className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-gray-100 tracking-tight text-base font-sans">CodeSeek AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-700/50 font-mono">
              Edge AI v1.0
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Generative Code Retrieval & Python AST Search Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5">
        {/* WebLLM Engine Badge with Dynamic Progress & Color */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${getWebLLMStatusColor()}`}
          title={webLLM.progressText || (webLLM.error ? `Error: ${webLLM.error}` : 'Local WebLLM Model Status')}
        >
          {getWebLLMIcon()}
          <span className="text-gray-300 font-medium">WebLLM:</span>
          <span className="font-mono font-medium">{getWebLLMLabel()}</span>
        </div>

        {/* NemoIR Vector Search Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gray-800/80 border border-gray-700/60 text-xs">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-gray-300 font-medium">NemoIR:</span>
          <span className="text-blue-400 font-mono font-medium">{nemoIR.isReady ? 'Wasm SIMD' : nemoIR.wasmStatus}</span>
        </div>

        {/* Model Selector / Accelerator Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gray-950/70 border border-gray-800 text-xs text-gray-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono truncate max-w-[150px]">{webLLM.currentModel ?? 'Qwen2.5-Coder'}</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-gray-800 text-gray-400 border border-gray-700 rounded shadow-xs">
            ⌘K
          </kbd>
        </div>
      </div>
    </header>
  );
};
