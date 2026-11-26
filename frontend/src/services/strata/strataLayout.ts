/**
 * 3D Layered Strata Layout Math Engine
 * Pure TypeScript layout calculator with ZERO WebGL / DOM dependencies.
 * Computes 3D coordinates (x, y, z) for AST chunk nodes stacked along the Y-axis by architectural tier
 * and distributed radially or in a grid on the X-Z plane.
 */

export interface RawStrataNode {
  id: string;
  identifier: string;
  filePath: string;
  astNodeType: string;
  tier: number; // 0: Foundation, 1: Adapters, 2: Core Logic, 3: Entrypoints
  startLine?: number;
  endLine?: number;
  [key: string]: unknown;
}

export interface RawStrataEdge {
  id: string;
  source: string;
  target: string;
  callName?: string;
  edgeType?: 'call' | 'inherits' | string;
  [key: string]: unknown;
}

export interface StrataModuleCluster {
  id: string;
  tier: number;
  label: string;
  filePath: string;
  centerX: number;
  centerZ: number;
  radius: number;
  nodeCount: number;
}

export interface StrataTierInfo {
  tier: number;
  name: string;
  description: string;
  yPosition: number;
  nodeCount: number;
  color: string;
  discRadius?: number;
  clusters?: StrataModuleCluster[];
}

export interface StrataNode extends RawStrataNode {
  x: number;
  y: number;
  z: number;
  position: [number, number, number];
  tierName: string;
  color: string;
  moduleGroup: string;
  parentClass?: string;
  loc: number;
  inDegree: number;
  outDegree: number;
  degree: number;
  heightScale: number;
  footprintScale: number;
}

export interface StrataEdge extends RawStrataEdge {
  sourcePosition: [number, number, number];
  targetPosition: [number, number, number];
  points: [number, number, number][];
  sourceTier: number;
  targetTier: number;
}

export interface StrataBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface StrataGraphData {
  nodes: StrataNode[];
  edges: StrataEdge[];
  tiers: StrataTierInfo[];
  bounds: StrataBounds;
}

export interface StrataLayoutOptions {
  tierHeight?: number;                          // Distance along Y between tiers (default: 30)
  yBase?: number;                               // Base Y position for Tier 0 (default: 0)
  layoutMode?: 'radial' | 'grid' | 'clustered'; // Distribution on X-Z plane (default: 'radial')
  radiusStep?: number;                          // Radial dispersion step (default: 12)
  gridSpacing?: number;                         // Grid cell spacing if grid mode (default: 14)
  curveSegments?: number;                       // Number of interpolated points along edge (default: 2)
  curveHeight?: number;                         // Arc lift for curved edge points (default: 0)
}

/**
 * Architectural Tier Colors aligned with the Precision Dark Slate IDE palette:
 * - Tier 0: Foundation / Primitives (Indigo)
 * - Tier 1: Adapters / Transport (Electric Violet)
 * - Tier 2: Core Logic (Warm Amber)
 * - Tier 3: Entrypoints / Interfaces (Emerald)
 * Note: Electric Sky (#38bdf8) is reserved exclusively for active AI citations.
 */
export const STRATA_TIER_COLORS: Record<number, string> = {
  0: '#818cf8', // Foundation & Primitives (Indigo)
  1: '#a855f7', // Adapters & Storage (Violet)
  2: '#f59e0b', // Core Logic (Amber)
  3: '#34d399', // Entrypoints & Interfaces (Emerald)
};

export const DEFAULT_STRATA_TIERS: StrataTierInfo[] = [
  {
    tier: 0,
    name: 'Foundation & Primitives',
    description: 'Data models, type schemas, configuration, and foundational primitives.',
    yPosition: 0,
    nodeCount: 0,
    color: STRATA_TIER_COLORS[0],
  },
  {
    tier: 1,
    name: 'Adapters & Storage',
    description: 'Service integrations, vector databases, network clients, and storage adapters.',
    yPosition: 30,
    nodeCount: 0,
    color: STRATA_TIER_COLORS[1],
  },
  {
    tier: 2,
    name: 'Core Logic',
    description: 'Domain logic, AST parsers, extractors, and workflow orchestration engines.',
    yPosition: 60,
    nodeCount: 0,
    color: STRATA_TIER_COLORS[2],
  },
  {
    tier: 3,
    name: 'Entrypoints & Interfaces',
    description: 'API controllers, CLI commands, application runners, and entrypoints.',
    yPosition: 90,
    nodeCount: 0,
    color: STRATA_TIER_COLORS[3],
  },
];

