import React, { useState, useEffect, useMemo } from 'react';
import { Layers, GitBranch, Info, ArrowLeft, ArrowDownLeft, GitFork, Box, Package } from 'lucide-react';
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

const formatKind = (chunk: AstCodeChunk): string => {
  const isMethod = Boolean(chunk.identifier && chunk.identifier.includes('.'));
  switch (chunk.astNodeType) {
    case 'FunctionDef':
      return isMethod ? 'method' : 'fn';
    case 'AsyncFunctionDef':
      return isMethod ? 'async method' : 'async fn';
    case 'ClassDef':
      return 'class';
    case 'Module':
      return 'module';
    case 'Assign':
      return 'var';
    default:
      return String(chunk.astNodeType).replace(/Def$/, '').toLowerCase();
  }
};

function escapeRegExp(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function partitionImports(
  imports: string[],
  chunk: AstCodeChunk
): { usedImports: string[]; unusedFileImports: string[] } {
  const searchCorpus = [
    chunk.code || '',
    ...(chunk.parameters || []),
    ...(chunk.decorators || []),
    ...(chunk.bases || []),
  ].join('\n');

  const usedImports: string[] = [];
  const unusedFileImports: string[] = [];

  for (const imp of imports) {
    const clean = imp.replace(/^import\s+/, '').trim().replace(/^\.+/, '');
    if (!clean) continue;
    const parts = clean.split('.').filter(Boolean);
    const leaf = parts[parts.length - 1] || clean;
    const root = parts[0] || clean;
    const isUsed =
      new RegExp(`\\b${escapeRegExp(clean)}\\b`).test(searchCorpus) ||
      new RegExp(`\\b${escapeRegExp(leaf)}\\b`).test(searchCorpus) ||
      new RegExp(`\\b${escapeRegExp(root)}\\b`).test(searchCorpus);

    if (isUsed) {
      usedImports.push(imp);
    } else {
      unusedFileImports.push(imp);
    }
  }
  return { usedImports, unusedFileImports };
}

export interface CallerReference {
  id: string;
  identifier: string;
  filePath?: string;
  startLine?: number;
}

export interface ClassMethodReference {
  id: string;
  identifier: string;
  astNodeType: string;
  startLine: number;
}

interface ASTMetadataInspectorProps {
  chunk: AstCodeChunk | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectCall?: (callIdentifier: string) => Promise<boolean | void> | boolean | void;
  callers?: CallerReference[];
  onSelectCaller?: (callerId: string, identifier: string) => void;
  classMethods?: ClassMethodReference[];
  subclasses?: CallerReference[];
  localCallIdentifiers?: Set<string>;
  canGoBack?: boolean;
  onGoBack?: () => void;
}

export const ASTMetadataInspector: React.FC<ASTMetadataInspectorProps> = ({
  chunk,
  isOpen,
  onClose,
  onSelectCall,
  callers = [],
  onSelectCaller,
  classMethods = [],
  subclasses = [],
  localCallIdentifiers,
  canGoBack = false,
  onGoBack,
}) => {
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const [showAllFileImports, setShowAllFileImports] = useState<boolean>(false);

  useEffect(() => {
    setCallNotice(null);
    setShowAllFileImports(false);
  }, [chunk?.id, isOpen]);

  const { usedImports, unusedFileImports } = useMemo(() => {
    if (!chunk || !chunk.imports || chunk.imports.length === 0) {
      return { usedImports: [], unusedFileImports: [] };
    }
    return partitionImports(chunk.imports, chunk);
  }, [chunk]);

  const sortedCalls = useMemo(() => {
    const raw = chunk?.calls || [];
    if (raw.length === 0) return [];
    const isLocalCall = (rawCall: string) => {
      if (!localCallIdentifiers || localCallIdentifiers.size === 0) return true;
      const clean = rawCall.replace(/^self\./, '').trim();
      const base = clean.split('.').pop() || clean;
      return (
        localCallIdentifiers.has(rawCall) ||
        localCallIdentifiers.has(clean) ||
        localCallIdentifiers.has(base)
      );
    };
    const localNonBuiltin: string[] = [];
    const extNonBuiltin: string[] = [];
    const builtins: string[] = [];
    for (const c of raw) {
      const clean = c.replace(/^self\./, '');
      if (PYTHON_BUILTINS.has(clean)) {
        builtins.push(c);
      } else if (isLocalCall(c)) {
        localNonBuiltin.push(c);
      } else {
        extNonBuiltin.push(c);
      }
    }
    return [
      ...localNonBuiltin.map((name) => ({ name, kind: 'local' as const })),
      ...extNonBuiltin.map((name) => ({ name, kind: 'external' as const })),
      ...builtins.map((name) => ({ name, kind: 'builtin' as const })),
    ];
  }, [chunk?.calls, localCallIdentifiers]);

  const handleCallClick = async (call: string) => {
    setCallNotice(null);
    if (!onSelectCall) return;
    const res = await onSelectCall(call);
    if (res === false) {
      setCallNotice(`External symbol '${call}' is not defined in this repository.`);
    }
  };

  if (!isOpen || !chunk) return null;

  const displayedImports =
    usedImports.length > 0
      ? showAllFileImports
        ? [...usedImports, ...unusedFileImports]
        : usedImports
      : unusedFileImports;

  const hasRelationships =
    callers.length > 0 ||
    sortedCalls.length > 0 ||
    (chunk.bases && chunk.bases.length > 0) ||
    subclasses.length > 0 ||
    classMethods.length > 0;

  return (
    <div
      data-testid="ast-metadata-inspector"
      className="border-t border-slate-700 bg-slate-900 p-3.5 max-h-60 overflow-y-auto text-xs font-mono space-y-2.5 shadow-lg"
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-slate-100 font-semibold">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Calls &amp; References</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[10px]">
            {formatKind(chunk)}
          </span>
          <span className="text-emerald-300 text-[11px] truncate max-w-[200px]">
            {chunk.identifier}
          </span>
          <span className="text-slate-400 text-[10px] font-normal hidden sm:inline">
            L{chunk.startLine}–{chunk.endLine}
          </span>
          {canGoBack && onGoBack && (
            <button
              type="button"
              data-testid="ast-nav-back-btn"
              onClick={onGoBack}
              className="ml-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700 text-[11px] font-mono cursor-pointer transition-colors"
              title="Return to previous definition"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
          )}
        </div>
        <button
          type="button"
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

      {/* Class Inheritance: Bases */}
      {chunk.bases && chunk.bases.length > 0 && (
        <div className="pt-0.5" data-testid="ast-bases-section">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <GitFork className="w-3 h-3 text-violet-400" />
            <span>Inherits ({chunk.bases.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunk.bases.map((baseName, i) => (
              <button
                key={`${baseName}-${i}`}
                type="button"
                data-testid={`base-badge-${baseName}`}
                onClick={() => handleCallClick(baseName)}
                className="px-2 py-0.5 rounded bg-violet-950/80 hover:bg-violet-900 text-violet-200 border border-violet-700/60 hover:border-violet-400 text-[11px] font-mono cursor-pointer transition-colors"
                title={`Jump to base class ${baseName}`}
              >
                {baseName} ↗
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subclasses */}
      {subclasses.length > 0 && (
        <div className="pt-0.5" data-testid="ast-subclasses-section">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <GitFork className="w-3 h-3 text-indigo-400" />
            <span>Subclasses ({subclasses.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {subclasses.map((sub, i) => (
              <button
                key={`${sub.id}-${i}`}
                type="button"
                data-testid={`subclass-badge-${sub.identifier}`}
                onClick={() => onSelectCaller?.(sub.id, sub.identifier)}
                className="px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 hover:border-indigo-400 text-[11px] font-mono cursor-pointer transition-colors"
              >
                ↙ {sub.identifier}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Class Methods Jump List */}
      {chunk.astNodeType === 'ClassDef' && classMethods.length > 0 && (
        <div className="pt-0.5" data-testid="ast-methods-section">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <Box className="w-3 h-3 text-sky-400" />
            <span>Methods ({classMethods.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {classMethods.map((m) => {
              const shortName = m.identifier.includes('.')
                ? m.identifier.split('.').slice(1).join('.')
                : m.identifier;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`class-method-badge-${m.identifier}`}
                  onClick={() => onSelectCaller?.(m.id, m.identifier)}
                  className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-sky-300 border border-slate-700 hover:border-sky-500 text-[11px] font-mono cursor-pointer transition-colors"
                  title={`${m.identifier} (Line ${m.startLine})`}
                >
                  {shortName}()
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming Callers */}
      <div className="pt-0.5" data-testid="ast-callers-section">
        <div className="text-slate-400 flex items-center space-x-1 mb-1">
          <ArrowDownLeft className="w-3 h-3 text-sky-400" />
          <span>Called By ({callers.length}):</span>
        </div>
        {callers.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {callers.map((caller, i) => (
              <button
                key={`${caller.id}-${i}`}
                type="button"
                onClick={() => onSelectCaller?.(caller.id, caller.identifier)}
                data-testid={`caller-badge-${caller.identifier}`}
                title={
                  caller.filePath
                    ? `${caller.identifier} (${caller.filePath}${caller.startLine ? `:${caller.startLine}` : ''})`
                    : caller.identifier
                }
                className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-900 text-sky-300 hover:text-sky-100 border border-sky-700/60 hover:border-sky-500 text-[11px] font-mono cursor-pointer transition-colors inline-flex items-center"
              >
                ↙ {caller.identifier}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic">
            {hasRelationships
              ? 'Entrypoint / no internal repo callers indexed'
              : 'No internal repo callers indexed'}
          </div>
        )}
      </div>

      {/* Outgoing Calls (Local prioritized over External & Built-ins) */}
      {sortedCalls.length > 0 && (
        <div className="pt-0.5" data-testid="ast-calls-section">
          <div className="text-slate-400 flex items-center space-x-1 mb-1">
            <GitBranch className="w-3 h-3 text-emerald-400" />
            <span>Calls ({sortedCalls.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {sortedCalls.map(({ name: call, kind }, i) => {
              if (kind === 'builtin') {
                return (
                  <span
                    key={`${call}-${i}`}
                    data-testid={`call-builtin-${call}`}
                    title="Python built-in function"
                    className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-700/60 text-[11px] font-mono inline-flex items-center space-x-1 cursor-default select-none"
                  >
                    <span>{call}</span>
                    <span className="text-[9px] text-slate-500 font-sans tracking-wide">built-in</span>
                  </span>
                );
              }

              const isLocal = kind === 'local';
              return (
                <button
                  key={`${call}-${i}`}
                  type="button"
                  onClick={() => handleCallClick(call)}
                  data-testid={`call-badge-${call}`}
                  title={isLocal ? `Jump to local definition '${call}'` : `Lookup '${call}'`}
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono cursor-pointer transition-colors inline-flex items-center ${
                    isLocal
                      ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-100 border-emerald-700/60 hover:border-emerald-500'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {call} ↗
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Used Imports (or File Imports when none appear in body) */}
      {displayedImports.length > 0 && (
        <div className="pt-0.5" data-testid="ast-imports-section">
          <div className="flex items-center justify-between mb-1">
            <div className="text-slate-400 flex items-center space-x-1">
              <Package className="w-3 h-3 text-sky-400" />
              <span>
                {usedImports.length > 0
                  ? `Used Imports (${usedImports.length}):`
                  : `File Imports (${unusedFileImports.length}):`}
              </span>
              {usedImports.length === 0 && (
                <span className="text-[10px] text-slate-500 italic ml-1">
                  (module-level)
                </span>
              )}
            </div>
            {usedImports.length > 0 && unusedFileImports.length > 0 && (
              <button
                type="button"
                data-testid="toggle-unused-imports-btn"
                onClick={() => setShowAllFileImports((prev) => !prev)}
                className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
              >
                {showAllFileImports
                  ? 'Hide unused file imports'
                  : `+${unusedFileImports.length} unused in file`}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {displayedImports.map((imp, i) => {
              const isUsed = usedImports.includes(imp);
              return (
                <span
                  key={`${imp}-${i}`}
                  data-testid={`import-badge-${imp}`}
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono ${
                    isUsed
                      ? 'bg-slate-950 text-sky-300 border-slate-700'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800'
                  }`}
                >
                  {imp}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
