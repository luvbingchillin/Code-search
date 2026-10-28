import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageSquare, Code2, Columns } from 'lucide-react';

interface SplitPaneLayoutProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  isChatMinimized?: boolean;
  onToggleChatMinimized?: () => void;
  isCodeMinimized?: boolean;
  onToggleCodeMinimized?: () => void;
}

export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({
  leftPane,
  rightPane,
  isChatMinimized: propChatMinimized,
  onToggleChatMinimized: propToggleChat,
  isCodeMinimized: propCodeMinimized,
  onToggleCodeMinimized: propToggleCode,
}) => {
  const [internalChatMinimized, setInternalChatMinimized] = useState<boolean>(false);
  const [internalCodeMinimized, setInternalCodeMinimized] = useState<boolean>(false);

  const isChatMinimized = propChatMinimized ?? internalChatMinimized;
  const isCodeMinimized = propCodeMinimized ?? internalCodeMinimized;

  const handleToggleChatMinimized =
    propToggleChat ?? (() => setInternalChatMinimized((prev) => !prev));
  const handleToggleCodeMinimized =
    propToggleCode ?? (() => setInternalCodeMinimized((prev) => !prev));

  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(45);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [mobileTab, setMobileTab] = useState<'chat' | 'code'>('chat');
  const isDraggingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const newPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(25, Math.min(75, newPercent));
      setLeftWidthPercent(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLeftWidthPercent((prev) => Math.max(25, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLeftWidthPercent((prev) => Math.min(75, prev + 5));
    }
  };

  const isBothMinimized = isChatMinimized && isCodeMinimized;

  return (
    <div
      ref={containerRef}
      data-testid="split-pane-layout"
      className="flex-1 w-full h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-950"
    >
      {/* Mobile Tab Switcher (< 768px) */}
      <div className="md:hidden flex bg-slate-900 border-b border-slate-800 text-xs font-mono shrink-0 select-none">
        <button
          onClick={() => {
            setMobileTab('chat');
            if (isChatMinimized) handleToggleChatMinimized();
          }}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 border-b-2 font-medium transition-colors ${
            mobileTab === 'chat' && !isChatMinimized
              ? 'border-indigo-400 text-white bg-slate-950/80'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Conversation</span>
        </button>
        <button
          onClick={() => {
            setMobileTab('code');
            if (isCodeMinimized) handleToggleCodeMinimized();
          }}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 border-b-2 font-medium transition-colors ${
            mobileTab === 'code' && !isCodeMinimized
              ? 'border-indigo-400 text-white bg-slate-950/80'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>AST Code Viewer</span>
        </button>
      </div>

      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Minimized Chat Rail */}
        {isChatMinimized && (
          <aside
            data-testid="restore-chat-rail"
            className="w-10 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 select-none shrink-0 z-20 shadow-md"
          >
            <button
              type="button"
              data-testid="restore-chat-btn"
              onClick={handleToggleChatMinimized}
              className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-xs group"
              title="Restore Chat Pane (Ctrl+B)"
              aria-label="Restore Chat Pane"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div className="mt-8 flex-1 flex items-center justify-center">
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase -rotate-90 whitespace-nowrap select-none pointer-events-none">
                Conversation
              </span>
            </div>
          </aside>
        )}

        {/* Left Chat Pane */}
        <div
          data-testid="chat-pane"
          style={{
            width: isChatMinimized
              ? 0
              : isCodeMinimized
              ? '100%'
              : isDesktop
              ? `${leftWidthPercent}%`
              : '100%',
          }}
          className={`h-full flex flex-col bg-[#0b101d] overflow-hidden border-r border-slate-800 shrink-0 transition-all ${
            isChatMinimized || (!isDesktop && mobileTab !== 'chat') ? 'hidden' : 'flex'
          }`}
        >
          {leftPane}
        </div>

        {/* Resizable Gutter / Divider with Keyboard & ARIA support */}
        {!isChatMinimized && !isCodeMinimized && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(leftWidthPercent)}
            aria-valuemin={25}
            aria-valuemax={75}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            className="w-1.5 bg-slate-800 hover:bg-indigo-500 focus:bg-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors cursor-col-resize hidden md:flex items-center justify-center group select-none shrink-0 z-10"
            title="Drag to resize panes"
            aria-label="Drag to resize panes or use left and right arrow keys"
          >
            <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-indigo-200 rounded-full transition-colors" />
          </div>
        )}

        {/* Both Minimized Focus Mode Canvas State */}
        {isBothMinimized && (
          <div
            data-testid="both-minimized-canvas"
            className="flex-1 h-full flex flex-col items-center justify-center bg-[#070a12] p-6 text-center select-none"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-lg shadow-indigo-950/20">
              <Columns className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1.5">
              Focus Mode: All Panes Minimized
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
              Both the chat conversation and AST code viewer are minimized. Restore either pane to continue exploring your Python codebase.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                data-testid="canvas-restore-chat-btn"
                onClick={handleToggleChatMinimized}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Chat (Ctrl+B)</span>
              </button>
              <button
                type="button"
                data-testid="canvas-restore-code-btn"
                onClick={handleToggleCodeMinimized}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium text-xs shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Open AST Code Viewer</span>
              </button>
            </div>
          </div>
        )}

        {/* Right Code Viewer Pane */}
        <div
          data-testid="code-viewer-pane"
          style={{
            width: isCodeMinimized
              ? 0
              : isChatMinimized
              ? '100%'
              : isDesktop
              ? `${100 - leftWidthPercent}%`
              : '100%',
          }}
          className={`h-full flex-1 flex flex-col bg-[#070a12] overflow-hidden transition-all ${
            isCodeMinimized || (!isDesktop && mobileTab !== 'code') ? 'hidden' : 'flex'
          }`}
        >
          {rightPane}
        </div>

        {/* Right Minimized Code Viewer Rail */}
        {isCodeMinimized && (
          <aside
            data-testid="restore-code-rail"
            className="w-10 bg-slate-900 border-l border-slate-800 flex flex-col items-center py-3 select-none shrink-0 z-20 shadow-md"
          >
            <button
              type="button"
              data-testid="restore-code-btn"
              onClick={handleToggleCodeMinimized}
              className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-xs group"
              title="Restore AST Code Viewer"
              aria-label="Restore AST Code Viewer"
            >
              <Code2 className="w-4 h-4" />
            </button>
            <div className="mt-8 flex-1 flex items-center justify-center">
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase rotate-90 whitespace-nowrap select-none pointer-events-none">
                AST Viewer
              </span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
