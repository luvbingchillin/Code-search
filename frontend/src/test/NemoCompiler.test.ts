import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  initNemoCompiler,
  isNemoCompilerReady,
  compileNemoWorkflow,
  compileCodeRetrievalWorkflow,
  getNemoCompilerMetadata,
  clearJitCache,
  getJitCacheSize,
  DEFAULT_CODE_RETRIEVAL_WORKFLOW,
} from '../services/nemoCompiler';

describe('NemoIR WebAssembly Compiler Suite (AC1)', () => {
  beforeEach(() => {
    clearJitCache();
  });

  it('initializes the Wasm compiler and reports ready status', async () => {
    await initNemoCompiler();
    expect(isNemoCompilerReady()).toBe(true);
  });

  it('compiles valid .nemo workflow string into Agent Workflow IR JSON', async () => {
    const dsl = `workflow CodeRetrievalAgent {
      stage @entry Thinking { prompt: "Analyze query" }
      stage SearchingAST { prompt: "Search AST nodes" }
      stage Synthesizing { prompt: "Synthesize response" }
      stage @exit Complete { prompt: "Complete workflow" }
    }`;

    const res = await compileNemoWorkflow(dsl, 'testWorkflow.nemo');

    expect(res.ok).toBe(true);
    expect(res.diagnostics).toHaveLength(0);
    expect(res.ir).toBeDefined();

    const ir = res.ir as any;
    expect(ir.kind).toBe('workflow_ir');
    expect(ir.workflow.id).toBe('CodeRetrievalAgent');
    expect(ir.workflow.entry).toBe('Thinking');
    expect(ir.workflow.exits).toContain('Complete');
    expect(ir.nodes).toHaveLength(4);

    const nodeIds = ir.nodes.map((n: any) => n.id);
    expect(nodeIds).toEqual(['Thinking', 'SearchingAST', 'Synthesizing', 'Complete']);
    expect(res.fromCache).toBe(false);
  });

  it('emits structured diagnostics when .nemo source contains syntax errors', async () => {
    const invalidDsl = `workflow BrokenWorkflow {
      stage @entry IncompleteStage {
    }`;

    const res = await compileNemoWorkflow(invalidDsl, 'broken.nemo');

    expect(res.ok).toBe(false);
    expect(res.ir).toBeUndefined();
    expect(res.diagnostics.length).toBeGreaterThan(0);

    const firstDiag = res.diagnostics[0];
    expect(firstDiag.severity).toBe('error');
    expect(firstDiag.phase).toBeDefined();
    expect(firstDiag.message).toBeDefined();
  });

  it('emits diagnostic on semantic errors such as multiple @entry stages', async () => {
    const multipleEntriesDsl = `workflow ConflictingEntries {
      stage @entry StageA { prompt: "A" }
      stage @entry StageB { prompt: "B" }
    }`;

    const res = await compileNemoWorkflow(multipleEntriesDsl, 'conflict.nemo');

    expect(res.ok).toBe(false);
    expect(res.diagnostics.length).toBeGreaterThan(0);
    expect(res.diagnostics.some(d => d.message.includes('@entry') || d.code === 'shape')).toBe(true);
  });

  it('leverages JIT compilation cache on repeated compilations', async () => {
    const dsl = `workflow CachedWorkflow {
      stage @entry Step1 { prompt: "Step 1" }
      stage @exit Step2 { prompt: "Step 2" }
    }`;

    expect(getJitCacheSize()).toBe(0);

    const firstRun = await compileNemoWorkflow(dsl, 'cached.nemo');
    expect(firstRun.ok).toBe(true);
    expect(firstRun.fromCache).toBe(false);
    expect(getJitCacheSize()).toBe(1);

    const secondRun = await compileNemoWorkflow(dsl, 'cached.nemo');
    expect(secondRun.ok).toBe(true);
    expect(secondRun.fromCache).toBe(true);
    expect(secondRun.ir).toEqual(firstRun.ir);
    expect(getJitCacheSize()).toBe(1);
  });

  it('successfully compiles the production codeRetrieval.nemo file', async () => {
    const filePath = path.resolve(__dirname, '../workflows/codeRetrieval.nemo');
    expect(fs.existsSync(filePath)).toBe(true);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const res = await compileNemoWorkflow(fileContent, 'codeRetrieval.nemo');

    expect(res.ok).toBe(true);
    expect(res.diagnostics).toHaveLength(0);

    const ir = res.ir as any;
    expect(ir.workflow.id).toBe('CodeRetrievalAgent');
    expect(ir.workflow.entry).toBe('Thinking');
    expect(ir.workflow.exits).toContain('Complete');

    // Verify all ReAct loop stages exist
    const nodeMap = new Map(ir.nodes.map((n: any) => [n.id, n]));
    expect(nodeMap.has('Thinking')).toBe(true);
    expect(nodeMap.has('SearchingAST')).toBe(true);
    expect(nodeMap.has('Synthesizing')).toBe(true);
    expect(nodeMap.has('Complete')).toBe(true);

    // Verify conditional transitions in Thinking node
    const thinkingNode: any = nodeMap.get('Thinking');
    expect(thinkingNode.transitions.length).toBeGreaterThanOrEqual(2);
  });

  it('compiles default code retrieval workflow via helper', async () => {
    const res = await compileCodeRetrievalWorkflow();
    expect(res.ok).toBe(true);
    const ir = res.ir as any;
    expect(ir.workflow.id).toBe('CodeRetrievalAgent');
  });

  it('retrieves compiler metadata with supported targets', async () => {
    const meta = await getNemoCompilerMetadata();
    expect(meta.compilerVersion).toBeDefined();
    expect(meta.irVersion).toBeDefined();
    expect(meta.supportedTargets).toContain('web');
  });
});
