import React, { useState, useEffect } from 'react';
import { Layers, FileText, Code2, GitBranch, Terminal, Info } from 'lucide-react';
import { AstCodeChunk } from '../../types';

export const PYTHON_BUILTINS = new Set([
  'str',
  'int',
  'float',
  'bool',
  'list',
  'dict',
  'set',
  'tuple',
  'len',
  'range',
  'enumerate',
  'zip',
  'map',
  'filter',
  'sorted',
  'isinstance',
  'issubclass',
  'hasattr',
  'getattr',
  'setattr',
  'delattr',
  'open',
  'print',
  'type',
  'id',
  'super',
  'iter',
  'next',
  'min',
  'max',
  'sum',
  'any',
  'all',
  'abs',
  'repr',
  'format',
  'chr',
  'ord',
  'callable',
]);

interface ASTMetadataInspectorProps {
  chunk: AstCodeChunk | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectCall?: (callIdentifier: string) => Promise<boolean | void> | boolean | void;
}

export const ASTMetadataInspector: React.FC<ASTMetadataInspectorProps> = ({
  chunk,
  isOpen,
  onClose,
  onSelectCall,
}) => {
  const [callNotice, setCallNotice] = useState<string | null>(null);

  useEffect(() => {
    setCallNotice(null);
  }, [chunk?.id, isOpen]);

  const handleCallClick = async (call: string) => {
    setCallNotice(null);
    if (!onSelectCall) return;
    const res = await onSelectCall(call);
    if (res === false) {
      setCallNotice(`External entity: '${call}' is not defined locally in this repository.`);
    }
  };

  if (!isOpen || !chunk) return null;

  return (
    <div
      data-testid="ast-metadata-inspector"
      className="border-t border-slate-700 bg-slate-900 p-3.5 max-h-56 overflow-y-auto text-xs font-mono space-y-2.5 shadow-lg"
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center space-x-1.5 text-slate-100 font-semibold">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Code & Symbol Details</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-slate-800 border border-slate-700 cursor-pointer"
        >
          Close
        </button>
      </div>

      {callNotice && (
        <div
          data-testid="external-call-notice"
          className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-amber-950/60 border border-amber-700/60 text-amber-200 text-xs"
        >
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{callNotice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300 pb-2 border-b border-slate-800/80">
        <div>
          <span className="text-slate-400">Node:</span>{' '}
          <span className="text-cyan-300 font-semibold">{chunk.astNodeType}</span>
        </div>
        <div>
          <span className="text-slate-400">Entity:</span>{' '}
          <span className="text-emerald-300 font-semibold">{chunk.identifier}</span>
        </div>
        <div>
          <span className="text-slate-400">Range:</span>{' '}
          <span>Lines {chunk.startLine}–{chunk.endLine} ({chunk.endLine - chunk.startLine + 1} lines)</span>
        </div>
        {chunk.repoFullName && (
          <div>
            <span className="text-slate-400">Repo:</span>{' '}
            <span className="text-sky-300">{chunk.repoFullName}</span>
          </div>
        )}
      </div>

      {chunk.docstring && (
        <div className="pt-1">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <FileText className="w-3 h-3 text-amber-400" />
            <span>Docstring:</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded text-slate-200 border border-slate-700 font-sans text-xs leading-relaxed">
            {chunk.docstring}
          </div>
        </div>
      )}

      {chunk.parameters && chunk.parameters.length > 0 && (
        <div className="pt-1">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <Terminal className="w-3 h-3 text-sky-400" />
            <span>Parameters ({chunk.parameters.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.parameters.map((param, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-700 text-[11px]"
              >
                {param}
              </span>
            ))}
          </div>
        </div>
      )}

      {chunk.decorators && chunk.decorators.length > 0 && (
        <div className="pt-1">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <Code2 className="w-3 h-3 text-pink-400" />
            <span>Decorators:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.decorators.map((dec, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-700/60 text-[11px]"
              >
                {dec}
              </span>
            ))}
          </div>
        </div>
      )}

      {chunk.calls && chunk.calls.length > 0 && (
        <div className="pt-1" data-testid="ast-calls-section">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <GitBranch className="w-3 h-3 text-emerald-400" />
            <span>Called Functions ({chunk.calls.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.calls.map((call, i) => {
              const cleanCall = call.replace(/^self\./, '');
              const isBuiltin = PYTHON_BUILTINS.has(cleanCall);

              if (isBuiltin) {
                return (
                  <span
                    key={i}
                    data-testid={`call-builtin-${call}`}
                    title="Python built-in standard library function"
                    className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-700/60 text-[11px] font-mono inline-flex items-center space-x-1 cursor-default select-none"
                  >
                    <span>{call}</span>
                    <span className="text-[9px] text-slate-500 font-sans tracking-wide">built-in</span>
                  </span>
                );
              }

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleCallClick(call)}
                  data-testid={`call-badge-${call}`}
                  className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-100 border border-emerald-700/60 hover:border-emerald-500 text-[11px] font-mono cursor-pointer transition-colors inline-flex items-center"
                >
                  {call} ↗
                </button>
              );
            })}
          </div>
        </div>
      )}

      {chunk.imports && chunk.imports.length > 0 && (
        <div className="pt-1" data-testid="ast-imports-section">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <Layers className="w-3 h-3 text-sky-400" />
            <span>Imports ({chunk.imports.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.imports.map((imp, i) => (
              <span
                key={i}
                data-testid={`import-badge-${imp}`}
                className="px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-700 text-[11px] font-mono"
              >
                {imp}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
