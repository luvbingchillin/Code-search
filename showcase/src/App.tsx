import React, { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ArchitecturePillars } from './components/ArchitecturePillars';
import { ChunkComparisonVisualizer } from './components/ChunkComparisonVisualizer';
import { CodeRevealTiles } from './components/CodeRevealTiles';
import { ArchitectureFlow } from './components/ArchitectureFlow';
import { TerminalQuickStart } from './components/TerminalQuickStart';
import { Footer } from './components/Footer';

export function App() {
  // Chande Scroll-Velocity Inertia Skew (chande-tilt.js)
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let currentSkew = 0;
    let targetSkew = 0;
    let rafId = 0;

    const handleScroll = () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const dy = window.scrollY - lastScrollY;
      const velocity = dy / dt; // pixels per millisecond

      // Clamp skew to natural tactile range [-3.0deg, +3.0deg]
      targetSkew = Math.max(-3.0, Math.min(3.0, velocity * 1.5));

      lastScrollY = window.scrollY;
      lastTime = now;
    };

    const updateSkew = () => {
      // Natural spring decay back to 0deg
      targetSkew *= 0.86;
      currentSkew += (targetSkew - currentSkew) * 0.22;

      if (Math.abs(currentSkew) > 0.02) {
        document.documentElement.style.setProperty('--scroll-skew', `${currentSkew.toFixed(2)}deg`);
      } else {
        document.documentElement.style.setProperty('--scroll-skew', '0deg');
      }

      rafId = requestAnimationFrame(updateSkew);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    rafId = requestAnimationFrame(updateSkew);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f3eb] text-[#0a1f10] selection:bg-[#68f12b] selection:text-[#0a1f10]">
      <Navbar />
      <main>
        <Hero />
        <ArchitecturePillars />
        <ChunkComparisonVisualizer />
        <CodeRevealTiles />
        <ArchitectureFlow />
        <TerminalQuickStart />
      </main>
      <Footer />
    </div>
  );
}

export default App;
