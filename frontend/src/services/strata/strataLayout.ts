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
  [key: string]: unknown;
}

export interface StrataTierInfo {
  tier: number;
  name: string;
  description: string;
  yPosition: number;
  nodeCount: number;
  color: string;
}

export interface StrataNode extends RawStrataNode {
  x: number;
  y: number;
  z: number;
  position: [number, number, number];
  tierName: string;
  color: string;
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
  tierHeight?: number;            // Distance along Y between tiers (default: 30)
  yBase?: number;                 // Base Y position for Tier 0 (default: 0)
  layoutMode?: 'radial' | 'grid'; // Distribution on X-Z plane (default: 'radial')
  radiusStep?: number;            // Radial dispersion step (default: 12)
  gridSpacing?: number;           // Grid cell spacing if grid mode (default: 14)
  curveSegments?: number;         // Number of interpolated points along edge (default: 2)
  curveHeight?: number;           // Arc lift for curved edge points (default: 0)
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

/**
 * Computes deterministic 2D coordinates on the X-Z plane for nodes within a single tier.
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
    const rows = Math.ceil(count / cols);
    const col = index % cols;
    const row = Math.floor(index / cols);

    const x = (col - (cols - 1) / 2) * gridSpacing;
    const z = (row - (rows - 1) / 2) * gridSpacing;
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
  // Ensures non-overlapping, uniformly spaced distribution from center outward
  const r = radiusStep * Math.sqrt(index);
  const theta = index * GOLDEN_ANGLE;
  return {
    x: r * Math.cos(theta),
    z: r * Math.sin(theta),
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

  for (let s = 0; s <= numSteps; s++) {
    const t = s / numSteps;
    // Linear interpolation
    const x = source[0] + (target[0] - source[0]) * t;
    const y = source[1] + (target[1] - source[1]) * t;
    const z = source[2] + (target[2] - source[2]) * t;

    // Parabolic arc displacement along Y-axis for 3D depth
    const arc = Math.sin(t * Math.PI) * curveHeight;

    points.push([x, y + arc, z]);
  }

  return points;
}

/**
 * Main Layout Calculator:
 * Takes raw nodes and edges, groups nodes by tier (0 to 3),
 * calculates 3D positions (stacked along Y, distributed radially/grid on X-Z),
 * and builds 3D edge vertex segments between callers and callees.
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

    for (let i = 0; i < count; i++) {
      const rawNode = bucket[i];
      const { x, z } = computePlaneCoordinates(count, i, layoutMode, radiusStep, gridSpacing);
      const y = tierInfo.yPosition;

      // Update bounding box
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;

      const computedNode: StrataNode = {
        ...rawNode,
        tier: tierNum,
        x,
        y,
        z,
        position: [x, y, z],
        tierName: tierInfo.name,
        color: tierInfo.color,
      };

      computedNodes.push(computedNode);
      nodeMap.set(rawNode.id, computedNode);
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

    // If both source and target exist, compute edge segments
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
