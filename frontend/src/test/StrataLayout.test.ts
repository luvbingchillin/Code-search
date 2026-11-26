import { describe, it, expect } from 'vitest';
import {
  computeStrataLayout,
  DEFAULT_STRATA_TIERS,
  STRATA_TIER_COLORS,
  RawStrataNode,
  RawStrataEdge,
} from '../services/strata/strataLayout';

describe('StrataLayout Engine (Pure TypeScript, Zero WebGL)', () => {
  const sampleNodes: RawStrataNode[] = [
    { id: 'chunk-1', identifier: 'BaseModel', filePath: 'app/models/base.py', astNodeType: 'ClassDef', tier: 0 },
    { id: 'chunk-2', identifier: 'UserSchema', filePath: 'app/models/user.py', astNodeType: 'ClassDef', tier: 0 },
    { id: 'chunk-3', identifier: 'VectorStore', filePath: 'app/services/vector.py', astNodeType: 'ClassDef', tier: 1 },
    { id: 'chunk-4', identifier: 'DatabaseClient', filePath: 'app/services/db.py', astNodeType: 'ClassDef', tier: 1 },
    { id: 'chunk-5', identifier: 'ASTExtractor', filePath: 'app/parser/extractor.py', astNodeType: 'FunctionDef', tier: 2 },
    { id: 'chunk-6', identifier: 'ReActLoop', filePath: 'app/core/react.py', astNodeType: 'ClassDef', tier: 2 },
    { id: 'chunk-7', identifier: 'api_router', filePath: 'app/api/v1/router.py', astNodeType: 'FunctionDef', tier: 3 },
    { id: 'chunk-8', identifier: 'main', filePath: 'app/main.py', astNodeType: 'FunctionDef', tier: 3 },
  ];

  const sampleEdges: RawStrataEdge[] = [
    { id: 'edge-1', source: 'chunk-7', target: 'chunk-5', callName: 'extract_ast' },
    { id: 'edge-2', source: 'chunk-6', target: 'chunk-3', callName: 'search_vectors' },
    { id: 'edge-3', source: 'chunk-3', target: 'chunk-1', callName: 'to_dict' },
    { id: 'edge-4', source: 'chunk-8', target: 'chunk-7', callName: 'include_router' },
  ];

  describe('1. Tier Vertical Positioning (Y-Axis Stacking)', () => {
    it('stacks tiers strictly along Y-axis with Tier 0 at bottom and Tier 3 at top', () => {
      const result = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });

      expect(result.tiers).toHaveLength(4);
      expect(result.tiers[0].yPosition).toBe(0);
      expect(result.tiers[1].yPosition).toBe(30);
      expect(result.tiers[2].yPosition).toBe(60);
      expect(result.tiers[3].yPosition).toBe(90);

      // Verify Tier 0 is at bottom (lowest Y) and Tier 3 is at top (highest Y)
      expect(result.tiers[0].yPosition).toBeLessThan(result.tiers[1].yPosition);
      expect(result.tiers[1].yPosition).toBeLessThan(result.tiers[2].yPosition);
      expect(result.tiers[2].yPosition).toBeLessThan(result.tiers[3].yPosition);

      // Verify each node matches its tier Y coordinate
      for (const node of result.nodes) {
        const expectedY = node.tier * 30;
        expect(node.y).toBe(expectedY);
        expect(node.position[1]).toBe(expectedY);
        expect(node.color).toBe(STRATA_TIER_COLORS[node.tier]);
      }
    });

    it('honors custom tierHeight and yBase configurations', () => {
      const result = computeStrataLayout(
        { nodes: sampleNodes, edges: sampleEdges },
        { tierHeight: 50, yBase: -25 }
      );

      expect(result.tiers[0].yPosition).toBe(-25);
      expect(result.tiers[1].yPosition).toBe(25);
      expect(result.tiers[2].yPosition).toBe(75);
      expect(result.tiers[3].yPosition).toBe(125);

      const nodeTier0 = result.nodes.find((n) => n.tier === 0);
      const nodeTier3 = result.nodes.find((n) => n.tier === 3);

      expect(nodeTier0?.y).toBe(-25);
      expect(nodeTier3?.y).toBe(125);
    });

    it('safely clamps out-of-range tiers to the valid [0, 3] tier range', () => {
      const outlierNodes: RawStrataNode[] = [
        { id: 'node-neg', identifier: 'negativeTier', filePath: 'test.py', astNodeType: 'FunctionDef', tier: -2 },
        { id: 'node-high', identifier: 'highTier', filePath: 'test.py', astNodeType: 'FunctionDef', tier: 99 },
      ];

      const result = computeStrataLayout({ nodes: outlierNodes, edges: [] });

      const negNode = result.nodes.find((n) => n.id === 'node-neg');
      const highNode = result.nodes.find((n) => n.id === 'node-high');

      expect(negNode?.tier).toBe(0);
      expect(highNode?.tier).toBe(3);
      expect(negNode?.y).toBe(0);
      expect(highNode?.y).toBe(90);
    });
  });

  describe('2. Coordinate Bounds & Numerical Stability', () => {
    it('computes finite non-NaN coordinates within strict bounding boxes', () => {
      const result = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });

      for (const node of result.nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
        expect(Number.isFinite(node.z)).toBe(true);
        expect(Number.isNaN(node.x)).toBe(false);
        expect(Number.isNaN(node.y)).toBe(false);
        expect(Number.isNaN(node.z)).toBe(false);

        // Within graph bounds
        expect(node.x).toBeGreaterThanOrEqual(result.bounds.minX);
        expect(node.x).toBeLessThanOrEqual(result.bounds.maxX);
        expect(node.y).toBeGreaterThanOrEqual(result.bounds.minY);
        expect(node.y).toBeLessThanOrEqual(result.bounds.maxY);
        expect(node.z).toBeGreaterThanOrEqual(result.bounds.minZ);
        expect(node.z).toBeLessThanOrEqual(result.bounds.maxZ);
      }
    });

    it('handles single-node tiers centered at the origin (x=0, z=0)', () => {
      const singleNode: RawStrataNode[] = [
        { id: 'solo', identifier: 'SoloNode', filePath: 'solo.py', astNodeType: 'ClassDef', tier: 1 },
      ];

      const result = computeStrataLayout({ nodes: singleNode, edges: [] });
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].x).toBe(0);
      expect(result.nodes[0].z).toBe(0);
      expect(result.nodes[0].y).toBe(30);
    });

    it('handles large node counts (sunflower spiral) without spatial explosion', () => {
      // 50 nodes in Tier 2
      const largeNodeList: RawStrataNode[] = Array.from({ length: 50 }, (_, i) => ({
        id: `chunk-large-${i}`,
        identifier: `handler_${i}`,
        filePath: `app/handlers/h${i}.py`,
        astNodeType: 'FunctionDef',
        tier: 2,
      }));

      const result = computeStrataLayout({ nodes: largeNodeList, edges: [] }, { radiusStep: 10 });
      expect(result.nodes).toHaveLength(50);

      // Max radius should be bounded: r = radiusStep * sqrt(49) = 10 * 7 = 70
      for (const node of result.nodes) {
        const radius = Math.sqrt(node.x * node.x + node.z * node.z);
        expect(radius).toBeLessThanOrEqual(75);
      }
    });

    it('gracefully handles empty graph without throwing', () => {
      const result = computeStrataLayout({ nodes: [], edges: [] });
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.tiers).toHaveLength(4);
      expect(Number.isFinite(result.bounds.minX)).toBe(true);
      expect(Number.isFinite(result.bounds.maxY)).toBe(true);
    });
  });

  describe('3. Determinism & Input Order Invariance', () => {
    it('produces 100% deterministic coordinates across repeated executions', () => {
      const run1 = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });
      const run2 = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });

      for (let i = 0; i < run1.nodes.length; i++) {
        expect(run1.nodes[i].x).toBe(run2.nodes[i].x);
        expect(run1.nodes[i].y).toBe(run2.nodes[i].y);
        expect(run1.nodes[i].z).toBe(run2.nodes[i].z);
      }
    });

    it('produces identical coordinates regardless of input array ordering (order invariance)', () => {
      const shuffledNodes = [...sampleNodes].reverse();
      const runNormal = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });
      const runShuffled = computeStrataLayout({ nodes: shuffledNodes, edges: sampleEdges });

      const normalMap = new Map(runNormal.nodes.map((n) => [n.id, n]));
      const shuffledMap = new Map(runShuffled.nodes.map((n) => [n.id, n]));

      for (const id of normalMap.keys()) {
        const n1 = normalMap.get(id)!;
        const n2 = shuffledMap.get(id)!;
        expect(n1.x).toBe(n2.x);
        expect(n1.y).toBe(n2.y);
        expect(n1.z).toBe(n2.z);
      }
    });
  });

  describe('4. Grid vs Radial Layout Modes', () => {
    it('supports grid layout distribution on X-Z plane centered at origin', () => {
      const fourNodes: RawStrataNode[] = [
        { id: 'g1', identifier: 'c1', filePath: 'c1.py', astNodeType: 'ClassDef', tier: 1 },
        { id: 'g2', identifier: 'c2', filePath: 'c2.py', astNodeType: 'ClassDef', tier: 1 },
        { id: 'g3', identifier: 'c3', filePath: 'c3.py', astNodeType: 'ClassDef', tier: 1 },
        { id: 'g4', identifier: 'c4', filePath: 'c4.py', astNodeType: 'ClassDef', tier: 1 },
      ];

      const result = computeStrataLayout(
        { nodes: fourNodes, edges: [] },
        { layoutMode: 'grid', gridSpacing: 20 }
      );

      // 4 nodes -> 2x2 grid. Centered at 0, offsets are -10 and +10
      const xs = result.nodes.map((n) => n.x);
      const zs = result.nodes.map((n) => n.z);

      expect(Math.min(...xs)).toBeCloseTo(-10);
      expect(Math.max(...xs)).toBeCloseTo(10);
      expect(Math.min(...zs)).toBeCloseTo(-10);
      expect(Math.max(...zs)).toBeCloseTo(10);
    });
  });

  describe('5. 3D Edge Calculation & Vertex Segments', () => {
    it('calculates 3D edge line vertex segments linking callers to callees', () => {
      const result = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });

      expect(result.edges).toHaveLength(sampleEdges.length);

      const edge1 = result.edges.find((e) => e.id === 'edge-1')!; // chunk-7 (tier 3) -> chunk-5 (tier 2)
      expect(edge1).toBeDefined();
      expect(edge1.sourceTier).toBe(3);
      expect(edge1.targetTier).toBe(2);

      const srcNode = result.nodes.find((n) => n.id === 'chunk-7')!;
      const tgtNode = result.nodes.find((n) => n.id === 'chunk-5')!;

      expect(edge1.sourcePosition).toEqual([srcNode.x, srcNode.y, srcNode.z]);
      expect(edge1.targetPosition).toEqual([tgtNode.x, tgtNode.y, tgtNode.z]);
      expect(edge1.points).toHaveLength(2);
      expect(edge1.points[0]).toEqual(edge1.sourcePosition);
      expect(edge1.points[1]).toEqual(edge1.targetPosition);
    });

    it('interpolates curved arc edge points when curveHeight is specified', () => {
      const result = computeStrataLayout(
        { nodes: sampleNodes, edges: sampleEdges },
        { curveSegments: 6, curveHeight: 15 }
      );

      const edge1 = result.edges[0];
      expect(edge1.points).toHaveLength(7); // 6 segments = 7 points
      expect(edge1.points[0]).toEqual(edge1.sourcePosition);
      expect(edge1.points[6]).toEqual(edge1.targetPosition);

      // Midpoint should have upward arc displacement along Y
      const midpoint = edge1.points[3];
      const linearY = (edge1.sourcePosition[1] + edge1.targetPosition[1]) / 2;
      expect(midpoint[1]).toBeGreaterThan(linearY);
    });

    it('safely skips edges referencing non-existent nodes without throwing', () => {
      const edgesWithInvalid: RawStrataEdge[] = [
        ...sampleEdges,
        { id: 'dangling', source: 'non-existent', target: 'chunk-1' },
      ];

      const result = computeStrataLayout({ nodes: sampleNodes, edges: edgesWithInvalid });
      expect(result.edges).toHaveLength(sampleEdges.length);
      expect(result.edges.some((e) => e.id === 'dangling')).toBe(false);
    });
  });

  describe('6. Tier Metadata & Count Aggregation', () => {
    it('accurately counts nodes per architectural tier', () => {
      const result = computeStrataLayout({ nodes: sampleNodes, edges: sampleEdges });

      expect(result.tiers[0].nodeCount).toBe(2);
      expect(result.tiers[1].nodeCount).toBe(2);
      expect(result.tiers[2].nodeCount).toBe(2);
      expect(result.tiers[3].nodeCount).toBe(2);
      expect(DEFAULT_STRATA_TIERS[3].name).toBe('Entrypoints & Interfaces');
    });
  });

  describe('7. Clustered CodeCity Module Layout & Semantic Node Metrics', () => {
    const clusteredNodes: RawStrataNode[] = [
      { id: 'sess-cls', identifier: 'Session', filePath: 'requests/sessions.py', astNodeType: 'ClassDef', tier: 2, startLine: 100, endLine: 460 },
      { id: 'sess-req', identifier: 'Session.request', filePath: 'requests/sessions.py', astNodeType: 'FunctionDef', tier: 2, startLine: 150, endLine: 210 },
      { id: 'sess-prep', identifier: 'Session.prepare_request', filePath: 'requests/sessions.py', astNodeType: 'FunctionDef', tier: 2, startLine: 215, endLine: 260 },
      { id: 'cook-cls', identifier: 'RequestsCookieJar', filePath: 'requests/cookies.py', astNodeType: 'ClassDef', tier: 2, startLine: 10, endLine: 90 },
      { id: 'cook-get', identifier: 'RequestsCookieJar.get', filePath: 'requests/cookies.py', astNodeType: 'FunctionDef', tier: 2, startLine: 30, endLine: 45 },
    ];
    const clusteredEdges: RawStrataEdge[] = [
      { id: 'ce-1', source: 'sess-cls', target: 'sess-req' },
      { id: 'ce-2', source: 'sess-cls', target: 'sess-prep' },
      { id: 'ce-3', source: 'sess-req', target: 'cook-get' },
    ];

    it('packs distinct file modules into non-overlapping clusters with parent class anchors', () => {
      const result = computeStrataLayout(
        { nodes: clusteredNodes, edges: clusteredEdges },
        { layoutMode: 'clustered', curveSegments: 8, curveHeight: 6 }
      );

      const tier2 = result.tiers.find((t) => t.tier === 2)!;
      expect(tier2.clusters).toHaveLength(2);
      expect(tier2.discRadius).toBeGreaterThanOrEqual(24);

      const [cA, cB] = tier2.clusters!;
      const centerDist = Math.hypot(cA.centerX - cB.centerX, cA.centerZ - cB.centerZ);
      expect(centerDist).toBeGreaterThanOrEqual(cA.radius + cB.radius);

      // Nodes from sessions.py must sit closer to each other than to cookies.py nodes
      const sessCls = result.nodes.find((n) => n.id === 'sess-cls')!;
      const sessReq = result.nodes.find((n) => n.id === 'sess-req')!;
      const cookCls = result.nodes.find((n) => n.id === 'cook-cls')!;
      const intraDist = Math.hypot(sessCls.x - sessReq.x, sessCls.z - sessReq.z);
      const interDist = Math.hypot(sessCls.x - cookCls.x, sessCls.z - cookCls.z);
      expect(intraDist).toBeLessThan(interDist);
    });

    it('computes LOC, degree metrics, and taller heightScale for larger symbols', () => {
      const result = computeStrataLayout(
        { nodes: clusteredNodes, edges: clusteredEdges },
        { layoutMode: 'clustered' }
      );
      const bigClass = result.nodes.find((n) => n.id === 'sess-cls')!;
      const smallMethod = result.nodes.find((n) => n.id === 'cook-get')!;

      expect(bigClass.loc).toBe(361);
      expect(bigClass.outDegree).toBe(2);
      expect(smallMethod.loc).toBe(16);
      expect(smallMethod.inDegree).toBe(1);
      expect(bigClass.heightScale).toBeGreaterThan(smallMethod.heightScale);
      expect(bigClass.moduleGroup).toBe('sessions.py');
    });

    it('remains 100% deterministic under reversed input ordering in clustered mode', () => {
      const r1 = computeStrataLayout(
        { nodes: clusteredNodes, edges: clusteredEdges },
        { layoutMode: 'clustered' }
      );
      const r2 = computeStrataLayout(
        { nodes: [...clusteredNodes].reverse(), edges: [...clusteredEdges].reverse() },
        { layoutMode: 'clustered' }
      );
      const m1 = new Map(r1.nodes.map((n) => [n.id, n]));
      for (const n2 of r2.nodes) {
        const n1 = m1.get(n2.id)!;
        expect(n2.x).toBe(n1.x);
        expect(n2.z).toBe(n1.z);
      }
    });
  });
});