/** Golden angle in radians for sunflower / Fibonacci spiral */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996323 radians

/** Extract normalized module key and concise display label from filePath. */
function extractModuleMetadata(filePath: string | undefined): { key: string; label: string } {
  const normalized = (filePath || 'module').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return { key: 'module', label: 'module' };
  }
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || normalized;
  const label =
    fileName === '__init__.py' && parts.length >= 2
      ? `${parts[parts.length - 2]}/${fileName}`
      : fileName;
  return { key: normalized, label };
}

/** Compute logarithmic height and subtle connectivity footprint scales for CodeCity encoding. */
function computeNodeMetrics(
  node: RawStrataNode,
  inDegreeMap: Map<string, number>,
  outDegreeMap: Map<string, number>
): {
  moduleGroup: string;
  parentClass?: string;
  loc: number;
  inDegree: number;
  outDegree: number;
  degree: number;
  heightScale: number;
  footprintScale: number;
} {
  const { label: moduleGroup } = extractModuleMetadata(node.filePath);
  const parentClass = node.identifier.includes('.') ? node.identifier.split('.')[0] : undefined;
  const start = typeof node.startLine === 'number' && node.startLine >= 1 ? node.startLine : 1;
  const end = typeof node.endLine === 'number' && node.endLine >= start ? node.endLine : start;
  const loc = Math.max(1, end - start + 1);
  const inDegree = inDegreeMap.get(node.id) ?? 0;
  const outDegree = outDegreeMap.get(node.id) ?? 0;
  const degree = inDegree + outDegree;

  const heightScale = Math.min(4.4, Math.max(1.0, 1.0 + Math.log2(loc) * 0.48));
  const footprintScale = Math.min(1.48, Math.max(1.0, 1.0 + Math.sqrt(degree) * 0.09));

  return {
    moduleGroup,
    parentClass,
    loc,
    inDegree,
    outDegree,
    degree,
    heightScale,
    footprintScale,
  };
}

/**
 * Computes deterministic 2D coordinates on the X-Z plane for nodes within a single tier
 * in radial or grid layout modes.
 */
function computePlaneCoordinates(
  count: number,
  index: number,
  mode: 'radial' | 'grid',
  radiusStep: number,
  gridSpacing: number
): { x: number; z: number } {
  if (count <= 1) {
    return { x: 0, z: 0 };
  }

  if (mode === 'grid') {
    const cols = Math.ceil(Math.sqrt(count));
    const col = index % cols;
    const row = Math.floor(index / cols);

    const x = (col - (cols - 1) / 2) * gridSpacing;
    const z = (row - (Math.ceil(count / cols) - 1) / 2) * gridSpacing;
    return { x, z };
  }

  // Radial mode
  if (count <= 8) {
    // Single ring layout for small node counts
    const ringRadius = Math.max(radiusStep * 1.5, count * 3.5);
    const angle = (2 * Math.PI * index) / count;
    return {
      x: ringRadius * Math.cos(angle),
      z: ringRadius * Math.sin(angle),
    };
  }

  // Fermat / Sunflower spiral for larger node counts (> 8)
  const r = radiusStep * Math.sqrt(index);
  const theta = index * GOLDEN_ANGLE;
  return {
    x: r * Math.cos(theta),
    z: r * Math.sin(theta),
  };
}

interface ModulePlacementResult {
  coords: Map<string, { x: number; z: number }>;
  clusters: StrataModuleCluster[];
  discRadius: number;
}

/**
 * Packs nodes in a tier into deterministic, non-overlapping file/module spatial islands.
 * Owning classes act as local anchors surrounded by their methods and sibling functions.
 */
