import React from 'react';
import { Cpu, Sparkles, Terminal, AlertCircle, Loader2, PanelLeftClose, PanelRightClose, FolderCode } from 'lucide-react';
import { AgentStatus, UseWebLLMReturn, UseNemoIRReturn, RepositoryItem } from '../../types';
import { apiClient as defaultApiClient, HealthResponse } from '../../services/apiClient';

interface HeaderProps {
  webLLM: UseWebLLMReturn;
  nemoIR?: UseNemoIRReturn;
  agentStatus: AgentStatus;
  activeRepo?: RepositoryItem | null;
  healthRefreshTrigger?: number;
  apiClient?: { getHealth: (options?: { signal?: AbortSignal }) => Promise<HealthResponse> };
  isChatMinimized?: boolean;
  onToggleChatMinimized?: () => void;
  isCodeMinimized?: boolean;
  onToggleCodeMinimized?: () => void;
  onOpenConnectRepo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  webLLM,
  nemoIR,
  activeRepo,
  healthRefreshTrigger = 0,
  apiClient: apiClientProp,
  isChatMinimized = false,
  onToggleChatMinimized,
  isCodeMinimized = false,
  onToggleCodeMinimized,
  onOpenConnectRepo,
}) => {
  const client = apiClientProp ?? defaultApiClient;
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = React.useState<boolean>(false);

  React.useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const resp = await client.getHealth();
        if (!isMounted) return;
        const healthy = Boolean(resp && (resp.status === 'healthy' || resp.status === 'ok'));
        setHealth(resp);
        setIsBackendHealthy(healthy);
      } catch {
        if (!isMounted) return;
        setHealth(null);
        setIsBackendHealthy(false);
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, [client, healthRefreshTrigger, activeRepo]);
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
    if (webLLM.status === 'ready') return 'Ready';
    if (webLLM.status === 'unloaded') return 'Offline';
    if (webLLM.status === 'loading') {
      const clampedPct = Math.min(100, Math.max(0, Math.round(webLLM.progress)));
      return clampedPct > 0 ? `${clampedPct}%` : 'loading';
    }
    return webLLM.status;
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-3">
        {/* Distinctive Developer Brand Icon */}
        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700/80 flex items-center justify-center shadow-xs">
          <Terminal className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 tracking-tight text-base font-sans">CodeSeek AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700 font-mono font-medium">
              Edge AI v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400">Generative Code Retrieval & Semantic Search Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5">
        {/* Connect / Switch Repository Trigger Button */}
        {onOpenConnectRepo && (
          <button
            type="button"
            data-testid="connect-repo-btn"
            onClick={onOpenConnectRepo}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs text-slate-200 transition-colors shadow-xs cursor-pointer active:scale-95 emil-press"
            title={
              activeRepo
                ? `Active Repository: ${activeRepo.name} (${activeRepo.chunksCount ?? 0} code definitions). Click to switch or add.`
                : 'Open pre-indexed repository or index new Python codebase'
            }
          >
            <FolderCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-medium max-w-[130px] truncate">
              {activeRepo ? activeRepo.name : 'Repositories'}
            </span>
            {activeRepo && (
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-900 text-[10px] font-mono text-slate-300 border border-slate-700/60">
                {activeRepo.chunksCount ?? 0}
              </span>
            )}
          </button>
        )}

        {/* Live Backend Health & LanceDB Status Indicator */}
        <div
          data-testid="backend-health-pill"
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs shadow-xs font-mono select-none ${
            isBackendHealthy
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-600/70'
              : 'bg-amber-950/50 text-amber-300 border-amber-600/70'
          }`}
          title={
            isBackendHealthy
              ? `Backend API connected at localhost:8000 (${health?.total_chunks ?? 0} indexed chunks in LanceDB)`
              : 'Backend API offline - operating in local simulator mode'
          }
        >
          <span
            data-testid="backend-health-dot"
            className={`w-2 h-2 rounded-full shrink-0 ${
              isBackendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span data-testid="backend-health-label" className="font-semibold">
            {isBackendHealthy
              ? `API:8000 (LanceDB: ${health?.total_chunks ?? 0})`
              : 'API: Offline (Simulator)'}
          </span>
        </div>

        {/* Interactive WebLLM Engine Badge with Dynamic Progress & Controls */}
        <button
          type="button"
          data-testid="webllm-load-toggle-btn"
          onClick={() => {
            if (webLLM.status === 'unloaded' || webLLM.status === 'error') {
              webLLM.loadModel();
            } else if (webLLM.status === 'ready' && typeof webLLM.unload === 'function') {
              webLLM.unload();
            }
          }}
          disabled={webLLM.status === 'loading'}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors shadow-xs cursor-pointer disabled:cursor-wait hover:brightness-110 active:scale-95 emil-press ${getWebLLMStatusColor()}`}
          title={
            webLLM.status === 'unloaded'
              ? 'WebLLM is currently offline (using template simulator). Click to load Qwen2.5-Coder for real-time edge AI inference on WebGPU.'
              : webLLM.status === 'ready'
              ? 'WebLLM ready (Qwen2.5-Coder running on WebGPU). Click to unload.'
              : webLLM.progressText || (webLLM.error ? `Error: ${webLLM.error}` : 'Local WebLLM Model Status')
          }
        >
          {getWebLLMIcon()}
          <span className="text-slate-300 font-medium">WebLLM:</span>
          <span className="font-mono font-semibold">{getWebLLMLabel()}</span>
          {webLLM.status === 'unloaded' && (
            <span className="ml-1 px-1.5 py-0.2 rounded bg-sky-950/70 text-sky-300 text-[10px] font-mono border border-sky-700/50">
              Click to Load
            </span>
          )}
        </button>

        {/* Model Indicator with Informative Tooltip */}
        <div
          data-testid="model-indicator-badge"
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-700/80 text-xs text-slate-300 shadow-xs"
          title={
            webLLM.status === 'ready'
              ? 'Edge SLM: Qwen2.5-Coder-1.5B running locally on WebGPU'
              : 'Target Edge SLM: Qwen2.5-Coder-1.5B on WebGPU (Standby - Click WebLLM to load)'
          }
        >
          <Cpu className={`w-3.5 h-3.5 ${webLLM.status === 'ready' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="font-mono font-medium truncate max-w-[150px]">
            {webLLM.currentModel ?? 'Qwen2.5-Coder (1.5B)'}
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
            webLLM.status === 'ready'
              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-700/50'
              : 'bg-slate-900 text-slate-500 border-slate-700/40'
          }`}>
            {webLLM.status === 'ready' ? 'Active' : 'Standby'}
          </span>
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
                    ? 'bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700'
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
                    ? 'bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                }`}
                title={isCodeMinimized ? 'Restore Code Viewer' : 'Minimize Code Viewer'}
                aria-label={isCodeMinimized ? 'Restore Code Viewer' : 'Minimize Code Viewer'}
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
