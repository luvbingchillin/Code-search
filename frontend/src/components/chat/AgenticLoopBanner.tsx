import React from 'react';
import { Brain, Search, Cpu, CheckCircle, AlertTriangle, Clock, XSquare, PanelLeftClose } from 'lucide-react';
import { AgentStatus, ReActState } from '../../types';

interface AgenticLoopBannerProps {
  status: AgentStatus;
  onCancel?: () => void;
  onMinimize?: () => void;
}

interface StepItem {
  id: string;
  name: ReActState | 'Input';
  label: string;
}

const STEPS: StepItem[] = [
  { id: 'step-1', name: 'Input', label: 'Query' },
  { id: 'step-2', name: 'Thinking', label: 'Thinking' },
  { id: 'step-3', name: 'Searching AST', label: 'AST Search' },
  { id: 'step-4', name: 'Synthesizing', label: 'Synthesizing' },
];

export const AgenticLoopBanner: React.FC<AgenticLoopBannerProps> = ({ status, onCancel, onMinimize }) => {
  const getStepStatus = (stepName: StepItem['name']): 'upcoming' | 'current' | 'completed' => {
    if (status.state === 'Error') {
      return 'upcoming';
    }

    const order: Array<ReActState | 'Input'> = [
      'Input',
      'Thinking',
      'Searching AST',
      'Synthesizing',
      'Complete',
    ];
    const currentIndex = order.indexOf(status.state);
    const stepIndex = order.indexOf(stepName);

    if (status.state === 'Complete') {
      return 'completed';
    }
    if (stepIndex < currentIndex) {
      return 'completed';
    }
    if (stepIndex === currentIndex) {
      return 'current';
    }
    return 'upcoming';
  };

  const getStateColor = (state: ReActState) => {
    switch (state) {
      case 'Thinking':
        return 'text-amber-300 bg-amber-950/80 border-amber-600/70 shadow-amber-950/30';
      case 'Searching AST':
        return 'text-sky-300 bg-sky-950/80 border-sky-600/70 shadow-sky-950/30';
      case 'Synthesizing':
        return 'text-purple-300 bg-purple-950/80 border-purple-600/70 shadow-purple-950/30';
      case 'Complete':
        return 'text-emerald-300 bg-emerald-950/80 border-emerald-600/70 shadow-emerald-950/30';
      case 'Error':
        return 'text-rose-300 bg-rose-950/80 border-rose-600/70 shadow-rose-950/30';
      case 'Idle':
      default:
        return 'text-slate-300 bg-slate-800/90 border-slate-700';
    }
  };

  const getStateIcon = (state: ReActState) => {
    switch (state) {
      case 'Thinking':
        return <Brain className="w-4 h-4 animate-pulse text-amber-400" />;
      case 'Searching AST':
        return <Search className="w-4 h-4 animate-pulse text-sky-400" />;
      case 'Synthesizing':
        return <Cpu className="w-4 h-4 animate-spin text-purple-400" />;
      case 'Complete':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'Error':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'Idle':
      default:
        return <div className="w-2 h-2 rounded-full bg-slate-400" />;
    }
  };

  const isBusy = status.state === 'Thinking' || status.state === 'Searching AST' || status.state === 'Synthesizing';

  return (
    <div
      data-testid="agentic-loop-banner"
      className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-y-1.5 text-xs select-none shrink-0"
    >
      {/* Left: State Badge & Step Description */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold shrink-0 shadow-xs ${getStateColor(status.state)}`}>
          {getStateIcon(status.state)}
          <span data-testid="agentic-state-label">{status.state}</span>
        </div>

        <span
          data-testid="agentic-step-description"
          className="text-slate-200 font-mono text-xs truncate max-w-[200px] sm:max-w-[320px] leading-tight"
          title={status.error || status.currentStepMessage}
        >
          {status.error ? (
            <span className="text-rose-300 font-semibold">{status.error}</span>
          ) : (
            status.currentStepMessage
          )}
        </span>
      </div>

      {/* Right: Stepper, Timer, Cancel */}
      <div className="flex items-center space-x-3 shrink-0 ml-auto">
        {/* Horizontal 4-step Mini Stepper */}
        <div data-testid="agentic-stepper" className="hidden lg:flex items-center space-x-2">
          {STEPS.map((step, idx) => {
            const stepStatus = getStepStatus(step.name);
            return (
              <div key={step.id} className="flex items-center space-x-1 text-[11px]">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold text-[11px] ${
                    stepStatus === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/70'
                      : stepStatus === 'current'
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {stepStatus === 'completed' ? '✓' : idx + 1}
                </span>
                <span
                  className={`font-medium ${
                    stepStatus === 'completed'
                      ? 'text-emerald-300 font-medium'
                      : stepStatus === 'current'
                      ? 'text-indigo-300 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <span className="text-slate-600 select-none">→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Elapsed Timer */}
        {status.elapsedMs > 0 && (
          <div
            data-testid="agentic-elapsed-timer"
            className="flex items-center space-x-1 text-[11px] font-mono text-slate-200 bg-slate-950 px-2 py-0.5 rounded border border-slate-700"
          >
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{(status.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        )}

        {/* Cancel Action */}
        {isBusy && onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center space-x-1 text-[11px] font-semibold text-rose-300 hover:text-white transition-colors px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-700 cursor-pointer shadow-xs"
            title="Cancel current query"
          >
            <XSquare className="w-3.5 h-3.5 text-rose-400" />
            <span>Cancel</span>
          </button>
        )}

        {/* Minimize Chat Pane Action */}
        {onMinimize && (
          <button
            type="button"
            data-testid="minimize-chat-btn"
            onClick={onMinimize}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-700"
            title="Minimize chat pane (Ctrl+B)"
            aria-label="Minimize chat pane"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
