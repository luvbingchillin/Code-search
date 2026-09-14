import { AstCodeChunk, ChatMessage, ReActState } from '../types';
import { mockAstChunks } from './mockAstData';

export interface SimulationStep {
  state: ReActState;
  message: string;
  delayMs: number;
}

export class AgentSimulator {
  private isCancelled = false;

  public cancel(): void {
    this.isCancelled = true;
  }

  public searchAstChunks(query: string): AstCodeChunk[] {
    const lower = query.toLowerCase();
    const tokens = lower.split(/\W+/).filter((t) => t.length > 2);

    if (tokens.length === 0) {
      return mockAstChunks.slice(0, 3);
    }

    const scored = mockAstChunks.map((chunk) => {
      let score = 0;
      const searchableText = `${chunk.identifier} ${chunk.filePath} ${chunk.docstring ?? ''} ${chunk.code}`.toLowerCase();

      for (const token of tokens) {
        if (chunk.identifier.toLowerCase().includes(token)) {
          score += 5;
        } else if (chunk.filePath.toLowerCase().includes(token)) {
          score += 3;
        } else if (searchableText.includes(token)) {
          score += 1;
        }
      }

      return {
        chunk,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    // Return chunks with positive score, or fallback to top 2 if no token hits
    const results = scored.filter((s) => s.score > 0).map((s) => s.chunk);
    return results.length > 0 ? results : mockAstChunks.slice(0, 2);
  }

  public async runReActCycle(
    query: string,
    onStateChange: (state: ReActState, message: string, chunks?: AstCodeChunk[]) => void
  ): Promise<{ response: string; citedChunks: AstCodeChunk[] }> {
    this.isCancelled = false;

    // 1. Thinking
    onStateChange('Thinking', 'Analyzing query intent and extracting AST entity search keywords...');
    await this.delay(400);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    // 2. Searching AST
    onStateChange('Searching AST', 'Querying NemoIR vector index for Python AST nodes & references...');
    await this.delay(500);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    const matchedChunks = this.searchAstChunks(query);
    onStateChange(
      'Searching AST',
      `Found ${matchedChunks.length} relevant AST code chunks (${matchedChunks.map((c) => c.identifier).join(', ')})`,
      matchedChunks
    );
    await this.delay(300);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    // 3. Synthesizing
    onStateChange('Synthesizing', 'Synthesizing response with cited AST context via WebLLM...');
    await this.delay(600);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    const topChunk = matchedChunks[0];
    const citedSummary = matchedChunks
      .map(
        (c) =>
          `- **\`${c.identifier}\`** in \`${c.filePath}\` (lines ${c.startLine}–${c.endLine}): ${c.docstring ?? c.astNodeType}`
      )
      .join('\n');

    const response = `Based on the codebase analysis, here is the implementation details for **"${query}"**:\n\n` +
      `### Key AST Definitions\n${citedSummary}\n\n` +
      `### Code Explanation\n` +
      `The primary component identified is \`${topChunk.identifier}\` (${topChunk.astNodeType}) located in \`${topChunk.filePath}:${topChunk.startLine}-${topChunk.endLine}\`. ` +
      `It handles critical logic with a calculated semantic relevance score of ${(topChunk.relevanceScore * 100).toFixed(0)}%.\n\n` +
      `You can inspect the full AST definition, decorators, parameters, and line ranges in the code viewer pane on the right.`;

    // 4. Complete
    onStateChange('Complete', `Completed retrieval and synthesis in ${(1.8).toFixed(1)}s`, matchedChunks);

    return {
      response,
      citedChunks: matchedChunks,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
