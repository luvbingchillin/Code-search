import React from 'react';
import { Brain, Search, Cpu, CheckCircle, AlertTriangle, Clock, XSquare } from 'lucide-react';
import { AgentStatus, ReActState } from '../../types';

interface AgenticLoopBannerProps {
  status: AgentStatus;
  onCancel?: () => void;
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

export const AgenticLoopBanner: React.FC<AgenticLoopBannerProps> = ({ status, onCancel }) => {
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
        return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
      case 'Searching AST':
        return 'text-blue-400 bg-blue-950/60 border-blue-800/60';
      case 'Synthesizing':
        return 'text-purple-400 bg-purple-950/60 border-purple-800/60';
      case 'Complete':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
      case 'Error':
        return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      case 'Idle':
      default:
        return 'text-gray-400 bg-gray-900/60 border-gray-800';
    }
  };

  const getStateIcon = (state: ReActState) => {
    switch (state) {
      case 'Thinking':
        return <Brain className="w-4 h-4 animate-pulse text-amber-400" />;
      case 'Searching AST':
        return <Search className="w-4 h-4 animate-pulse text-blue-400" />;
      case 'Synthesizing':
        return <Cpu className="w-4 h-4 animate-spin text-purple-400" />;
      case 'Complete':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'Error':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'Idle':
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500" />;
    }
  };

  const isBusy = status.state === 'Thinking' || status.state === 'Searching AST' || status.state === 'Synthesizing';

  return (
    <div
      data-testid="agentic-loop-banner"
      className="px-3 py-2 bg-gray-900/95 border-b border-gray-800 flex flex-wrap items-center justify-between gap-y-1.5 text-xs backdrop-blur-sm select-none shrink-0"
    >
      {/* Left: State Badge & Step Description */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold shrink-0 shadow-xs ${getStateColor(status.state)}`}>
          {getStateIcon(status.state)}
          <span data-testid="agentic-state-label">{status.state}</span>
        </div>

        <span
          data-testid="agentic-step-description"
          className="text-gray-300 font-mono text-xs truncate max-w-[200px] sm:max-w-[320px] leading-tight"
          title={status.error || status.currentStepMessage}
        >
          {status.error ? (
            <span className="text-rose-300 font-medium">{status.error}</span>
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
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono font-bold text-[11px] ${
                    stepStatus === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : stepStatus === 'current'
                      ? 'bg-purple-500 text-white shadow-xs shadow-purple-500/50'
                      : 'bg-gray-800 text-gray-400 border border-gray-700/60'
                  }`}
                >
                  {stepStatus === 'completed' ? '✓' : idx + 1}
                </span>
                <span
                  className={`font-medium ${
                    stepStatus === 'completed'
                      ? 'text-emerald-400'
                      : stepStatus === 'current'
                      ? 'text-purple-300 font-semibold'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <span className="text-gray-600 select-none">→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Elapsed Timer */}
        {status.elapsedMs > 0 && (
          <div
            data-testid="agentic-elapsed-timer"
            className="flex items-center space-x-1 text-[11px] font-mono text-gray-300 bg-gray-950 px-2 py-0.5 rounded border border-gray-800"
          >
            <Clock className="w-3 h-3 text-gray-400" />
            <span>{(status.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        )}

        {/* Cancel Action */}
        {isBusy && onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center space-x-1 text-[11px] font-medium text-rose-300 hover:text-rose-200 transition-colors px-2 py-0.5 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 cursor-pointer"
            title="Cancel current query"
          >
            <XSquare className="w-3 h-3" />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};
