import React, { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { AstCodeChunk } from '../../types';

interface CodeDisplayProps {
  chunk: AstCodeChunk | null;
}

export const CodeDisplay: React.FC<CodeDisplayProps> = ({ chunk }) => {
  if (!chunk) {
    return (
      <div
        data-testid="code-display"
        className="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono"
      >
        No AST code chunk selected.
      </div>
    );
  }

  const lines = useMemo(() => {
    return chunk.code.split('\n');
  }, [chunk.code]);

  const highlightedHtml = useMemo(() => {
    try {
      if (Prism.languages.python) {
        return Prism.highlight(chunk.code, Prism.languages.python, 'python');
      }
      return chunk.code;
    } catch (err) {
      console.error('Prism Python highlighting error:', err);
      return chunk.code;
    }
  }, [chunk.code]);

  return (
    <div
      data-testid="code-display"
      className="flex-1 overflow-auto bg-gray-950 font-mono text-xs sm:text-sm leading-6 flex"
    >
      {/* Aligned Line Numbers Gutter */}
      <div
        data-testid="code-line-numbers"
        className="select-none py-3 px-3.5 text-right text-gray-400 bg-gray-950/90 border-r border-gray-800/80 sticky left-0 z-10 shrink-0 font-mono"
      >
        {lines.map((_, index) => {
          const lineNumber = chunk.startLine + index;
          return (
            <div key={index} data-testid="line-number" className="h-6">
              {lineNumber}
            </div>
          );
        })}
      </div>

      {/* Synchronized Code Content Area */}
      <div className="py-3 px-4 flex-1 overflow-x-auto">
        <pre className="language-python !bg-transparent !p-0 !m-0 font-mono">
          <code
            className="language-python"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
};