function computeClusteredTierLayout(
  tierNum: number,
  bucket: RawStrataNode[],
  degreeMap: Map<string, number>
): ModulePlacementResult {
  const coords = new Map<string, { x: number; z: number }>();
  if (bucket.length === 0) {
    return { coords, clusters: [], discRadius: 24 };
  }

  // Group nodes by normalized file path
  const groups = new Map<string, { key: string; label: string; nodes: RawStrataNode[] }>();
  for (const node of bucket) {
    const { key, label } = extractModuleMetadata(node.filePath);
    let entry = groups.get(key);
    if (!entry) {
      entry = { key, label, nodes: [] };
      groups.set(key, entry);
    }
    entry.nodes.push(node);
  }

  // Sort nodes inside each module so parent classes precede their methods, then by degree/line/id
  interface LocalModuleGroup {
    key: string;
    label: string;
    nodes: RawStrataNode[];
    localOffsets: Array<{ id: string; lx: number; lz: number }>;
    radius: number;
  }

  const localGroups: LocalModuleGroup[] = [];
  for (const group of groups.values()) {
    group.nodes.sort((a, b) => {
      const rootA = a.identifier.split('.')[0];
      const rootB = b.identifier.split('.')[0];
      if (rootA !== rootB) {
        const degDiff = (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0);
        if (degDiff !== 0) return degDiff;
        return rootA.localeCompare(rootB);
      }
      const rankA = a.astNodeType === 'ClassDef' && !a.identifier.includes('.') ? 0 : 1;
      const rankB = b.astNodeType === 'ClassDef' && !b.identifier.includes('.') ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;

      const lineA = a.startLine ?? 0;
      const lineB = b.startLine ?? 0;
      if (lineA !== lineB) return lineA - lineB;
      return a.id.localeCompare(b.id);
    });

    const n = group.nodes.length;
    const localOffsets: Array<{ id: string; lx: number; lz: number }> = [];
    let maxDist = 0;

    if (n === 1) {
      localOffsets.push({ id: group.nodes[0].id, lx: 0, lz: 0 });
    } else if (n <= 7 && (group.nodes[0].astNodeType === 'ClassDef' || (degreeMap.get(group.nodes[0].id) ?? 0) >= 2)) {
      // Anchor primary class / hub at island center, surround with ring of methods
      localOffsets.push({ id: group.nodes[0].id, lx: 0, lz: 0 });
      const ringRadius = Math.max(5.8, (n - 1) * 1.45);
      for (let i = 1; i < n; i++) {
        const angle = (2 * Math.PI * (i - 1)) / (n - 1);
        const lx = ringRadius * Math.cos(angle);
        const lz = ringRadius * Math.sin(angle);
        localOffsets.push({ id: group.nodes[i].id, lx, lz });
        maxDist = Math.max(maxDist, Math.hypot(lx, lz));
      }
    } else if (n <= 6) {
      const ringRadius = Math.max(4.5, n * 1.35);
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        const lx = ringRadius * Math.cos(angle);
        const lz = ringRadius * Math.sin(angle);
        localOffsets.push({ id: group.nodes[i].id, lx, lz });
        maxDist = Math.max(maxDist, Math.hypot(lx, lz));
      }
    } else {
      // Compact Fermat spiral inside the file island
      for (let i = 0; i < n; i++) {
        const r = i === 0 ? 0 : 5.0 * Math.sqrt(i);
        const theta = i * GOLDEN_ANGLE;
        const lx = r * Math.cos(theta);
        const lz = r * Math.sin(theta);
        localOffsets.push({ id: group.nodes[i].id, lx, lz });
        maxDist = Math.max(maxDist, r);
      }
    }

    localGroups.push({
      key: group.key,
      label: group.label,
      nodes: group.nodes,
      localOffsets,
      radius: maxDist + 4.2,
    });
  }

  // Deterministic placement order: largest islands near center, tie-break by normalized path
  localGroups.sort((a, b) => {
    if (b.nodes.length !== a.nodes.length) return b.nodes.length - a.nodes.length;
    return a.key.localeCompare(b.key);
  });

  // Pack circular module islands onto the X-Z disc without overlap
  const placed: Array<{ cx: number; cz: number; radius: number }> = [];
  const clusters: StrataModuleCluster[] = [];
  const padding = 5.5;
  let tierMaxDist = 0;

  for (let gIdx = 0; gIdx < localGroups.length; gIdx++) {
    const g = localGroups[gIdx];
    let cx = 0;
    let cz = 0;

    if (gIdx > 0) {
      const minRadialStart = Math.max(0, placed[0].radius + g.radius + padding);
      let found = false;
      for (let step = 0; step < 800; step++) {
        const angle = step * 0.34;
        const rad = minRadialStart + 1.4 * Math.sqrt(step) * 2.2;
        const candX = rad * Math.cos(angle);
        const candZ = rad * Math.sin(angle);
        const overlaps = placed.some(
          (other) => Math.hypot(candX - other.cx, candZ - other.cz) < g.radius + other.radius + padding
        );
        if (!overlaps) {
          cx = candX;
          cz = candZ;
          found = true;
          break;
        }
      }
      if (!found) {
        const fallbackRad = minRadialStart + gIdx * 12;
        const angle = gIdx * GOLDEN_ANGLE;
        cx = fallbackRad * Math.cos(angle);
        cz = fallbackRad * Math.sin(angle);
      }
    }

    placed.push({ cx, cz, radius: g.radius });
    tierMaxDist = Math.max(tierMaxDist, Math.hypot(cx, cz) + g.radius);

    for (const item of g.localOffsets) {
      coords.set(item.id, { x: cx + item.lx, z: cz + item.lz });
    }

    clusters.push({
      id: `${tierNum}:${g.key}`,
      tier: tierNum,
      label: g.label,
      filePath: g.key,
      centerX: cx,
      centerZ: cz,
      radius: g.radius,
      nodeCount: g.nodes.length,
    });
  }

  return {
    coords,
    clusters,
    discRadius: Math.max(24, tierMaxDist + 8),
  };
}

