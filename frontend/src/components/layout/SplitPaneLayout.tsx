import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageSquare, Code2 } from 'lucide-react';

interface SplitPaneLayoutProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
}

export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({ leftPane, rightPane }) => {
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

  return (
    <div
      ref={containerRef}
      data-testid="split-pane-layout"
      className="flex-1 w-full h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-gray-950"
    >
      {/* Mobile Tab Switcher (< 768px) */}
      <div className="md:hidden flex bg-gray-900 border-b border-gray-800 text-xs font-mono shrink-0 select-none">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 border-b-2 font-medium transition-colors ${
            mobileTab === 'chat'
              ? 'border-indigo-500 text-white bg-gray-950/60'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Conversation</span>
        </button>
        <button
          onClick={() => setMobileTab('code')}
          className={`flex-1 py-2 flex items-center justify-center space-x-1.5 border-b-2 font-medium transition-colors ${
            mobileTab === 'code'
              ? 'border-indigo-500 text-white bg-gray-950/60'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>AST Code Viewer</span>
        </button>
      </div>

      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left Chat Pane */}
        <div
          data-testid="chat-pane"
          style={{ width: isDesktop ? `${leftWidthPercent}%` : '100%' }}
          className={`h-full flex flex-col bg-gray-950 overflow-hidden border-r border-gray-800 shrink-0 ${
            !isDesktop && mobileTab !== 'chat' ? 'hidden' : 'flex'
          }`}
        >
          {leftPane}
        </div>

        {/* Resizable Gutter / Divider with Keyboard & ARIA support */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(leftWidthPercent)}
          aria-valuemin={25}
          aria-valuemax={75}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          className="w-1.5 bg-gray-800 hover:bg-indigo-600 focus:bg-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors cursor-col-resize hidden md:flex items-center justify-center group select-none shrink-0"
          title="Drag to resize panes"
          aria-label="Drag to resize panes or use left and right arrow keys"
        >
          <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-indigo-300 rounded-full transition-colors" />
        </div>

        {/* Right Code Viewer Pane */}
        <div
          data-testid="code-viewer-pane"
          style={{ width: isDesktop ? `${100 - leftWidthPercent}%` : '100%' }}
          className={`h-full flex-1 flex flex-col bg-gray-900 overflow-hidden ${
            !isDesktop && mobileTab !== 'code' ? 'hidden' : 'flex'
          }`}
        >
          {rightPane}
        </div>
      </div>
    </div>
  );
};
