import React, { useState } from 'react';
import {
  Brain,
  Search,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  StopCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Terminal,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AgentStatus, ReActState } from '../../types';
import { WorkflowTraceDrawer } from '@nemoir/web-ui';
import type { CoalescedTimelineItem } from '@nemoir/web-ui';

export type NormalizedAgentState =
  | 'idle'
  | 'thinking'
  | 'searching'
  | 'synthesizing'
  | 'complete'
  | 'error';

export interface AgentExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message?: string;
  durationMs?: number;
}

export interface AgentRunnerProps {
  status?: AgentStatus;
  state?: ReActState | string;
  currentStepMessage?: string;
  elapsedMs?: number;
  activeChunkCount?: number;
  error?: string;
  streamingTokens?: string;
  steps?: AgentExecutionStep[];
  timeline?: readonly CoalescedTimelineItem[];
  onCancel?: () => void;
  onReset?: () => void;
  compact?: boolean;
  className?: string;
}

export function normalizeAgentState(state?: string): NormalizedAgentState {
  if (!state) return 'idle';
  const lower = state.trim().toLowerCase();
  if (lower.startsWith('think')) return 'thinking';
  if (lower.startsWith('search')) return 'searching';
  if (lower.startsWith('synth')) return 'synthesizing';
  if (lower.startsWith('complete') || lower.startsWith('done') || lower.startsWith('success'))
    return 'complete';
  if (lower.startsWith('err') || lower.startsWith('fail')) return 'error';
  return 'idle';
}

export function getDisplayStateLabel(norm: NormalizedAgentState): string {
  switch (norm) {
    case 'thinking':
      return 'Thinking';
    case 'searching':
      return 'Searching AST';
    case 'synthesizing':
      return 'Synthesizing';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
    case 'idle':
    default:
      return 'Idle';
  }
}

