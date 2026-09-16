import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initNemoCompiler,
  isNemoCompilerReady,
  compileNemoWorkflow,
  compileCodeRetrievalWorkflow,
  getNemoCompilerMetadata,
  clearJitCache,
  getJitCacheSize,
  type NemoCompileResult,
} from '../services/nemoCompiler';

describe('NemoIR Wasm Compiler Empirical Stress & Robustness Suite (Challenger 1)', () => {
  beforeEach(() => {
    clearJitCache();
  });

  describe('1. Malformed Syntax & Grammar Robustness', () => {
    it('handles empty string gracefully without throwing', async () => {
      const res = await compileNemoWorkflow('', 'empty.nemo');
      expect(res.ok).toBe(false);
      expect(res.ir).toBeUndefined();
      expect(res.diagnostics.length).toBeGreaterThan(0);
      expect(res.diagnostics[0].severity).toBe('error');
      expect(typeof res.diagnostics[0].message).toBe('string');
      expect(res.diagnostics[0].message.length).toBeGreaterThan(0);
    });

    it('handles whitespace-only string gracefully', async () => {
      const res = await compileNemoWorkflow('   \n\t  \n  ', 'whitespace.nemo');
      expect(res.ok).toBe(false);
      expect(res.ir).toBeUndefined();
      expect(res.diagnostics.length).toBeGreaterThan(0);
    });

    it('handles completely invalid non-DSL text (random code/prose/HTML)', async () => {
      const inputs = [
        '<html><body><h1>Not a workflow</h1></body></html>',
        'def python_function():\n    return "hello"',
        'SELECT * FROM workflows WHERE id = 1;',
        '1234567890!@#$%^&*()_+',
      ];

      for (const input of inputs) {
        const res = await compileNemoWorkflow(input, 'invalid.nemo');
        expect(res.ok).toBe(false);
        expect(res.ir).toBeUndefined();
        expect(res.diagnostics.length).toBeGreaterThan(0);
        expect(res.diagnostics[0].severity).toBe('error');
      }
    });

    it('handles unclosed brackets and truncated stage definitions', async () => {
      const unclosedDsls = [
        'workflow Truncated {',
        'workflow Truncated { stage @entry S1 {',
        'workflow Truncated { stage @entry S1 { prompt: "test" }',
        'workflow Truncated { stage @entry S1 { prompt: "test" } stage S2 {',
      ];

      for (const dsl of unclosedDsls) {
        const res = await compileNemoWorkflow(dsl, 'truncated.nemo');
        expect(res.ok).toBe(false);
        expect(res.ir).toBeUndefined();
        expect(res.diagnostics.length).toBeGreaterThan(0);
      }
    });

    it('handles missing stage bodies or missing stage names', async () => {
      const badStages = [
        'workflow Bad { stage }',
        'workflow Bad { stage @entry }',
        'workflow Bad { stage @entry A stage B }',
      ];

      for (const dsl of badStages) {
        const res = await compileNemoWorkflow(dsl, 'bad_stage.nemo');
        expect(res.ok).toBe(false);
        expect(res.diagnostics.length).toBeGreaterThan(0);
      }
    });

    it('handles invalid transition syntax without unhandled exceptions', async () => {
      const badTransitions = [
        `workflow BadTrans {
          stage @entry S1 {
            prompt: "Test"
            transition if =>
          }
          stage @exit S2 { prompt: "Exit" }
        }`,
        `workflow BadTrans {
          stage @entry S1 {
            prompt: "Test"
            transition =>
          }
          stage @exit S2 { prompt: "Exit" }
        }`,
        `workflow BadTrans {
          stage @entry S1 {
            prompt: "Test"
            transition if confidence >
          }
          stage @exit S2 { prompt: "Exit" }
        }`,
      ];

      for (const dsl of badTransitions) {
        const res = await compileNemoWorkflow(dsl, 'bad_trans.nemo');
        expect(res.ok).toBe(false);
        expect(res.diagnostics.length).toBeGreaterThan(0);
      }
    });

    it('handles transitions to undefined/non-existent stages', async () => {
      const nonExistentTargetDsl = `workflow GhostTarget {
        stage @entry S1 {
          prompt: "Start"
          transition else => NonExistentStageXYZ
        }
        stage @exit S2 { prompt: "Exit" }
      }`;

      const res = await compileNemoWorkflow(nonExistentTargetDsl, 'ghost.nemo');
      // Depending on whether unresolved references are semantic errors in NemoIR Wasm:
      if (!res.ok) {
        expect(res.diagnostics.length).toBeGreaterThan(0);
        expect(res.diagnostics.some(d => d.message.includes('NonExistentStageXYZ') || d.severity === 'error')).toBe(true);
      } else {
        // If semantic check allows loose targets, IR must still be generated safely
        expect(res.ir).toBeDefined();
      }
    });

    it('handles workflows with duplicate stage identifiers', async () => {
      const duplicateStageDsl = `workflow DuplicateStages {
        stage @entry S1 { prompt: "First S1" }
        stage S1 { prompt: "Duplicate S1" }
        stage @exit S2 { prompt: "End" }
      }`;

      const res = await compileNemoWorkflow(duplicateStageDsl, 'duplicate.nemo');
      expect(res.ok).toBe(false);
      expect(res.diagnostics.length).toBeGreaterThan(0);
    });

    it('infers the first stage as entry when no @entry annotation is provided', async () => {
      const noEntryDsl = `workflow NoEntryWorkflow {
        stage Step1 { prompt: "No entry" }
        stage @exit Step2 { prompt: "Exit" }
      }`;

      const res = await compileNemoWorkflow(noEntryDsl, 'no_entry.nemo');
      expect(res.ok).toBe(true);
      const ir = res.ir as any;
      expect(ir.workflow.entry).toBe('Step1');
      expect(ir.nodes[0].annotations).toContain('entry');
    });

    it('infers the last stage as exit when no @exit annotation is provided', async () => {
      const noExitDsl = `workflow NoExitWorkflow {
        stage @entry Step1 { prompt: "Start" }
        stage Step2 { prompt: "Running" }
      }`;

      const res = await compileNemoWorkflow(noExitDsl, 'no_exit.nemo');
      expect(res.ok).toBe(true);
      const ir = res.ir as any;
      expect(ir.workflow.exits).toContain('Step2');
      expect(ir.nodes[1].annotations).toContain('exit');
    });
  });

  describe('2. Unicode, Special Characters & Escaping', () => {
    it('successfully compiles workflows with complex Unicode and emojis in prompts', async () => {
      const unicodeDsl = `workflow UnicodeAgent {
        stage @entry Thinking {
          prompt: "分析查询 🔍 🚀 ääööü ñ §±!@#$%^&*()_+-=[]{}|;':,./<>? 🌟"
          transition else => Complete
        }
        stage @exit Complete {
          prompt: "返回代码检索结果 ✅"
        }
      }`;

      const res = await compileNemoWorkflow(unicodeDsl, 'unicode.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
      expect(res.ir).toBeDefined();

      const ir = res.ir as any;
      expect(ir.nodes[0].prompt).toContain('分析查询 🔍 🚀');
      expect(ir.nodes[1].prompt).toContain('返回代码检索结果 ✅');
    });

    it('safely processes escaped quotes and newlines in prompts', async () => {
      const escapedDsl = `workflow EscapedAgent {
        stage @entry S1 {
          prompt: "Line 1\\nLine 2\\tTabbed \\"Quoted\\""
          transition else => S2
        }
        stage @exit S2 {
          prompt: "Done"
        }
      }`;

      const res = await compileNemoWorkflow(escapedDsl, 'escaped.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
    });

    it('handles unterminated string literals gracefully', async () => {
      const unterminatedStringDsl = `workflow UnterminatedString {
        stage @entry S1 {
          prompt: "This string never closes...
          transition else => S2
        }
        stage @exit S2 { prompt: "Done" }
      }`;

      const res = await compileNemoWorkflow(unterminatedStringDsl, 'unterminated.nemo');
      expect(res.ok).toBe(false);
      expect(res.diagnostics.length).toBeGreaterThan(0);
      expect(res.diagnostics[0].severity).toBe('error');
    });

    it('handles unicode or invalid tokens in stage identifiers gracefully', async () => {
      const badIdentifierDsl = `workflow InvalidIdAgent {
        stage @entry 阶段1 { prompt: "Chinese stage identifier" }
        stage @exit S2 { prompt: "Done" }
      }`;

      const res = await compileNemoWorkflow(badIdentifierDsl, 'invalid_id.nemo');
      // If Wasm compiler rejects non-ASCII identifiers, it must report a diagnostic without crashing
      if (!res.ok) {
        expect(res.diagnostics.length).toBeGreaterThan(0);
      } else {
        expect(res.ir).toBeDefined();
      }
    });
  });

  describe('3. Massive Workflows & Scale Stress Testing', () => {
    it('compiles a large multi-stage pipeline (50 sequential stages)', async () => {
      const stages: string[] = [];
      const stageCount = 50;

      for (let i = 0; i < stageCount; i++) {
        const stageName = `Stage_${i}`;
        const nextStage = `Stage_${i + 1}`;
        if (i === 0) {
          stages.push(`  stage @entry ${stageName} {\n    prompt: "Pipeline step ${i}"\n    transition else => ${nextStage}\n  }`);
        } else if (i === stageCount - 1) {
          stages.push(`  stage @exit ${stageName} {\n    prompt: "Final pipeline step ${i}"\n  }`);
        } else {
          stages.push(`  stage ${stageName} {\n    prompt: "Pipeline step ${i}"\n    transition else => ${nextStage}\n  }`);
        }
      }

      const largeDsl = `workflow MassivePipelineWorkflow {\n${stages.join('\n')}\n}`;
      const startTime = performance.now();
      const res = await compileNemoWorkflow(largeDsl, 'massive.nemo');
      const durationMs = performance.now() - startTime;

      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
      expect(res.ir).toBeDefined();

      const ir = res.ir as any;
      expect(ir.nodes).toHaveLength(stageCount);
      expect(ir.workflow.entry).toBe('Stage_0');
      expect(ir.workflow.exits).toContain(`Stage_${stageCount - 1}`);

      // Performance sanity check: JIT compilation of 50 stages in Wasm should finish under 2000ms
      expect(durationMs).toBeLessThan(2000);
    });

    it('compiles a stage with a very large prompt (10,000 characters)', async () => {
      const longText = 'AST code analysis and embedding retrieval step. '.repeat(200); // ~9600 chars
      const largePromptDsl = `workflow LargePromptWorkflow {
        stage @entry S1 {
          prompt: "${longText}"
          transition else => S2
        }
        stage @exit S2 {
          prompt: "End"
        }
      }`;

      const res = await compileNemoWorkflow(largePromptDsl, 'large_prompt.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
      const ir = res.ir as any;
      expect(ir.nodes[0].prompt.length).toBeGreaterThan(9000);
    });

    it('emits type diagnostic when transition condition references untyped variable', async () => {
      const untypedConditionDsl = `workflow UntypedCondition {
        stage @entry Router {
          prompt: "Route"
          transition if score > 90 => Done
          transition else => Done
        }
        stage @exit Done { prompt: "Exit" }
      }`;

      const res = await compileNemoWorkflow(untypedConditionDsl, 'untyped.nemo');
      expect(res.ok).toBe(false);
      expect(res.diagnostics.length).toBeGreaterThan(0);
      expect(res.diagnostics[0].code).toBe('type');
      expect(res.diagnostics[0].message).toContain('compare requires number operands');
    });

    it('handles high-branching stage with typed conditional transitions', async () => {
      const branchingDsl = `workflow MultiBranchWorkflow {
        stage @entry Router {
          prompt: "Route to worker"
          output: {
            score: number
          }
          transition if score > 90 => StageA
          transition if score > 80 => StageB
          transition if score > 70 => StageC
          transition if score > 60 => StageD
          transition if score > 50 => StageE
          transition else => Fallback
        }
        stage StageA { prompt: "A" transition else => Fallback }
        stage StageB { prompt: "B" transition else => Fallback }
        stage StageC { prompt: "C" transition else => Fallback }
        stage StageD { prompt: "D" transition else => Fallback }
        stage StageE { prompt: "E" transition else => Fallback }
        stage @exit Fallback { prompt: "Exit" }
      }`;

      const res = await compileNemoWorkflow(branchingDsl, 'multibranch.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
      const ir = res.ir as any;
      expect(ir.nodes).toHaveLength(7);
      const routerNode = ir.nodes.find((n: any) => n.id === 'Router');
      expect(routerNode.transitions.length).toBe(6);
    });
  });

  describe('4. Diagnostic Formatting & Integrity', () => {
    it('verifies structured diagnostic attributes on syntax error', async () => {
      const badDsl = `workflow TestErr { stage @entry S1 { broken_property: 123 } }`;
      const res = await compileNemoWorkflow(badDsl, 'err.nemo');

      expect(res.ok).toBe(false);
      expect(res.ir).toBeUndefined();
      expect(res.diagnostics.length).toBeGreaterThan(0);

      for (const diag of res.diagnostics) {
        expect(diag).toHaveProperty('severity');
        expect(['error', 'warning', 'info']).toContain(diag.severity);
        expect(diag).toHaveProperty('phase');
        expect(typeof diag.phase).toBe('string');
        expect(diag).toHaveProperty('message');
        expect(typeof diag.message).toBe('string');
        expect(diag.message.trim().length).toBeGreaterThan(0);
      }
    });

    it('ensures compiler does not throw unhandled exceptions even on null-byte injection', async () => {
      const poisonedDsl = `workflow Poisoned {\x00\x01\x02 stage @entry S1 { prompt: "test" } }`;
      let threw = false;
      let res: NemoCompileResult | null = null;
      try {
        res = await compileNemoWorkflow(poisonedDsl, 'poison.nemo');
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
      expect(res).not.toBeNull();
      // Should cleanly fail with diagnostic
      expect(res!.ok).toBe(false);
      expect(res!.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('5. JIT Caching Invariants & Concurrency Stress', () => {
    it('does not cache failed compilation results', async () => {
      const badDsl = `workflow Broken { stage @entry S1 {`;
      expect(getJitCacheSize()).toBe(0);

      const res1 = await compileNemoWorkflow(badDsl, 'bad.nemo');
      expect(res1.ok).toBe(false);
      expect(getJitCacheSize()).toBe(0);

      const res2 = await compileNemoWorkflow(badDsl, 'bad.nemo');
      expect(res2.ok).toBe(false);
      expect(res2.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(0);
    });

    it('caches different valid workflows under independent cache keys', async () => {
      const dslA = `workflow A { stage @entry S1 { prompt: "A" } stage @exit S2 { prompt: "A2" } }`;
      const dslB = `workflow B { stage @entry S1 { prompt: "B" } stage @exit S2 { prompt: "B2" } }`;

      expect(getJitCacheSize()).toBe(0);

      const resA = await compileNemoWorkflow(dslA);
      expect(resA.ok).toBe(true);
      expect(getJitCacheSize()).toBe(1);

      const resB = await compileNemoWorkflow(dslB);
      expect(resB.ok).toBe(true);
      expect(getJitCacheSize()).toBe(2);

      // Verify cached retrieval
      const resACached = await compileNemoWorkflow(dslA);
      expect(resACached.fromCache).toBe(true);
      expect((resACached.ir as any).workflow.id).toBe('A');

      const resBCached = await compileNemoWorkflow(dslB);
      expect(resBCached.fromCache).toBe(true);
      expect((resBCached.ir as any).workflow.id).toBe('B');

      expect(getJitCacheSize()).toBe(2);
    });

    it('handles concurrent compilation calls safely', async () => {
      const dsl = `workflow ConcurrentWf {
        stage @entry S1 { prompt: "Concurrent 1" }
        stage @exit S2 { prompt: "Concurrent 2" }
      }`;

      // Run 10 parallel compilation requests simultaneously
      const promises = Array.from({ length: 10 }, (_, i) =>
        compileNemoWorkflow(dsl, `concurrent_${i}.nemo`)
      );

      const results = await Promise.all(promises);

      for (const res of results) {
        expect(res.ok).toBe(true);
        expect(res.ir).toBeDefined();
      }

      // First run could be non-cached, subsequent runs should use cache or be consistent
      expect(getJitCacheSize()).toBe(1);
    });

    it('handles concurrent initialization calls idempotently', async () => {
      // Multiple parallel calls to initNemoCompiler
      const inits = Array.from({ length: 5 }, () => initNemoCompiler());
      await Promise.all(inits);
      expect(isNemoCompilerReady()).toBe(true);
    });

    it('hits JIT cache regardless of leading and trailing whitespace variants', async () => {
      const baseDsl = `workflow WhitespaceCacheTest { stage @entry S1 { prompt: "test" } stage @exit S2 { prompt: "end" } }`;
      clearJitCache();

      const res1 = await compileNemoWorkflow(baseDsl);
      expect(res1.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(1);

      const paddedDsl = `   \n\n\t  ${baseDsl}   \r\n\t  `;
      const res2 = await compileNemoWorkflow(paddedDsl);
      expect(res2.fromCache).toBe(true);
      expect(getJitCacheSize()).toBe(1);
    });
  });

  describe('6. ReAct Agentic Cycles, Comments & Advanced Features', () => {
    it('successfully compiles cyclical ReAct state transitions (retry loops)', async () => {
      const cyclicDsl = `workflow ReActCycleWorkflow {
        input {
          query: string
        }
        stage @entry Thinking {
          prompt: "Think about search"
          output: {
            retryCount: number
          }
          transition if retryCount < 3 => SearchingAST
          transition else => Abort
        }
        stage SearchingAST {
          prompt: "Execute search"
          output: {
            found: bool {
              true => Synthesizing
              false => Thinking
            }
          }
        }
        stage Synthesizing {
          prompt: "Synthesize"
          transition else => Complete
        }
        stage @exit Complete { prompt: "Success" }
        stage @exit Abort { prompt: "Failed after retries" }
      }`;

      const res = await compileNemoWorkflow(cyclicDsl, 'react_cycle.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
      const ir = res.ir as any;
      expect(ir.workflow.exits).toContain('Complete');
      expect(ir.workflow.exits).toContain('Abort');
      expect(ir.nodes).toHaveLength(5);

      // Verify the backward transition from SearchingAST to Thinking exists
      const searchNode = ir.nodes.find((n: any) => n.id === 'SearchingAST');
      const backTransition = searchNode.transitions.find((t: any) => t.to === 'Thinking');
      expect(backTransition).toBeDefined();
    });

    it('correctly handles Windows CRLF vs Unix LF line endings', async () => {
      const crlfDsl = "workflow CRLFWorkflow {\r\n  stage @entry S1 {\r\n    prompt: \"Test CRLF\"\r\n    transition else => S2\r\n  }\r\n  stage @exit S2 {\r\n    prompt: \"End\"\r\n  }\r\n}\r\n";
      const res = await compileNemoWorkflow(crlfDsl, 'crlf.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
      const ir = res.ir as any;
      expect(ir.workflow.id).toBe('CRLFWorkflow');
    });

    it('supports line comments in .nemo source', async () => {
      const commentedDsl = `// Top-level comment
workflow CommentedWorkflow {
  // Comment before stage
  stage @entry S1 {
    prompt: "Prompt" // Inline comment
    transition else => S2
  }
  stage @exit S2 {
    prompt: "Exit"
  }
}`;

      const res = await compileNemoWorkflow(commentedDsl, 'commented.nemo');
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
    });

    it('emits diagnostic for invalid identifier syntax (e.g. numeric start)', async () => {
      const badIdentDsl = `workflow 123InvalidWorkflow {
        stage @entry S1 { prompt: "A" }
      }`;

      const res = await compileNemoWorkflow(badIdentDsl, 'bad_ident.nemo');
      expect(res.ok).toBe(false);
      expect(res.diagnostics.length).toBeGreaterThan(0);
    });

    it('evaluates null or undefined source input behavior', async () => {
      let threw = false;
      let err: any = null;
      try {
        await (compileNemoWorkflow as any)(null);
      } catch (e) {
        threw = true;
        err = e;
      }
      expect(threw).toBe(true);
      expect(err).toBeInstanceOf(TypeError);
    });

    it('rigorously validates lowered IR schema of production codeRetrieval workflow', async () => {
      const res = await compileCodeRetrievalWorkflow();
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);

      const ir = res.ir as any;
      expect(ir.kind).toBe('workflow_ir');
      expect(ir.ir_version).toBeDefined();
      expect(ir.workflow.id).toBe('CodeRetrievalAgent');
      expect(ir.workflow.entry).toBe('Thinking');
      expect(ir.workflow.exits).toContain('Complete');

      // Verify node count & IDs
      const nodes = ir.nodes;
      expect(nodes).toHaveLength(4);
      const nodeIds = nodes.map((n: any) => n.id);
      expect(nodeIds).toEqual(['Thinking', 'SearchingAST', 'Synthesizing', 'Complete']);

      // Check Thinking transitions
      const thinking = nodes.find((n: any) => n.id === 'Thinking');
      expect(thinking.transitions.length).toBeGreaterThanOrEqual(2);
      expect(thinking.transitions.some((t: any) => t.to === 'SearchingAST')).toBe(true);
      expect(thinking.transitions.some((t: any) => t.to === 'Synthesizing')).toBe(true);

      // Check SearchingAST transitions
      const searching = nodes.find((n: any) => n.id === 'SearchingAST');
      expect(searching.transitions.length).toBeGreaterThanOrEqual(2);
      expect(searching.transitions.some((t: any) => t.to === 'Synthesizing')).toBe(true);
      expect(searching.transitions.some((t: any) => t.to === 'Complete')).toBe(true);

      // Check Synthesizing transitions
      const synthesizing = nodes.find((n: any) => n.id === 'Synthesizing');
      expect(synthesizing.transitions.length).toBeGreaterThanOrEqual(1);
      expect(synthesizing.transitions[0].to).toBe('Complete');

      // Check Complete exit annotations
      const complete = nodes.find((n: any) => n.id === 'Complete');
      expect(complete.annotations).toContain('exit');
      expect(complete.transitions).toHaveLength(0);
    });
  });
});