/**
 * Calculates curved or straight line vertex points between source and target positions.
 */
function interpolateEdgePoints(
  source: [number, number, number],
  target: [number, number, number],
  segments: number,
  curveHeight: number
): [number, number, number][] {
  if (segments <= 2 && curveHeight === 0) {
    return [source, target];
  }

  const points: [number, number, number][] = [];
  const numSteps = Math.max(segments, 2);

  // Subtle lateral bow prevents vertical same-X/Z edges from collapsing into needles
  const dx = target[0] - source[0];
  const dz = target[2] - source[2];
  const planarLen = Math.hypot(dx, dz);
  const perpX = planarLen > 0.001 ? -dz / planarLen : 1;
  const perpZ = planarLen > 0.001 ? dx / planarLen : 0;
  const lateralBow = curveHeight * 0.35;

  for (let s = 0; s <= numSteps; s++) {
    const t = s / numSteps;
    const x = source[0] + dx * t;
    const y = source[1] + (target[1] - source[1]) * t;
    const z = source[2] + dz * t;

    const arch = Math.sin(t * Math.PI);
    points.push([
      x + perpX * arch * lateralBow,
      y + arch * curveHeight,
      z + perpZ * arch * lateralBow,
    ]);
  }

  return points;
}

/**
 * Main Layout Calculator:
 * Takes raw nodes and edges, groups nodes by tier (0 to 3),
 * calculates 3D positions (stacked along Y, clustered/radial/grid on X-Z),
 * enriches nodes with LOC and call-degree metrics, and builds 3D edge arcs.
 */