export const AgentRunner: React.FC<AgentRunnerProps> = ({
  status,
  state: propState,
  currentStepMessage: propMessage,
  elapsedMs: propElapsed,
  activeChunkCount: propChunks,
  error: propError,
  streamingTokens,
  steps: customSteps,
  timeline,
  onCancel,
  onReset,
  compact = false,
  className = '',
}) => {
  // Resolve active properties merging explicit props and status object
  const rawState = propState ?? status?.state ?? 'Idle';
  const normState = normalizeAgentState(rawState);
  const displayLabel = getDisplayStateLabel(normState);
  const stepMessage = propMessage ?? status?.currentStepMessage ?? (normState === 'idle' ? 'NemoIR ReAct Agent Ready' : '');
  const elapsedMs = propElapsed ?? status?.elapsedMs ?? 0;
  const chunkCount = propChunks ?? status?.activeChunkCount ?? 0;
  const errorMsg = propError ?? status?.error;

  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  const isBusy =
    normState === 'thinking' ||
    normState === 'searching' ||
    normState === 'synthesizing';

  // Build default ReAct steps if not supplied by caller
  const defaultSteps: AgentExecutionStep[] = [
    {
      id: 'step-thinking',
      name: 'Intent & Planning',
      status:
        normState === 'error' && !isBusy
          ? 'error'
          : normState === 'thinking'
          ? 'running'
          : normState === 'searching' || normState === 'synthesizing' || normState === 'complete'
          ? 'completed'
          : 'pending',
      message: normState === 'thinking' ? stepMessage : 'Query intent analyzed',
    },
    {
      id: 'step-searching',
      name: 'AST Vector Search',
      status:
        normState === 'searching'
          ? 'running'
          : normState === 'synthesizing' || normState === 'complete'
          ? 'completed'
          : 'pending',
      message:
        normState === 'searching'
          ? stepMessage
          : chunkCount > 0
          ? `${chunkCount} AST code chunks retrieved`
          : undefined,
    },
    {
      id: 'step-synthesizing',
      name: 'WebLLM Synthesis',
      status:
        normState === 'synthesizing'
          ? 'running'
          : normState === 'complete'
          ? 'completed'
          : 'pending',
      message: normState === 'synthesizing' ? stepMessage : undefined,
    },
    {
      id: 'step-complete',
      name: 'Response Verified',
      status: normState === 'complete' ? 'completed' : 'pending',
      message: normState === 'complete' ? stepMessage : undefined,
    },
  ];

  const activeSteps = customSteps && customSteps.length > 0 ? customSteps : defaultSteps;

  const getStateBadgeStyle = () => {
    switch (normState) {
      case 'thinking':
        return 'text-amber-300 bg-amber-950/80 border-amber-600/70 shadow-amber-950/30';
      case 'searching':
        return 'text-sky-300 bg-sky-950/80 border-sky-600/70 shadow-sky-950/30';
      case 'synthesizing':
        return 'text-purple-300 bg-purple-950/80 border-purple-600/70 shadow-purple-950/30';
      case 'complete':
        return 'text-emerald-300 bg-emerald-950/80 border-emerald-600/70 shadow-emerald-950/30';
      case 'error':
        return 'text-rose-300 bg-rose-950/80 border-rose-600/70 shadow-rose-950/30';
      case 'idle':
      default:
        return 'text-slate-300 bg-slate-800/90 border-slate-700';
    }
  };

  const getStateIcon = () => {
    switch (normState) {
      case 'thinking':
        return <Brain className="w-3.5 h-3.5 animate-pulse text-amber-400" />;
      case 'searching':
        return <Search className="w-3.5 h-3.5 animate-pulse text-sky-400" />;
      case 'synthesizing':
        return <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" />;
      case 'complete':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'idle':
      default:
        return <Zap className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getStepStatusIcon = (stepStatus: AgentExecutionStep['status']) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'running':
        return <Cpu className="w-3.5 h-3.5 text-purple-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'pending':
      default:
        return <div className="w-2 h-2 rounded-full bg-slate-600 my-0.5 ml-0.5" />;
    }
  };

  const tokenCount = streamingTokens ? streamingTokens.trim().split(/\s+/).filter(Boolean).length : 0;
  const showBody = !compact && (isExpanded || normState === 'error');

  return (
    <div
      data-testid="agent-runner"
      className={`bg-slate-900 border-b border-slate-800 transition-all ${className}`}
    >
      {/* Top Header / Status Control Bar */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70">
        <div className="flex items-center space-x-2 min-w-0">
          {/* Agent State Badge */}
          <div
            data-testid="agent-status-badge"
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold shadow-xs shrink-0 ${getStateBadgeStyle()}`}
          >
            {getStateIcon()}
            <span data-testid="agent-status-label">{displayLabel}</span>
          </div>

          {/* Active Step Description in Status Rail */}
          {stepMessage && (
            <span
              data-testid="agent-step-message"
              className="truncate font-mono text-xs text-slate-300 max-w-[160px] sm:max-w-[240px]"
              title={stepMessage}
            >
              {stepMessage}
            </span>
          )}

          {/* Elapsed Timer */}
          {elapsedMs > 0 && (
            <div
              data-testid="agent-elapsed-time"
              className="flex items-center space-x-1 text-[11px] font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 shrink-0"
            >
              <Clock className="w-3 h-3 text-slate-400" />
              <span data-testid="agent-elapsed-timer">{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          )}

          {/* Active Chunks Badge */}
          {chunkCount > 0 && (
            <div
              data-testid="agent-chunk-count"
              className="flex items-center space-x-1 text-[11px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-700/60 shrink-0"
            >
              <Layers className="w-3 h-3 text-sky-400" />
              <span data-testid="agent-active-chunks">{chunkCount} chunks</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div data-testid="agent-controls" className="flex items-center space-x-1.5 shrink-0 ml-2">
          {isBusy && onCancel && (
            <button
              onClick={onCancel}
              data-testid="agent-cancel-btn"
              className="flex items-center space-x-1 text-xs text-rose-300 hover:text-white bg-rose-950 hover:bg-rose-900 border border-rose-700 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-xs"
              title="Cancel current query"
            >
              <StopCircle className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}

          {(normState === 'complete' || normState === 'error') && onReset && (
            <button
              onClick={onReset}
              data-testid="agent-reset-btn"
              className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2 py-0.5 rounded transition-colors cursor-pointer shadow-xs"
              title="Reset agent state"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            data-testid="agent-toggle-traces-btn"
            className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer shadow-xs"
            title={isExpanded ? 'Collapse agent traces' : 'Expand agent traces'}
          >
            <span className="text-[11px] font-sans">Traces</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {showBody && (
        <div className="p-3 space-y-2.5 bg-slate-950/40">
          {/* Execution Steps / Traces */}
          <div data-testid="agent-steps-list" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {activeSteps.map((step, idx) => (
              <div
                key={step.id || `step-${idx}`}
                data-testid="agent-step-item"
                data-step-id={step.id || `step-${idx}`}
                className={`flex items-center justify-between p-2 rounded text-xs border transition-colors ${
                  step.status === 'running'
                    ? 'bg-purple-950/60 border-purple-600/70 text-purple-200 shadow-xs'
                    : step.status === 'completed'
                    ? 'bg-slate-900 border-slate-700/80 text-slate-200'
                    : step.status === 'error'
                    ? 'bg-rose-950/60 border-rose-600/70 text-rose-200 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="shrink-0">{getStepStatusIcon(step.status)}</span>
                  <span
                    data-testid={`agent-step-name-${step.id || idx}`}
                    className={`truncate font-medium text-xs ${
                      step.status === 'running'
                        ? 'text-purple-300 font-semibold'
                        : step.status === 'completed'
                        ? 'text-slate-200'
                        : step.status === 'error'
                        ? 'text-rose-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>

                <span
                  data-testid="agent-step-status"
                  className="text-[11px] uppercase font-mono tracking-wider text-slate-400 shrink-0 ml-1 font-semibold"
                >
                  {step.status}
                </span>
              </div>
            ))}
          </div>

          {/* Streaming Tokens Display */}
          {(Boolean(streamingTokens) || normState === 'synthesizing') && (
            <div
              data-testid="agent-streaming-output"
              className="mt-2 p-2.5 rounded bg-slate-950 border border-purple-600/60 text-xs font-mono shadow-xs"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-300">
                <span className="flex items-center space-x-1 text-purple-400 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>WebLLM Token Stream</span>
                </span>
                {tokenCount > 0 && (
                  <span data-testid="agent-token-count" className="text-slate-300 font-mono font-medium">
                    {tokenCount} tokens
                  </span>
                )}
              </div>

              <div
                data-testid="agent-streaming-tokens"
                className="mt-2 text-slate-100 leading-relaxed whitespace-pre-wrap break-words max-h-36 overflow-y-auto"
              >
                {streamingTokens ? (
                  <>
                    {streamingTokens}
                    {isBusy && (
                      <span
                        data-testid="streaming-cursor"
                        className="inline-block w-1.5 h-3.5 ml-0.5 bg-purple-400 animate-pulse align-middle"
                      />
                    )}
                  </>
                ) : (
                  <span
                    data-testid="agent-streaming-placeholder"
                    className="text-slate-400 italic flex items-center space-x-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span>Awaiting initial token from WebLLM SLM engine...</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {normState === 'error' && errorMsg && (
            <div
              data-testid="agent-error-banner"
              className="p-2.5 rounded bg-rose-950/70 border border-rose-600/80 flex items-start space-x-2 text-xs text-rose-200 shadow-xs"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block text-rose-200">ReAct Loop Execution Failed</span>
                <span data-testid="agent-error-message" className="text-rose-200/90 break-words font-mono text-[11px]">
                  {errorMsg}
                </span>
              </div>
            </div>
          )}

          {/* Optional NemoIR Web UI Trace Drawer Integration */}
          {timeline && timeline.length > 0 && (
            <div data-testid="agent-trace-drawer" className="pt-1 border-t border-slate-800">
              <WorkflowTraceDrawer items={timeline} maxHeight="180px" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
