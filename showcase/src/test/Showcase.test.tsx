import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';
import { GITHUB_REPO_URL } from '../components/Navbar';

describe('Showcase Application Test Suite', () => {
  it('renders the navbar with GitHub repository link and branding', () => {
    render(<App />);

    const brandLogos = screen.getAllByText(/CODE-SEARCH/i);
    expect(brandLogos.length).toBeGreaterThan(0);

    const githubNavLink = screen.getByTestId('github-nav-link');
    expect(githubNavLink).toBeInTheDocument();
    expect(githubNavLink).toHaveAttribute('href', GITHUB_REPO_URL);
    expect(githubNavLink).toHaveAttribute('target', '_blank');
    expect(githubNavLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the Hero section with primary GitHub CTA and clone snippet', () => {
    render(<App />);

    expect(screen.getByText(/Stop Gambling on/i)).toBeInTheDocument();
    expect(screen.getByText(/Fragmented Codebases/i)).toBeInTheDocument();

    const heroCta = screen.getByTestId('github-hero-cta');
    expect(heroCta).toBeInTheDocument();
    expect(heroCta).toHaveAttribute('href', GITHUB_REPO_URL);
    expect(heroCta).toHaveAttribute('target', '_blank');

    const copyBtn = screen.getByTestId('copy-clone-btn');
    expect(copyBtn).toBeInTheDocument();
  });

  it('renders all four architectural pillars with technical summaries', () => {
    render(<App />);

    const pillar1 = screen.getByTestId('pillar-card-01');
    expect(pillar1).toBeInTheDocument();
    expect(within(pillar1).getByText(/100% Edge-Computed Privacy/i)).toBeInTheDocument();

    const pillar2 = screen.getByTestId('pillar-card-02');
    expect(pillar2).toBeInTheDocument();
    expect(within(pillar2).getByText(/Structural AST Ingestion Engine/i)).toBeInTheDocument();

    const pillar3 = screen.getByTestId('pillar-card-03');
    expect(pillar3).toBeInTheDocument();
    expect(within(pillar3).getByText(/Autonomous Multi-Hop Graph Traversal/i)).toBeInTheDocument();

    const pillar4 = screen.getByTestId('pillar-card-04');
    expect(pillar4).toBeInTheDocument();
    expect(within(pillar4).getByText(/Deterministic Wasm Agentic Loop/i)).toBeInTheDocument();
  });

  it('renders the AST vs Naive Chunking Visualizer with side-by-side comparison', () => {
    render(<App />);

    const naivePanel = screen.getByTestId('naive-chunk-panel');
    expect(naivePanel).toBeInTheDocument();
    expect(screen.getAllByText(/The Naive Chunker's Gamble/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/SBIR: 0.67%/i)).toBeInTheDocument();

    const astPanel = screen.getByTestId('ast-chunk-panel');
    expect(astPanel).toBeInTheDocument();
    expect(screen.getByText(/Tree-Sitter AST Determinism/i)).toBeInTheDocument();
    expect(screen.getByText(/SBIR: 100.0%/i)).toBeInTheDocument();
  });

  it('renders the Edge Developer Workspace preview showing the ReAct loop', () => {
    render(<App />);

    expect(screen.getByText(/ReAct Agent State Loop/i)).toBeInTheDocument();
    expect(screen.getByText(/01\. Thinking/i)).toBeInTheDocument();
    expect(screen.getByText(/02\. Searching AST/i)).toBeInTheDocument();
    expect(screen.getByText(/03\. Explaining/i)).toBeInTheDocument();
  });

  it('renders the pipeline flow and quickstart commands', () => {
    render(<App />);

    expect(screen.getByText(/How The Machine/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready to/i)).toBeInTheDocument();

    const copyTerminalBtn = screen.getByTestId('copy-terminal-btn');
    expect(copyTerminalBtn).toBeInTheDocument();
  });

  it('renders the footer with repository link and FYP context', () => {
    render(<App />);

    const footerLink = screen.getByTestId('github-footer-link');
    expect(footerLink).toBeInTheDocument();
    expect(footerLink).toHaveAttribute('href', GITHUB_REPO_URL);
  });
});