export function computeStrataLayout(
  graph: {
    nodes: RawStrataNode[];
    edges: RawStrataEdge[];
    tiers?: Partial<StrataTierInfo>[];
  },
  options: StrataLayoutOptions = {}
): StrataGraphData {
  const {
    tierHeight = 30,
    yBase = 0,
    layoutMode = 'radial',
    radiusStep = 12,
    gridSpacing = 14,
    curveSegments = 2,
    curveHeight = 0,
  } = options;

  // 0. Compute call-graph degree metrics upfront (only counting valid edges)
  const validNodeIds = new Set(graph.nodes.map((n) => n.id));
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();
  const degreeMap = new Map<string, number>();

  for (const edge of graph.edges) {
    if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
      outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) ?? 0) + 1);
      inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) ?? 0) + 1);
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }
  }

  // 1. Group nodes by tier (0..3, clamp any outliers to [0, 3])
  const tierBuckets: Map<number, RawStrataNode[]> = new Map([
    [0, []],
    [1, []],
    [2, []],
    [3, []],
  ]);

  for (const node of graph.nodes) {
    const rawTier = Number.isInteger(node.tier) ? node.tier : 0;
    const clampedTier = Math.max(0, Math.min(3, rawTier));
    tierBuckets.get(clampedTier)!.push(node);
  }

  // 2. Deterministic sort within each tier by node ID
  for (const nodes of tierBuckets.values()) {
    nodes.sort((a, b) => a.id.localeCompare(b.id));
  }

  // 3. Build TierInfo array with updated node counts and calculated Y-levels
  const tiers: StrataTierInfo[] = [0, 1, 2, 3].map((tierNum) => {
    const defaultTier = DEFAULT_STRATA_TIERS[tierNum];
    const userTier = graph.tiers?.find((t) => t.tier === tierNum);
    const nodeCount = tierBuckets.get(tierNum)!.length;
    const yPosition = yBase + tierNum * tierHeight;

    return {
      tier: tierNum,
      name: userTier?.name || defaultTier.name,
      description: userTier?.description || defaultTier.description,
      yPosition,
      nodeCount,
      color: userTier?.color || defaultTier.color,
      clusters: [],
    };
  });

  const tierMap = new Map(tiers.map((t) => [t.tier, t]));

  // 4. Position each node in 3D space
  const computedNodes: StrataNode[] = [];
  const nodeMap = new Map<string, StrataNode>();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let tierNum = 0; tierNum <= 3; tierNum++) {
    const bucket = tierBuckets.get(tierNum)!;
    const tierInfo = tierMap.get(tierNum)!;
    const count = bucket.length;

    let clusteredResult: ModulePlacementResult | null = null;
    if (layoutMode === 'clustered') {
      clusteredResult = computeClusteredTierLayout(tierNum, bucket, degreeMap);
      tierInfo.clusters = clusteredResult.clusters;
      tierInfo.discRadius = clusteredResult.discRadius;
    }

    let tierMaxRadius = 18;
    for (let i = 0; i < count; i++) {
      const rawNode = bucket[i];
      const xz =
        clusteredResult !== null
          ? clusteredResult.coords.get(rawNode.id) ?? { x: 0, z: 0 }
          : computePlaneCoordinates(count, i, layoutMode === 'grid' ? 'grid' : 'radial', radiusStep, gridSpacing);

      const { x, z } = xz;
      const y = tierInfo.yPosition;
      tierMaxRadius = Math.max(tierMaxRadius, Math.hypot(x, z) + 8);

      // Update bounding box
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;

      const metrics = computeNodeMetrics(rawNode, inDegreeMap, outDegreeMap);

      const computedNode: StrataNode = {
        ...rawNode,
        tier: tierNum,
        x,
        y,
        z,
        position: [x, y, z],
        tierName: tierInfo.name,
        color: tierInfo.color,
        ...metrics,
      };

      computedNodes.push(computedNode);
      nodeMap.set(rawNode.id, computedNode);
    }

    if (layoutMode !== 'clustered') {
      tierInfo.discRadius = Math.max(24, tierMaxRadius);
    }
  }

  // Handle empty graph bounds gracefully
  if (computedNodes.length === 0) {
    minX = maxX = 0;
    minY = yBase;
    maxY = yBase + 3 * tierHeight;
    minZ = maxZ = 0;
  }

  // 5. Calculate 3D edge vertex segments between callers and callees
  const computedEdges: StrataEdge[] = [];

  for (const rawEdge of graph.edges) {
    const src = nodeMap.get(rawEdge.source);
    const tgt = nodeMap.get(rawEdge.target);

    if (src && tgt) {
      const sourcePosition: [number, number, number] = [src.x, src.y, src.z];
      const targetPosition: [number, number, number] = [tgt.x, tgt.y, tgt.z];

      const points = interpolateEdgePoints(sourcePosition, targetPosition, curveSegments, curveHeight);

      computedEdges.push({
        ...rawEdge,
        sourcePosition,
        targetPosition,
        points,
        sourceTier: src.tier,
        targetTier: tgt.tier,
      });
    }
  }

  return {
    nodes: computedNodes,
    edges: computedEdges,
    tiers,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
    },
  };
}
