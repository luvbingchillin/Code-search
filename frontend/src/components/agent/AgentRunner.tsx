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
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Resolve active properties merging explicit props and status object
  const rawState = propState ?? status?.state ?? 'Idle';
  const normState = normalizeAgentState(rawState);
  const displayLabel = getDisplayStateLabel(normState);
  const stepMessage = propMessage ?? status?.currentStepMessage ?? (normState === 'idle' ? 'NemoIR ReAct Agent Ready' : '');
  const elapsedMs = propElapsed ?? status?.elapsedMs ?? 0;
  const chunkCount = propChunks ?? status?.activeChunkCount ?? 0;
  const errorMsg = propError ?? status?.error;

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
        return 'text-amber-400 bg-amber-950/50 border-amber-800/60 shadow-amber-900/20';
      case 'searching':
        return 'text-blue-400 bg-blue-950/50 border-blue-800/60 shadow-blue-900/20';
      case 'synthesizing':
        return 'text-purple-400 bg-purple-950/50 border-purple-800/60 shadow-purple-900/20';
      case 'complete':
        return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60 shadow-emerald-900/20';
      case 'error':
        return 'text-rose-400 bg-rose-950/50 border-rose-800/60 shadow-rose-900/20';
      case 'idle':
      default:
        return 'text-gray-400 bg-gray-900/60 border-gray-800';
    }
  };

  const getStateIcon = () => {
    switch (normState) {
      case 'thinking':
        return <Brain className="w-3.5 h-3.5 animate-pulse text-amber-400" />;
      case 'searching':
        return <Search className="w-3.5 h-3.5 animate-pulse text-blue-400" />;
      case 'synthesizing':
        return <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" />;
      case 'complete':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'idle':
      default:
        return <Zap className="w-3.5 h-3.5 text-gray-400" />;
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
        return <div className="w-2 h-2 rounded-full bg-gray-600 my-0.5 ml-0.5" />;
    }
  };

  const tokenCount = streamingTokens ? streamingTokens.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div
      data-testid="agent-runner"
      className={`bg-gray-900/95 border-b border-gray-800/80 transition-all ${className}`}
    >
      {/* Top Header / Status Control Bar */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-800/40 bg-gray-950/40">
        <div className="flex items-center space-x-2">
          {/* Agent State Badge */}
          <div
            data-testid="agent-status-badge"
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold shadow-xs ${getStateBadgeStyle()}`}
          >
            {getStateIcon()}
            <span data-testid="agent-status-label">{displayLabel}</span>
          </div>

          {/* Elapsed Timer */}
          {elapsedMs > 0 && (
            <div
              data-testid="agent-elapsed-time"
              className="flex items-center space-x-1 text-[11px] font-mono text-gray-400 bg-gray-900/80 px-2 py-0.5 rounded border border-gray-800"
            >
              <Clock className="w-3 h-3 text-gray-500" />
              <span data-testid="agent-elapsed-timer">{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          )}

          {/* Active Chunks Badge */}
          {chunkCount > 0 && (
            <div
              data-testid="agent-chunk-count"
              className="flex items-center space-x-1 text-[11px] font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50"
            >
              <Layers className="w-3 h-3 text-blue-400" />
              <span data-testid="agent-active-chunks">{chunkCount} chunks</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div data-testid="agent-controls" className="flex items-center space-x-1.5">
          {isBusy && onCancel && (
            <button
              onClick={onCancel}
              data-testid="agent-cancel-btn"
              className="flex items-center space-x-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/60 px-2 py-0.5 rounded transition-colors cursor-pointer"
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
              className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-800/40 hover:bg-gray-800 border border-gray-700/50 px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Reset agent state"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            data-testid="agent-toggle-traces-btn"
            className="text-gray-500 hover:text-gray-300 p-0.5 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse agent traces' : 'Expand agent traces'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && !compact && (
        <div className="p-3 space-y-2.5">
          {/* Active Step Description */}
          {stepMessage && (
            <div className="flex items-center space-x-2 text-xs text-gray-300">
              <Terminal className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span data-testid="agent-step-message" className="truncate font-mono text-[11px] text-gray-300">
                {stepMessage}
              </span>
            </div>
          )}

          {/* Execution Steps / Traces */}
          <div data-testid="agent-steps-list" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {activeSteps.map((step, idx) => (
              <div
                key={step.id || `step-${idx}`}
                data-testid="agent-step-item"
                data-step-id={step.id || `step-${idx}`}
                className={`flex items-center justify-between p-1.5 rounded text-xs border transition-colors ${
                  step.status === 'running'
                    ? 'bg-purple-950/30 border-purple-800/60 text-purple-200'
                    : step.status === 'completed'
                    ? 'bg-gray-950/40 border-gray-800/60 text-gray-300'
                    : step.status === 'error'
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    : 'bg-gray-950/20 border-gray-900/60 text-gray-500'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="shrink-0">{getStepStatusIcon(step.status)}</span>
                  <span
                    data-testid={`agent-step-name-${step.id || idx}`}
                    className={`truncate font-medium text-[11px] ${
                      step.status === 'running'
                        ? 'text-purple-300 font-semibold'
                        : step.status === 'completed'
                        ? 'text-gray-200'
                        : step.status === 'error'
                        ? 'text-rose-300'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>

                <span
                  data-testid="agent-step-status"
                  className="text-[10px] uppercase font-mono tracking-wider text-gray-500 shrink-0 ml-1"
                >
                  {step.status}
                </span>
              </div>
            ))}
          </div>

          {/* Streaming Tokens Display */}
          {(streamingTokens !== undefined || normState === 'synthesizing') && (
            <div
              data-testid="agent-streaming-output"
              className="mt-2 p-2.5 rounded bg-gray-950 border border-purple-900/40 text-xs font-mono"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-800 text-[10px] text-gray-400">
                <span className="flex items-center space-x-1 text-purple-400">
                  <Sparkles className="w-3 h-3" />
                  <span>WebLLM Token Stream</span>
                </span>
                {tokenCount > 0 && (
                  <span data-testid="agent-token-count" className="text-gray-500 font-mono">
                    {tokenCount} tokens
                  </span>
                )}
              </div>

              <div
                data-testid="agent-streaming-tokens"
                className="mt-2 text-gray-200 leading-relaxed whitespace-pre-wrap break-words max-h-36 overflow-y-auto"
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
                    className="text-gray-500 italic flex items-center space-x-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
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
              className="p-2.5 rounded bg-rose-950/40 border border-rose-800/80 flex items-start space-x-2 text-xs text-rose-300"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block text-rose-200">ReAct Loop Execution Failed</span>
                <span data-testid="agent-error-message" className="text-rose-300/90 break-words">
                  {errorMsg}
                </span>
              </div>
            </div>
          )}

          {/* Optional NemoIR Web UI Trace Drawer Integration */}
          {timeline && timeline.length > 0 && (
            <div data-testid="agent-trace-drawer" className="pt-1 border-t border-gray-800/50">
              <WorkflowTraceDrawer items={timeline} maxHeight="180px" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
