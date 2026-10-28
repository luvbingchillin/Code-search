import React from 'react';
import { Cpu, Database, Sparkles, Terminal, AlertCircle, Loader2, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { AgentStatus, UseWebLLMReturn, UseNemoIRReturn } from '../../types';

interface HeaderProps {
  webLLM: UseWebLLMReturn;
  nemoIR: UseNemoIRReturn;
  agentStatus: AgentStatus;
  isChatMinimized?: boolean;
  onToggleChatMinimized?: () => void;
  isCodeMinimized?: boolean;
  onToggleCodeMinimized?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  webLLM,
  nemoIR,
  isChatMinimized = false,
  onToggleChatMinimized,
  isCodeMinimized = false,
  onToggleCodeMinimized,
}) => {
  const getWebLLMStatusColor = () => {
    switch (webLLM.status) {
      case 'ready':
        return 'text-emerald-300 border-emerald-600/70 bg-emerald-950/50';
      case 'loading':
        return 'text-amber-300 border-amber-600/70 bg-amber-950/50';
      case 'error':
        return 'text-rose-300 border-rose-600/70 bg-rose-950/50';
      case 'unloaded':
      default:
        return 'text-slate-300 border-slate-700 bg-slate-800/90';
    }
  };

  const getWebLLMIcon = () => {
    if (webLLM.status === 'loading') {
      return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
    }
    if (webLLM.status === 'error') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
    }
    return <Cpu className={`w-3.5 h-3.5 ${webLLM.status === 'ready' ? 'text-emerald-400' : 'text-slate-400'}`} />;
  };

  const getWebLLMLabel = () => {
    if (webLLM.status === 'ready') return 'WebGPU';
    if (webLLM.status === 'loading') {
      return webLLM.progress > 0 ? `${Math.round(webLLM.progress * 100)}%` : 'loading';
    }
    return webLLM.status;
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-3">
        {/* Distinctive Developer Brand Icon */}
        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-indigo-500/50 flex items-center justify-center shadow-md shadow-indigo-950/40">
          <Terminal className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 tracking-tight text-base font-sans">CodeSeek AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-600/60 font-mono font-medium">
              Edge AI v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400">Generative Code Retrieval & Python AST Search Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5">
        {/* WebLLM Engine Badge with Dynamic Progress & Color */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors shadow-xs ${getWebLLMStatusColor()}`}
          title={webLLM.progressText || (webLLM.error ? `Error: ${webLLM.error}` : 'Local WebLLM Model Status')}
        >
          {getWebLLMIcon()}
          <span className="text-slate-300 font-medium">WebLLM:</span>
          <span className="font-mono font-semibold">{getWebLLMLabel()}</span>
        </div>

        {/* NemoIR Vector Search Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-xs shadow-xs">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-300 font-medium">NemoIR:</span>
          <span className="text-blue-300 font-mono font-semibold">{nemoIR.isReady ? 'Wasm SIMD' : nemoIR.wasmStatus}</span>
        </div>

        {/* Model Selector / Accelerator Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-700/80 text-xs text-slate-300 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono font-medium truncate max-w-[150px]">{webLLM.currentModel ?? 'Qwen2.5-Coder'}</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-600 rounded shadow-xs" title="Search Shortcut">
            {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </div>

        {/* Layout Pane Visibility Controls (Toggle Chat / Toggle Code Viewer) */}
        {(onToggleChatMinimized || onToggleCodeMinimized) && (
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
            {onToggleChatMinimized && (
              <button
                type="button"
                data-testid="toggle-chat-pane-btn"
                onClick={onToggleChatMinimized}
                className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center cursor-pointer ${
                  !isChatMinimized
                    ? 'bg-slate-800 text-indigo-300 border border-slate-700 hover:bg-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                }`}
                title={isChatMinimized ? 'Restore Chat Pane (Ctrl+B)' : 'Minimize Chat Pane (Ctrl+B)'}
                aria-label={isChatMinimized ? 'Restore Chat Pane' : 'Minimize Chat Pane'}
              >
                <PanelLeftClose className={`w-4 h-4 ${isChatMinimized ? 'rotate-180 text-slate-400' : ''}`} />
              </button>
            )}

            {onToggleCodeMinimized && (
              <button
                type="button"
                data-testid="toggle-code-pane-btn"
                onClick={onToggleCodeMinimized}
                className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center cursor-pointer ${
                  !isCodeMinimized
                    ? 'bg-slate-800 text-indigo-300 border border-slate-700 hover:bg-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                }`}
                title={isCodeMinimized ? 'Restore AST Code Viewer' : 'Minimize AST Code Viewer'}
                aria-label={isCodeMinimized ? 'Restore AST Code Viewer' : 'Minimize AST Code Viewer'}
              >
                <PanelRightClose className={`w-4 h-4 ${isCodeMinimized ? 'rotate-180 text-slate-400' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
