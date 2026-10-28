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
    <div className="min-h-screen bg-[#04140d] text-[#f4f7f4] selection:bg-[#d97706]/30 selection:text-[#fefce8]">
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
