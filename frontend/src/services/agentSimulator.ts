import { AstCodeChunk, ChatMessage, ReActState } from '../types';
import { mockAstChunks } from './mockAstData';
import { detectOverviewIntent } from '../utils/intentDetection';

export function formatNodeType(nodeType: string): string {
  switch (nodeType) {
    case 'FunctionDef':
      return 'Function';
    case 'AsyncFunctionDef':
      return 'Async Function';
    case 'ClassDef':
      return 'Class';
    case 'Module':
      return 'Module';
    default:
      return nodeType.replace(/Def$/, '');
  }
}

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
    const isOverview = detectOverviewIntent(query);
    if (isOverview) {
      const classChunks = mockAstChunks.filter((c) => c.astNodeType === 'ClassDef');
      if (classChunks.length > 0) {
        return classChunks;
      }
      return mockAstChunks.slice(0, 3);
    }

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
    onStateChange: (state: ReActState, message: string, chunks?: AstCodeChunk[]) => void,
    onTokenStream?: (chunk: string, accumulated: string) => void,
    providedChunks?: AstCodeChunk[]
  ): Promise<{ response: string; citedChunks: AstCodeChunk[] }> {
    this.isCancelled = false;
    const cycleStart = Date.now();

    // 1. Thinking
    onStateChange('Thinking', 'Analyzing query intent and identifying relevant code definitions...');
    await this.delay(80);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    // 2. Searching AST
    onStateChange('Searching AST', 'Searching indexed codebase for matching functions & classes...');
    await this.delay(100);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    const matchedChunks =
      providedChunks !== undefined
        ? providedChunks
        : this.searchAstChunks(query);

    if (matchedChunks.length === 0) {
      onStateChange('Complete', 'No matching code definitions found', []);
      const emptyResponse = `### 🔍 No Matching Code Definitions Found for "${query}"<!-- No Matching AST Nodes Found -->\n\nNo Python functions, classes, or methods in the active repository matched your search query.\n\n- Try searching for broader terms or exact symbol names (e.g., \`send\`, \`Request\`, \`Calculator\`).\n- Open the **Explorer** sidebar to browse indexed files and definitions.\n- Type \`/status\` to verify the active repository and indexed chunk count.`;
      return {
        response: emptyResponse,
        citedChunks: [],
      };
    }

    onStateChange(
      'Searching AST',
      `Found ${matchedChunks.length} matching definitions`,
      matchedChunks
    );
    await this.delay(60);
    if (this.isCancelled) throw new Error('Query cancelled by user');

    const topChunk = matchedChunks[0];
    const citedSummary = matchedChunks
      .map(
        (c) =>
          `- **\`${c.identifier}\`** in \`${c.filePath}\` (lines ${c.startLine}–${c.endLine}): ${c.docstring ?? formatNodeType(c.astNodeType)}`
      )
      .join('\n');

    const isOverviewQuery = detectOverviewIntent(query);

    const hasRequestsChunks = matchedChunks.some(
      (c) =>
        c.filePath.includes('sessions.py') ||
        c.filePath.includes('models.py') ||
        c.filePath.includes('adapters.py') ||
        c.filePath.includes('auth.py') ||
        c.filePath.includes('exceptions.py') ||
        c.filePath.includes('status_codes.py') ||
        c.filePath.includes('api.py') ||
        c.repoFullName?.includes('requests')
    );
    const hasSampleChunks = matchedChunks.some(
      (c) =>
        c.filePath.includes('sample_service.py') ||
        c.filePath.includes('sample_codebase') ||
        c.identifier.includes('DataProcessingService') ||
        c.identifier.includes('BaseEntity') ||
        c.identifier === 'calculate_statistics'
    );

    let response = '';
    if (isOverviewQuery) {
      if (hasRequestsChunks) {
        response =
          `### 🌐 Architectural Overview: **psf/requests**\n\n` +
          `**\`psf/requests\`** is the premier Python HTTP client library (*"HTTP for Humans"*). It provides an elegant, synchronous interface for issuing HTTP requests, managing persistent sessions, handling authentication, and negotiating response payloads without low-level socket plumbing.\n\n` +
          `---\n\n` +
          `### 🏛️ Core Architecture & Pipeline\n` +
          `1. **Session & Connection Lifecycle (\`sessions.py\`)**\n` +
          `   - **\`Session\`**: Central orchestrator providing cookie persistence across multiple requests, connection pooling (via urllib3), auth persistence, and transport adapter mounting.\n` +
          `2. **Request Encapsulation (\`models.py\`)**\n` +
          `   - **\`Request\` & \`PreparedRequest\`**: Configures HTTP method, headers, parameters, and compiles wire-ready network payloads.\n` +
          `3. **Response Handling (\`models.py\`)**\n` +
          `   - **\`Response\`**: Container for server responses, encapsulating HTTP status codes, headers, cookie jars, and lazy content decoders (\`.content\`, \`.text\`, \`.json()\`).\n` +
          `4. **Transport Adapters (\`adapters.py\`)**\n` +
          `   - **\`HTTPAdapter\`**: Transport abstraction layer mounting urllib3 connection pool managers, socket retries, and TLS/SSL verification.\n\n` +
          `---\n\n` +
          `### 🔑 Key Code Definitions<!-- Key AST Definitions -->\n${citedSummary}`;
      } else if (hasSampleChunks) {
        response =
          `### ⚡ Architectural Overview: **sample_codebase**\n\n` +
          `**\`sample_codebase\`** (\`sample_service.py\`) is a modular Python data processing and asynchronous service module demonstrating entity inheritance, batch stream transformations, statistical utilities, and decorator-based telemetry.\n\n` +
          `---\n\n` +
          `### 🏛️ Core Architecture & Modules\n` +
          `1. **Batch & Stream Processing Engine (\`DataProcessingService\`)**\n` +
          `   - Coordinates synchronous record normalization (\`transform_batch\`), asynchronous generator stream pipelines (\`process_stream\`), and inner configuration validation (\`ProcessingConfig\`).\n` +
          `2. **Domain Entity Foundation (\`BaseEntity\`)**\n` +
          `   - Base class providing unique identity encapsulation (\`entity_id\`), validated property setters (\`name\`), and lifecycle deactivation (\`deactivate\`).\n` +
          `3. **Statistical & Async Network Utilities (\`calculate_statistics\`, \`fetch_remote_resource\`)**\n` +
          `   - Computes mean/variance/standard deviation and executes retry-bounded async endpoint fetching wrapped with \`@log_execution\` and \`@validate_positive\` decorators.\n\n` +
          `---\n\n` +
          `### 🔑 Key Code Definitions<!-- Key AST Definitions -->\n${citedSummary}`;
      } else {
        response =
          `### 📦 Architectural Overview\n\n` +
          `This repository is a structured Python project with ${matchedChunks.length} foundational code components indexed.\n\n` +
          `---\n\n` +
          `### 🏛️ Key Code Definitions<!-- Key AST Definitions -->\n${citedSummary}\n\n` +
          `### Code Architecture\n` +
          `The primary architectural anchor identified is \`${topChunk.identifier}\` (${formatNodeType(topChunk.astNodeType)}) in \`${topChunk.filePath}:${topChunk.startLine}-${topChunk.endLine}\`.`;
      }
    } else {
      const paramsLine =
        topChunk.parameters && topChunk.parameters.length > 0
          ? `- **Parameters:** \`(${topChunk.parameters.join(', ')})\`\n`
          : '';
      const decoratorsLine =
        topChunk.decorators && topChunk.decorators.length > 0
          ? `- **Decorators:** ${topChunk.decorators.map((d) => `\`${d}\``).join(', ')}\n`
          : '';
      const callsLine =
        topChunk.calls && topChunk.calls.length > 0
          ? `- **Calls:** ${topChunk.calls.slice(0, 6).map((c) => `\`${c}\``).join(', ')}\n`
          : '';
      const docSummary = topChunk.docstring
        ? `\n**Purpose:** ${topChunk.docstring.split('\n')[0].trim()}\n`
        : '';

      response =
        `Based on the codebase analysis, here are the implementation details for **"${query}"**:\n\n` +
        `### Key Code Definitions<!-- Key AST Definitions -->\n${citedSummary}\n\n` +
        `### Code Breakdown: \`${topChunk.identifier}\`\n` +
        `- **Location:** \`${topChunk.filePath}:${topChunk.startLine}–${topChunk.endLine}\` (${formatNodeType(topChunk.astNodeType)}, ${(topChunk.relevanceScore * 100).toFixed(0)}% match)\n` +
        paramsLine +
        decoratorsLine +
        callsLine +
        docSummary;
    }

    // 3. Synthesizing
    onStateChange('Synthesizing', 'Formatting code summary...');
    if (onTokenStream) {
      const words = response.split(' ');
      let currentAcc = '';
      for (let i = 0; i < words.length; i++) {
        if (this.isCancelled) throw new Error('Query cancelled by user');
        const chunk = (i === 0 ? '' : ' ') + words[i];
        currentAcc += chunk;
        onTokenStream(chunk, currentAcc);
        await this.delay(2);
      }
    } else {
      await this.delay(80);
      if (this.isCancelled) throw new Error('Query cancelled by user');
    }

    // 4. Complete
    const elapsedSec = Math.max(0.1, (Date.now() - cycleStart) / 1000).toFixed(1);
    onStateChange('Complete', `Completed retrieval and synthesis in ${elapsedSec}s`, matchedChunks);

    return {
      response,
      citedChunks: matchedChunks,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
