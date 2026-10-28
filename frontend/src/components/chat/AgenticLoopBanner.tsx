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
      className="p-3 bg-gray-900/90 border-b border-gray-800 flex flex-col space-y-2.5 backdrop-blur-sm"
    >
      {/* Top row: State badge, timer, and cancel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStateColor(status.state)}`}>
            {getStateIcon(status.state)}
            <span data-testid="agentic-state-label">{status.state}</span>
          </div>

          <div
            data-testid="agentic-elapsed-timer"
            className="flex items-center space-x-1 text-xs font-mono text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded border border-gray-700/50"
          >
            <Clock className="w-3 h-3 text-gray-400" />
            <span>{(status.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {isBusy && onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center space-x-1 text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-0.5 rounded hover:bg-rose-950/40 border border-rose-900/40"
          >
            <XSquare className="w-3 h-3" />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Granular Step Description or Error */}
      <div className="text-xs text-gray-300 flex items-start space-x-2">
        <span
          data-testid="agentic-step-description"
          className="line-clamp-2 leading-relaxed"
        >
          {status.error ? (
            <span className="text-rose-300 font-medium">{status.error}</span>
          ) : (
            status.currentStepMessage
          )}
        </span>
      </div>

      {/* Horizontal 4-step Stepper */}
      <div data-testid="agentic-stepper" className="flex items-center justify-between pt-1">
        {STEPS.map((step, idx) => {
          const stepStatus = getStepStatus(step.name);
          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center space-x-1.5">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    stepStatus === 'completed'
                      ? 'bg-emerald-500 text-gray-950'
                      : stepStatus === 'current'
                      ? 'bg-purple-500 text-white ring-2 ring-purple-400/50 animate-pulse'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {stepStatus === 'completed' ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    stepStatus === 'completed'
                      ? 'text-emerald-400'
                      : stepStatus === 'current'
                      ? 'text-purple-300'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded transition-colors ${
                    stepStatus === 'completed' ? 'bg-emerald-500/70' : 'bg-gray-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
