import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ArchitecturePillars } from './components/ArchitecturePillars';
import { ChunkComparisonVisualizer } from './components/ChunkComparisonVisualizer';
import { ArchitectureFlow } from './components/ArchitectureFlow';
import { TerminalQuickStart } from './components/TerminalQuickStart';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div className="min-h-screen bg-[#f4f3eb] text-[#0a1f10] selection:bg-[#68f12b] selection:text-[#0a1f10]">
      <Navbar />
      <main>
        <Hero />
        <ArchitecturePillars />
        <ChunkComparisonVisualizer />
        <ArchitectureFlow />
        <TerminalQuickStart />
      </main>
      <Footer />
    </div>
  );
}

export default App;
