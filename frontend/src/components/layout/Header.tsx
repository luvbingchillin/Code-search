import React from 'react';
import { Cpu, Database, Sparkles, Terminal } from 'lucide-react';
import { AgentStatus, UseWebLLMReturn, UseNemoIRReturn } from '../../types';

interface HeaderProps {
  webLLM: UseWebLLMReturn;
  nemoIR: UseNemoIRReturn;
  agentStatus: AgentStatus;
}

export const Header: React.FC<HeaderProps> = ({ webLLM, nemoIR, agentStatus }) => {
  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Terminal className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-gray-100 tracking-tight text-base">CodeSeek AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 font-mono">
              Edge AI v1.0
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Generative Code Retrieval & Python AST Search Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* WebLLM Engine Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gray-800/80 border border-gray-700/60 text-xs">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-gray-300 font-medium">WebLLM:</span>
          <span className="text-emerald-400 font-mono font-medium">{webLLM.status === 'ready' ? 'WebGPU' : webLLM.status}</span>
        </div>

        {/* NemoIR Vector Search Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gray-800/80 border border-gray-700/60 text-xs">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-gray-300 font-medium">NemoIR:</span>
          <span className="text-blue-400 font-mono font-medium">{nemoIR.isReady ? 'Wasm SIMD' : nemoIR.wasmStatus}</span>
        </div>

        {/* Model Selector Pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-purple-950/40 border border-purple-800/50 text-xs text-purple-200">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-mono truncate max-w-[160px]">{webLLM.currentModel ?? 'Qwen2.5-Coder-1.5B'}</span>
        </div>
      </div>
    </header>
  );
};
