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
import { decodeWorkflowIr } from '@nemoir/web-runtime';

describe('Empirical Challenger 2: NemoIR Wasm JIT Compiler & IR Fidelity Suite', () => {
  beforeEach(() => {
    clearJitCache();
  });

  // =========================================================================
  // SUITE 1: Rapid Consecutive Compilations (Identical & Varying Source)
  // =========================================================================
  describe('1. Rapid Consecutive Compilations & JIT Cache Idempotency', () => {
    it('executes 50 rapid consecutive compilations of identical DSL with 100% cache hit fidelity', async () => {
      const dsl = DEFAULT_CODE_RETRIEVAL_WORKFLOW;

      const firstRun = await compileNemoWorkflow(dsl, 'codeRetrieval.nemo');
      expect(firstRun.ok).toBe(true);
      expect(firstRun.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(1);

      // Execute 49 subsequent rapid calls
      for (let i = 0; i < 49; i++) {
        const subsequentRun = await compileNemoWorkflow(dsl, 'codeRetrieval.nemo');
        expect(subsequentRun.ok).toBe(true);
        expect(subsequentRun.fromCache).toBe(true);
        expect(subsequentRun.ir).toEqual(firstRun.ir);
        expect(subsequentRun.compilerVersion).toBe(firstRun.compilerVersion);
        expect(subsequentRun.diagnostics).toHaveLength(0);
      }

      expect(getJitCacheSize()).toBe(1);
    });

    it('normalizes leading/trailing whitespace and CRLF vs LF line endings in cache keys', async () => {
      const baseDsl = `workflow WhitespaceAgent {\n  stage @entry Start { prompt: "Go" }\n  stage @exit End { prompt: "Done" }\n}`;

      // Run with clean LF DSL
      const res1 = await compileNemoWorkflow(baseDsl);
      expect(res1.ok).toBe(true);
      expect(res1.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(1);

      // Same DSL with leading/trailing newlines and spaces
      const paddedDsl = `   \n\n\t  ${baseDsl}   \r\n\n  `;
      const res2 = await compileNemoWorkflow(paddedDsl);
      expect(res2.ok).toBe(true);
      expect(res2.fromCache).toBe(true);
      expect(res2.ir).toEqual(res1.ir);
      expect(getJitCacheSize()).toBe(1);
    });

    it('rapidly interleaves compilations of 5 distinct workflows without cross-contamination', async () => {
      const workflows = [1, 2, 3, 4, 5].map((idx) => ({
        id: `InterleavedAgent_${idx}`,
        dsl: `workflow InterleavedAgent_${idx} {
          stage @entry Step_${idx}_A { prompt: "Stage ${idx} A" }
          stage @exit Step_${idx}_B { prompt: "Stage ${idx} B" }
        }`,
      }));

      // Execute 100 rapid interleaved compilations in pseudo-random order
      for (let iteration = 0; iteration < 100; iteration++) {
        const wf = workflows[iteration % workflows.length];
        const res = await compileNemoWorkflow(wf.dsl);
        expect(res.ok).toBe(true);
        const ir = res.ir as any;
        expect(ir.workflow.id).toBe(wf.id);
        expect(ir.workflow.entry).toBe(`Step_${(iteration % workflows.length) + 1}_A`);
      }

      // Exactly 5 distinct workflows should be cached
      expect(getJitCacheSize()).toBe(5);
    });

    it('never poisons the cache with syntax or semantic compilation errors', async () => {
      const brokenDsl = `workflow PoisonCandidate {
        stage @entry MissingBrace { prompt: "Oops"
      `;

      expect(getJitCacheSize()).toBe(0);

      // First run with broken DSL
      const err1 = await compileNemoWorkflow(brokenDsl);
      expect(err1.ok).toBe(false);
      expect(err1.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(0);

      // Second consecutive run with broken DSL: still not cached
      const err2 = await compileNemoWorkflow(brokenDsl);
      expect(err2.ok).toBe(false);
      expect(err2.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(0);

      // Now compile a valid workflow
      const validDsl = `workflow ValidAfterError {
        stage @entry Entry { prompt: "Ok" }
        stage @exit Exit { prompt: "Done" }
      }`;
      const validRes = await compileNemoWorkflow(validDsl);
      expect(validRes.ok).toBe(true);
      expect(validRes.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(1);
    });

    it('documents reference sharing vs shallow clone behavior of cached results', async () => {
      const dsl = `workflow MutationCheck {
        stage @entry Start { prompt: "Original" }
        stage @exit Finish { prompt: "End" }
      }`;

      const res1 = await compileNemoWorkflow(dsl);
      expect(res1.ok).toBe(true);
      expect(res1.fromCache).toBe(false);

      // The returned wrapper object is a new shallow clone (...cached)
      const res2 = await compileNemoWorkflow(dsl);
      expect(res2).not.toBe(res1); // Shallow wrapper is a distinct object
      expect(res2.fromCache).toBe(true);
      // The inner IR is cached by reference
      expect(res2.ir).toBe(res1.ir);
    });
  });

  // =========================================================================
  // SUITE 2: Concurrent Promise.all Compilation Calls & Race Conditions
  // =========================================================================
  describe('2. Concurrent Promise.all Compilation Harness & Race Conditions', () => {
    it('handles 50 concurrent compilation calls for the same workflow without race conditions', async () => {
      const dsl = DEFAULT_CODE_RETRIEVAL_WORKFLOW;

      const promises = Array.from({ length: 50 }, (_, i) =>
        compileNemoWorkflow(dsl, `concurrent_${i}.nemo`)
      );

      const results = await Promise.all(promises);

      // Every single result must succeed
      for (const res of results) {
        expect(res.ok).toBe(true);
        expect(res.diagnostics).toHaveLength(0);
        expect(res.ir).toBeDefined();
        const ir = res.ir as any;
        expect(ir.workflow.id).toBe('CodeRetrievalAgent');
      }

      // Cache size must remain exactly 1
      expect(getJitCacheSize()).toBe(1);

      // At least 49 out of 50 should be served fromCache
      const cachedCount = results.filter((r) => r.fromCache).length;
      expect(cachedCount).toBeGreaterThanOrEqual(49);
    });

    it('handles 25 concurrent compilations of 25 distinct workflows in parallel', async () => {
      const dslList = Array.from({ length: 25 }, (_, i) => ({
        id: `ParallelAgent_${i}`,
        dsl: `workflow ParallelAgent_${i} {
          stage @entry Initial_${i} { prompt: "Initial step ${i}" }
          stage @exit Done_${i} { prompt: "Done step ${i}" }
        }`,
      }));

      const promises = dslList.map((item) => compileNemoWorkflow(item.dsl, `${item.id}.nemo`));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(25);
      results.forEach((res, index) => {
        expect(res.ok).toBe(true);
        expect(res.fromCache).toBe(false);
        const ir = res.ir as any;
        expect(ir.workflow.id).toBe(dslList[index].id);
        expect(ir.workflow.entry).toBe(`Initial_${index}`);
        expect(ir.workflow.exits).toContain(`Done_${index}`);
      });

      // Exactly 25 items should now reside in cache
      expect(getJitCacheSize()).toBe(25);
    });

    it('safely handles concurrent mixed batch of valid and invalid DSLs', async () => {
      const validDsl = (i: number) => `workflow ValidBatch_${i} {
        stage @entry S1 { prompt: "S1" }
        stage @exit S2 { prompt: "S2" }
      }`;
      const invalidDsl = (i: number) => `workflow InvalidBatch_${i} {
        stage @entry Incomplete_${i} {
      `;

      const mixedCalls = Array.from({ length: 30 }, (_, i) => {
        if (i % 2 === 0) {
          return compileNemoWorkflow(validDsl(i), `valid_${i}.nemo`);
        } else {
          return compileNemoWorkflow(invalidDsl(i), `invalid_${i}.nemo`);
        }
      });

      const results = await Promise.all(mixedCalls);

      expect(results).toHaveLength(30);

      results.forEach((res, i) => {
        if (i % 2 === 0) {
          expect(res.ok).toBe(true);
          expect(res.ir).toBeDefined();
        } else {
          expect(res.ok).toBe(false);
          expect(res.diagnostics.length).toBeGreaterThan(0);
          expect(res.ir).toBeUndefined();
        }
      });

      // Only the 15 valid workflows should be in the cache
      expect(getJitCacheSize()).toBe(15);
    });

    it('handles a high-volume burst of 100 simultaneous compilations cleanly', async () => {
      // 50 copies of workflow A, 50 copies of workflow B
      const wfA = `workflow BurstA { stage @entry A { prompt: "A" } stage @exit EndA { prompt: "EA" } }`;
      const wfB = `workflow BurstB { stage @entry B { prompt: "B" } stage @exit EndB { prompt: "EB" } }`;

      const batch = Array.from({ length: 100 }, (_, i) =>
        compileNemoWorkflow(i % 2 === 0 ? wfA : wfB)
      );

      const results = await Promise.all(batch);
      expect(results).toHaveLength(100);

      for (const res of results) {
        expect(res.ok).toBe(true);
      }

      // Exactly 2 workflows should be in cache
      expect(getJitCacheSize()).toBe(2);
      const cachedCount = results.filter((r) => r.fromCache).length;
      expect(cachedCount).toBeGreaterThanOrEqual(98);
    });
  });

  // =========================================================================
  // SUITE 3: Cache Clearing & Sizing Invariants
  // =========================================================================
  describe('3. Cache Clearing (clearJitCache()) & Sizing Invariants', () => {
    it('maintains strict cache size invariant with distinct entries and clearJitCache', async () => {
      expect(getJitCacheSize()).toBe(0);

      // Populate with 10 distinct workflows
      for (let i = 0; i < 10; i++) {
        await compileNemoWorkflow(`workflow Sizing_${i} {
          stage @entry Stg_${i} { prompt: "p" }
          stage @exit Fin_${i} { prompt: "f" }
        }`);
        expect(getJitCacheSize()).toBe(i + 1);
      }

      expect(getJitCacheSize()).toBe(10);

      // Clear cache
      clearJitCache();
      expect(getJitCacheSize()).toBe(0);

      // Re-compiling Sizing_0 must result in fromCache: false and size 1
      const res = await compileNemoWorkflow(`workflow Sizing_0 {
        stage @entry Stg_0 { prompt: "p" }
        stage @exit Fin_0 { prompt: "f" }
      }`);
      expect(res.ok).toBe(true);
      expect(res.fromCache).toBe(false);
      expect(getJitCacheSize()).toBe(1);
    });

    it('survives redundant clearJitCache calls idempotently', () => {
      expect(getJitCacheSize()).toBe(0);
      clearJitCache();
      expect(getJitCacheSize()).toBe(0);
      clearJitCache();
      expect(getJitCacheSize()).toBe(0);
    });
  });

  // =========================================================================
  // SUITE 4: Agent Workflow IR JSON Semantic Fidelity & Runtime Compatibility
  // =========================================================================
  describe('4. Agent Workflow IR JSON Semantic Fidelity & Web-Runtime Compliance', () => {
    it('passes strict validation by @nemoir/web-runtime decodeWorkflowIr oracle', async () => {
      const res = await compileCodeRetrievalWorkflow();
      expect(res.ok).toBe(true);
      expect(res.ir).toBeDefined();

      // Validate through @nemoir/web-runtime's real schema and web-target validator
      const decoded = decodeWorkflowIr(res.ir);
      expect(decoded).toBeDefined();
      expect(decoded.kind).toBe('workflow_ir');
      expect(decoded.workflow.id).toBe('CodeRetrievalAgent');
      expect(decoded.workflow.entry).toBe('Thinking');
      expect(decoded.workflow.exits).toContain('Complete');
      expect(decoded.nodes).toHaveLength(4);
    });

    it('verifies exact node schemas and conditional branching fidelity in codeRetrieval.nemo', async () => {
      const res = await compileCodeRetrievalWorkflow();
      const ir = res.ir as any;

      const nodeMap = new Map(ir.nodes.map((n: any) => [n.id, n]));

      // 1. Thinking Node
      const thinking: any = nodeMap.get('Thinking');
      expect(thinking).toBeDefined();
      expect(thinking.annotations).toContain('entry');
      expect(thinking.prompt).toBe('Analyze user query and formulate AST search strategy');
      expect(thinking.writes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'confidence', type: 'number' }),
        ])
      );
      // Transitions in Thinking
      expect(thinking.transitions).toHaveLength(2);
      const toSearching = thinking.transitions.find((t: any) => t.to === 'SearchingAST');
      expect(toSearching).toBeDefined();
      expect(toSearching.guard.kind).toBe('if');
      expect(toSearching.guard.cond.kind).toBe('compare');
      expect(toSearching.guard.cond.op).toBe('gt');

      const toSynthesizing = thinking.transitions.find((t: any) => t.to === 'Synthesizing');
      expect(toSynthesizing).toBeDefined();
      expect(toSynthesizing.guard.kind).toBe('always');

      // 2. SearchingAST Node
      const searching: any = nodeMap.get('SearchingAST');
      expect(searching).toBeDefined();
      expect(searching.prompt).toBe('Search AST code chunks matching the query');
      expect(searching.writes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'hasResults', type: 'bool' }),
        ])
      );
      // Boolean branching transitions
      expect(searching.transitions).toHaveLength(2);
      const searchToSynth = searching.transitions.find((t: any) => t.to === 'Synthesizing');
      const searchToComplete = searching.transitions.find((t: any) => t.to === 'Complete');
      expect(searchToSynth).toBeDefined();
      expect(searchToComplete).toBeDefined();
      expect(searchToSynth.guard.kind).toBe('if');
      expect(searchToComplete.guard.kind).toBe('if');

      // 3. Synthesizing Node
      const synthesizing: any = nodeMap.get('Synthesizing');
      expect(synthesizing).toBeDefined();
      expect(synthesizing.prompt).toBe('Synthesize explanation from retrieved AST chunks');
      expect(synthesizing.transitions).toHaveLength(1);
      expect(synthesizing.transitions[0].to).toBe('Complete');
      expect(synthesizing.transitions[0].guard.kind).toBe('always');

      // 4. Complete Node (Exit)
      const complete: any = nodeMap.get('Complete');
      expect(complete).toBeDefined();
      expect(complete.annotations).toContain('exit');
      expect(complete.prompt).toBe('Return code retrieval results to user');
      expect(complete.transitions).toHaveLength(0); // Terminal stage
    });

    it('compiles cyclic workflow topologies (e.g. retry loops) without infinite recursion', async () => {
      const cyclicDsl = `workflow CyclicRetryAgent {
        stage @entry TryAction {
          prompt: "Try operation"
          output: {
            success: bool {
              true => Done
              false => RetryAction
            }
          }
        }

        stage RetryAction {
          prompt: "Retry operation"
          transition else => TryAction
        }

        stage @exit Done {
          prompt: "Operation succeeded"
        }
      }`;

      const res = await compileNemoWorkflow(cyclicDsl);
      expect(res.ok).toBe(true);
      expect(res.diagnostics).toHaveLength(0);

      const decoded = decodeWorkflowIr(res.ir);
      expect(decoded.workflow.id).toBe('CyclicRetryAgent');
      expect(decoded.nodes).toHaveLength(3);

      const retryNode = decoded.nodes.find((n) => n.id === 'RetryAction');
      expect(retryNode).toBeDefined();
      expect(retryNode!.transitions[0].to).toBe('TryAction');
    });

    it('compiles workflows with multiple exit states', async () => {
      const multiExitDsl = `workflow MultiExitAgent {
        stage @entry Dispatcher {
          prompt: "Evaluate route"
          output: {
            confidence: number
          }
          transition if confidence > 0.8 => SuccessExit
          transition else => FailureExit
        }

        stage @exit SuccessExit { prompt: "Success" }
        stage @exit FailureExit { prompt: "Failure" }
      }`;

      const res = await compileNemoWorkflow(multiExitDsl);
      expect(res.ok).toBe(true);
      const decoded = decodeWorkflowIr(res.ir);
      expect(decoded.workflow.exits).toContain('SuccessExit');
      expect(decoded.workflow.exits).toContain('FailureExit');
      expect(decoded.workflow.exits).toHaveLength(2);
    });

    it('accurately preserves Unicode and special characters in prompts', async () => {
      const unicodeDsl = `workflow MultilingualAgent {
        stage @entry AnalysisStage {
          prompt: "分析查询：AST 语法树节点 🔍 && 'escaped' \\"quotes\\""
        }
        stage @exit FinishedStage {
          prompt: "완료 🚀 — Retrieval complete."
        }
      }`;

      const res = await compileNemoWorkflow(unicodeDsl);
      expect(res.ok).toBe(true);

      const decoded = decodeWorkflowIr(res.ir);
      const analysisNode = decoded.nodes.find((n) => n.id === 'AnalysisStage');
      expect(analysisNode?.prompt).toContain('分析查询：AST 语法树节点 🔍');
      const finishedNode = decoded.nodes.find((n) => n.id === 'FinishedStage');
      expect(finishedNode?.prompt).toContain('완료 🚀 — Retrieval complete.');
    });

    it('emits diagnostic errors on invalid semantic structures', async () => {
      // 1. Conflicting duplicate entry stages
      const multiEntryDsl = `workflow DoubleEntryAgent {
        stage @entry StageA { prompt: "A" }
        stage @entry StageB { prompt: "B" }
      }`;
      const resMultiEntry = await compileNemoWorkflow(multiEntryDsl);
      expect(resMultiEntry.ok).toBe(false);
      expect(resMultiEntry.diagnostics.length).toBeGreaterThan(0);
      expect(resMultiEntry.diagnostics.some((d) => d.message.includes('@entry') || d.code === 'shape')).toBe(true);

      // 2. Transition to non-existent target stage
      const phantomTargetDsl = `workflow PhantomTargetAgent {
        stage @entry S1 {
          prompt: "S1"
          transition else => NonExistentStage
        }
        stage @exit S2 { prompt: "S2" }
      }`;
      const resPhantom = await compileNemoWorkflow(phantomTargetDsl);
      expect(resPhantom.ok).toBe(false);
      expect(resPhantom.diagnostics.length).toBeGreaterThan(0);
      expect(resPhantom.diagnostics.some((d) => d.message.includes('NonExistentStage'))).toBe(true);

      // 3. Completely empty source
      const emptyRes = await compileNemoWorkflow('');
      expect(emptyRes.ok).toBe(false);
      expect(emptyRes.diagnostics.length).toBeGreaterThan(0);
    });
  });
});
