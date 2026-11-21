import React from 'react';
import { Cpu, Sparkles, AlertCircle, Loader2, PanelLeftClose, PanelRightClose, FolderCode, Zap } from 'lucide-react';
import { AgentStatus, UseWebLLMReturn, UseNemoIRReturn, RepositoryItem } from '../../types';
import { apiClient as defaultApiClient, HealthResponse } from '../../services/apiClient';
import { TURBO_MODEL, PRECISION_MODEL } from '../../hooks/useWebLLM';

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

  const checkHealth = React.useCallback(async () => {
    try {
      const resp = await client.getHealth();
      const healthy = Boolean(resp && (resp.status === 'healthy' || resp.status === 'ok'));
      setHealth(resp);
      setIsBackendHealthy(healthy);
    } catch {
      setHealth(null);
      setIsBackendHealthy(false);
    }
  }, [client]);

  React.useEffect(() => {
    let isMounted = true;
    const run = async () => {
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
    run();
    return () => {
      isMounted = false;
    };
  }, [client, healthRefreshTrigger, activeRepo]);
  const isWebGPUUnsupported = !webLLM.isWebGPUSupported && webLLM.status === 'error';

  const getWebLLMStatusColor = () => {
    if (isWebGPUUnsupported) {
      return 'text-slate-300 border-slate-700 bg-slate-800/80';
    }
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
    if (isWebGPUUnsupported) {
      return <Cpu className="w-3.5 h-3.5 text-slate-400" />;
    }
    if (webLLM.status === 'loading') {
      return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
    }
    if (webLLM.status === 'error') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
    }
    return <Cpu className={`w-3.5 h-3.5 ${webLLM.status === 'ready' ? 'text-emerald-400' : 'text-slate-400'}`} />;
  };

  const getWebLLMLabel = () => {
    if (isWebGPUUnsupported) return 'No WebGPU';
    if (webLLM.status === 'ready') return 'Ready';
    if (webLLM.status === 'unloaded') return 'Offline';
    if (webLLM.status === 'loading') {
      const clampedPct = Math.min(100, Math.max(0, Math.round(webLLM.progress)));
      return clampedPct > 0 ? `${clampedPct}%` : 'loading';
    }
    return webLLM.status;
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between gap-2 select-none overflow-hidden">
      <div className="flex items-center space-x-2.5 min-w-0 shrink-0">
        {/* Bespoke CodeSeek AI Bracket-Node Brand Mark */}
        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-sky-500/40 flex items-center justify-center shadow-xs shrink-0">
          <svg viewBox="0 0 100 100" className="w-4 h-4" aria-hidden="true">
            <path
              d="M30 38 L18 50 L30 62 M70 38 L82 50 L70 62 M58 28 L42 72"
              stroke="#38bdf8"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="80" cy="20" r="9" fill="#38bdf8" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-100 tracking-tight text-sm sm:text-base font-sans whitespace-nowrap">
              CodeSeek AI
            </span>
            <span className="hidden xl:inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700 font-mono font-medium whitespace-nowrap">
              Edge AI v1.0
            </span>
          </div>
          <p className="hidden 2xl:block text-xs text-slate-400 truncate">
            Generative Code Retrieval &amp; Semantic Search Engine
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
        {/* Connect / Switch Repository Trigger Button */}
        {onOpenConnectRepo && (
          <button
            type="button"
            data-testid="connect-repo-btn"
            onClick={onOpenConnectRepo}
            className="flex items-center space-x-1.5 px-2.5 min-h-[28px] py-1 rounded-md bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs text-slate-200 transition-colors shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 emil-press whitespace-nowrap shrink-0"
            title={
              activeRepo
                ? `Active Repository: ${activeRepo.name} (${activeRepo.chunksCount ?? 0} code definitions). Click to switch or add.`
                : 'Open pre-indexed repository or index new Python codebase'
            }
          >
            <FolderCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-medium max-w-[105px] sm:max-w-[130px] truncate">
              {activeRepo ? activeRepo.name : 'Repositories'}
            </span>
            {activeRepo && (
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-900 text-[11px] font-mono text-slate-300 border border-slate-700/60">
                {activeRepo.chunksCount ?? 0}
              </span>
            )}
          </button>
        )}

        {/* Live Backend Health & LanceDB Status Indicator (clickable to retry) */}
        <button
          type="button"
          data-testid="backend-health-pill"
          onClick={checkHealth}
          className={`hidden md:flex items-center space-x-1.5 px-2.5 min-h-[28px] py-1 rounded-md border text-[11px] shadow-xs font-mono select-none whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            isBackendHealthy
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-600/70'
              : 'bg-amber-950/50 text-amber-300 border-amber-600/70'
          }`}
          title={
            isBackendHealthy
              ? `Backend API connected at localhost:8000 (${health?.total_chunks ?? 0} indexed chunks in LanceDB). Click to refresh.`
              : 'Backend API offline - operating in local simulator mode. Click to retry connection.'
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
        </button>

        {/* Unified Local AI Engine Control Cluster (Status + Active Model + Tier Toggle) */}
        <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-slate-950/90 border border-slate-700/80 shadow-xs shrink-0">
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
            className={`flex items-center space-x-1.5 px-2 min-h-[26px] py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer disabled:cursor-wait hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 emil-press whitespace-nowrap ${getWebLLMStatusColor()}`}
            title={
              isWebGPUUnsupported
                ? 'WebGPU is unavailable in this browser (deterministic AST analysis remains active).'
                : webLLM.status === 'unloaded'
                ? 'WebLLM is currently offline (using deterministic AST analysis). Click to load Qwen2.5-Coder (~390MB–980MB) for real-time edge AI inference on WebGPU.'
                : webLLM.status === 'ready'
                ? 'WebLLM ready (Qwen2.5-Coder running on WebGPU). Click to unload.'
                : webLLM.progressText || (webLLM.error ? `Error: ${webLLM.error}` : 'Local WebLLM Model Status')
            }
          >
            {getWebLLMIcon()}
            <span className="hidden sm:inline text-slate-300 font-medium">WebLLM:</span>
            <span className="font-mono font-semibold">{getWebLLMLabel()}</span>
            {webLLM.status === 'unloaded' && (
              <span className="hidden sm:inline-block ml-0.5 px-1.5 py-0.2 rounded bg-sky-950/70 text-sky-300 text-[11px] font-mono border border-sky-700/50">
                Click to Load
              </span>
            )}
          </button>

          {/* Compact Model Indicator & Tier Switch */}
          <div className="hidden lg:flex items-center space-x-1">
            <div
              data-testid="model-indicator-badge"
              className="hidden 2xl:flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs text-slate-300"
              title={
                webLLM.status === 'ready'
                  ? `Edge Model: ${webLLM.currentModel ?? 'Qwen2.5-Coder (1.5B)'} running locally on WebGPU`
                  : 'Target Local Model on WebGPU (Standby - Click WebLLM to load)'
              }
            >
              <span className="font-mono font-medium truncate max-w-[160px] text-[11px] text-slate-400">
                {webLLM.currentModel ?? 'Qwen2.5-Coder (1.5B)'}
              </span>
              <span className="sr-only">{webLLM.status === 'ready' ? 'Active' : 'Standby'}</span>
            </div>

            <button
              type="button"
              data-testid="model-tier-toggle-btn"
              disabled={webLLM.status === 'loading'}
              onClick={() => {
                const isCurrentTurbo = Boolean(webLLM.currentModel && webLLM.currentModel.includes('0.5B'));
                const targetModel = isCurrentTurbo ? PRECISION_MODEL : TURBO_MODEL;
                webLLM.loadModel(targetModel);
              }}
              className="flex items-center space-x-1 px-2 min-h-[26px] py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-[11px] text-slate-200 transition-colors cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 emil-press whitespace-nowrap"
              title={
                webLLM.currentModel?.includes('0.5B')
                  ? 'Active: Turbo 0.5B (~390MB). Click to load Precision 1.5B (~980MB download).'
                  : 'Active: Precision 1.5B (~980MB). Click to load Turbo 0.5B (~390MB download).'
              }
            >
              {webLLM.currentModel?.includes('0.5B') ? (
                <>
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="font-mono font-semibold text-amber-300">Turbo 0.5B</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span className="font-mono font-semibold text-sky-300">Precision 1.5B</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Layout Pane Visibility Controls (Desktop md+ only; mobile uses tab bar) */}
        {(onToggleChatMinimized || onToggleCodeMinimized) && (
          <div className="hidden md:flex items-center space-x-1 pl-2 border-l border-slate-800 shrink-0">
            {onToggleChatMinimized && (
              <button
                type="button"
                data-testid="toggle-chat-pane-btn"
                onClick={onToggleChatMinimized}
                className={`p-1.5 min-w-[32px] min-h-[32px] rounded transition-colors text-xs flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
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
                className={`p-1.5 min-w-[32px] min-h-[32px] rounded transition-colors text-xs flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
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
