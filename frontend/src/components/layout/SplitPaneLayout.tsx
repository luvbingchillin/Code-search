import React, { useState, useRef, useCallback } from 'react';

interface SplitPaneLayoutProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
}

export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({ leftPane, rightPane }) => {
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(45);
  const isDraggingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
      className="flex-1 w-full h-[calc(100vh-3.5rem)] flex flex-col md:flex-row overflow-hidden bg-gray-950"
    >
      {/* Left Chat Pane */}
      <div
        data-testid="chat-pane"
        style={{ width: `${leftWidthPercent}%` }}
        className="h-full flex flex-col bg-gray-950 overflow-hidden border-r border-gray-800 shrink-0"
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
        style={{ width: `${100 - leftWidthPercent}%` }}
        className="h-full flex-1 flex flex-col bg-gray-900 overflow-hidden"
      >
        {rightPane}
      </div>
    </div>
  );
};
