import React, { useEffect, useRef, useState, useId } from 'react';

interface TrackingEyeProps {
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TrackingEye: React.FC<TrackingEyeProps> = ({
  label = 'Cloud LLMs are watching',
  sublabel = 'Zero bytes leave your machine',
  size = 'md',
  className = ''
}) => {
  const clipId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const pupilRef = useRef<SVGCircleElement>(null);
  const lidRef = useRef<SVGGElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  // SVG Coordinate Constants from chande-eye.js
  const W = 70;
  const H = 42;
  const CX = 34.2;
  const CY = 21.1;
  const RX = 28.9;
  const RY = 15.3;
  const PR = 12.4;
  const ALMOND = `M${CX - RX} ${CY} Q${CX} ${CY - 2 * RY} ${CX + RX} ${CY} Q${CX} ${CY + 2 * RY} ${CX - RX} ${CY} Z`;
  const DX = RX * 0.42;

  useEffect(() => {
    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    let isIdle = false;
    let idleTimer: NodeJS.Timeout;
    let idleLoopTimer: NodeJS.Timeout;

    // Opening animation on mount (spring bounce from scaleY(0.04) to scaleY(1))
    if (lidRef.current && typeof lidRef.current.animate === 'function') {
      lidRef.current.animate(
        [
          { transform: 'scaleY(0.04)', opacity: 0 },
          { transform: 'scaleY(0.04)', opacity: 1, offset: 0.15 },
          { transform: 'scaleY(1.08)', offset: 0.7 },
          { transform: 'scaleY(1)', opacity: 1 }
        ],
        { duration: 700, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }
      );
    }

    // Step animation loop with lerp (damping factor 0.18)
    const updatePupil = () => {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;

      if (pupilRef.current) {
        pupilRef.current.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
      }

      rafId = requestAnimationFrame(updatePupil);
    };
    rafId = requestAnimationFrame(updatePupil);

    // Idle Glancing Loop (looks left -> right -> center if no mouse movement for 2.5s)
    const runIdleCycle = () => {
      if (!isIdle) return;
      targetX = -DX;
      targetY = -1.5;

      idleLoopTimer = setTimeout(() => {
        if (!isIdle) return;
        targetX = DX;
        targetY = 1;

        idleLoopTimer = setTimeout(() => {
          if (!isIdle) return;
          targetX = 0;
          targetY = 0;

          idleLoopTimer = setTimeout(runIdleCycle, 1200);
        }, 750);
      }, 700);
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      clearTimeout(idleLoopTimer);
      isIdle = false;
      idleTimer = setTimeout(() => {
        isIdle = true;
        runIdleCycle();
      }, 2500);
    };

    const handlePointerMove = (e: MouseEvent) => {
      resetIdleTimer();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const eyeCenterX = rect.left + (CX / W) * rect.width;
      const eyeCenterY = rect.top + (CY / H) * rect.height;

      const vx = e.clientX - eyeCenterX;
      const vy = e.clientY - eyeCenterY;
      const dist = Math.hypot(vx, vy) || 1;

      // Distance dampening within 35% of innerWidth
      const damp = Math.min(1, dist / (window.innerWidth * 0.35));
      targetX = (vx / dist) * damp * DX;
      targetY = (vy / dist) * damp * RY * 0.35;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    resetIdleTimer();

    // Autonomous Blinking (every 2.5 to 5.5s)
    let blinkTimeout: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        // 25% chance of double-blink
        if (Math.random() < 0.25) {
          setTimeout(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 200);
          }, 150);
        }
      }, 220);

      const nextInterval = 2500 + Math.random() * 3000;
      blinkTimeout = setTimeout(triggerBlink, nextInterval);
    };
    blinkTimeout = setTimeout(triggerBlink, 3000);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafId);
      clearTimeout(idleTimer);
      clearTimeout(idleLoopTimer);
      clearTimeout(blinkTimeout);
    };
  }, []);

  // Sizing variants
  const sizeClasses = {
    sm: 'w-16 h-10',
    md: 'w-24 h-14',
    lg: 'w-32 h-20'
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`inline-flex items-center space-x-3.5 p-3 rounded-2xl bg-[#06150b] border border-[#68f12b]/30 shadow-lg ${className}`}
    >
      {/* Eye Graphic Container */}
      <div className={`relative ${sizeClasses[size]} flex-shrink-0 cursor-crosshair`}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={`eyeclip-${clipId}`}>
              <path d={ALMOND} />
            </clipPath>
          </defs>

          {/* Eyelid Group with scaling transform origin */}
          <g
            ref={lidRef}
            className={`transition-transform duration-150 ${isBlinking || isHovered ? 'scale-y-[0.05]' : 'scale-y-100'}`}
            style={{
              transformBox: 'view-box',
              transformOrigin: `${CX}px ${CY}px`
            }}
          >
            {/* Sclera (Almond White/Cream) */}
            <path d={ALMOND} fill="#f8e7bf" stroke="#dad0a7" strokeWidth="0.6" />

            {/* Masked Pupil */}
            <g clipPath={`url(#eyeclip-${clipId})`}>
              {/* Pupil Circle */}
              <circle
                ref={pupilRef}
                cx={CX}
                cy={CY}
                r={PR}
                fill="#0a1f10"
                className="transition-none"
              />
              {/* Electric Iris Ring */}
              <circle
                cx={CX}
                cy={CY}
                r={PR * 0.75}
                fill="none"
                stroke="#68f12b"
                strokeWidth="1.2"
                opacity="0.75"
                style={{
                  transform: pupilRef.current?.style.transform
                }}
              />
              {/* Specular Glint */}
              <circle
                cx={CX - 3}
                cy={CY - 3}
                r={2.5}
                fill="#ffffff"
                opacity="0.9"
                style={{
                  transform: pupilRef.current?.style.transform
                }}
              />
            </g>
          </g>
        </svg>

        {/* Live Tracking Ring Pulse */}
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      </div>

      {/* Narrative Telemetry Label */}
      <div className="flex flex-col text-left">
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">
            {label}
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#dad0a7]/80">
          {sublabel}
        </span>
      </div>
    </div>
  );
};
