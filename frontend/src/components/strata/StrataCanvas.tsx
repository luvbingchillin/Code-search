import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { StrataGraphData, StrataNode, STRATA_TIER_COLORS } from '../../services/strata/strataLayout';

export interface StrataCanvasProps {
  graphData: StrataGraphData;
  highlightedChunkIds?: Set<string>;
  selectedChunkId?: string | null;
  onSelectNode?: (chunkId: string) => void;
  className?: string;
  showTierPlanes?: boolean;
}

/**
 * Checks if WebGL is available in the current environment.
 * Gracefully returns false in JSDOM / headless CI test environments.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || canvas.getContext('webgl2'))
    );
  } catch {
    return false;
  }
}

interface HoveredNodeInfo {
  node: StrataNode;
  screenX: number;
  screenY: number;
}

export const StrataCanvas: React.FC<StrataCanvasProps> = ({
  graphData,
  highlightedChunkIds,
  selectedChunkId,
  onSelectNode,
  className = '',
  showTierPlanes = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasWebGL, setHasWebGL] = useState<boolean>(() => isWebGLAvailable());
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null);

  // References for Three.js engine objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const edgesLineRef = useRef<THREE.LineSegments | null>(null);
  const tierHelpersRef = useRef<THREE.Group | null>(null);

  // Demand-driven dirty-flag render loop state
  const isDirtyRef = useRef<boolean>(true);
  const rafIdRef = useRef<number | null>(null);

  /**
   * Schedules a render frame if marked dirty.
   * Runs at 0 FPS when idle to maximize battery and edge GPU efficiency.
   */
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          // Update orbit controls (damping check)
          let stillMoving = false;
          if (controlsRef.current) {
            stillMoving = controlsRef.current.update();
          }

          if (isDirtyRef.current || stillMoving) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            isDirtyRef.current = false;
          }

          // If orbit controls are still damping, keep scheduling frames until completely settled
          if (stillMoving) {
            markDirty();
          }
        }
      });
    }
  }, []);

  // Compute node lookup map for quick raycast resolving
  const nodeIndexMap = useMemo(() => {
    const map = new Map<number, StrataNode>();
    graphData.nodes.forEach((node, idx) => {
      map.set(idx, node);
    });
    return map;
  }, [graphData.nodes]);

  // Map chunk ID to node index
  const chunkIdToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    graphData.nodes.forEach((node, idx) => {
      map.set(node.id, idx);
    });
    return map;
  }, [graphData.nodes]);

  // 1. Initialize Three.js scene, camera, renderer, lights, and controls
  useEffect(() => {
    if (!hasWebGL) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    // Scene setup with neo-tactile brutalist background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07160c');
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    // Angled isometric viewpoint framing all 4 tiers
    camera.position.set(110, 130, 150);
    cameraRef.current = camera;

    // OrbitControls setup with smooth damping
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 800;
    controls.minDistance = 15;
    controls.target.set(0, 45, 0); // Focus on mid-strata
    controls.addEventListener('change', markDirty);
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(60, 120, 60);
    scene.add(dirLight1);

    // Subtle electric acid lime rim light for neo-tactile brutalist aesthetic
    const rimLight = new THREE.DirectionalLight(0x68f12b, 0.35);
    rimLight.position.set(-60, 20, -60);
    scene.add(rimLight);

    // Group for tier planes and guides
    const tierGroup = new THREE.Group();
    scene.add(tierGroup);
    tierHelpersRef.current = tierGroup;

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight, false);
          markDirty();
        }
      }
    });
    resizeObserver.observe(container);

    markDirty();

    return () => {
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      controls.removeEventListener('change', markDirty);
      controls.dispose();
      renderer.dispose();
      scene.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [hasWebGL, markDirty]);

  // 2. Build or Rebuild Tier Reference Visual Plates
  useEffect(() => {
    if (!hasWebGL || !sceneRef.current || !tierHelpersRef.current) return;
    const tierGroup = tierHelpersRef.current;
    tierGroup.clear();

    if (!showTierPlanes) {
      markDirty();
      return;
    }

    // Determine stratum radius based on graph bounds
    const maxBoundRadius = Math.max(
      Math.abs(graphData.bounds.minX),
      Math.abs(graphData.bounds.maxX),
      Math.abs(graphData.bounds.minZ),
      Math.abs(graphData.bounds.maxZ),
      40
    );
    const planeRadius = maxBoundRadius + 15;

    for (const tier of graphData.tiers) {
      // Stratum reference circular grid
      const gridHelper = new THREE.PolarGridHelper(
        planeRadius,
        4, // radial divisions
        6, // concentric rings
        64, // segments
        new THREE.Color('#134721'),
        new THREE.Color('#0a2b15')
      );
      gridHelper.position.set(0, tier.yPosition, 0);
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.22;
      tierGroup.add(gridHelper);

      // Subtle disc plane
      const discGeom = new THREE.CircleGeometry(planeRadius, 32);
      discGeom.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(tier.color || STRATA_TIER_COLORS[tier.tier]),
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
      });
      const discMesh = new THREE.Mesh(discGeom, discMat);
      discMesh.position.set(0, tier.yPosition - 0.2, 0);
      tierGroup.add(discMesh);
    }

    markDirty();
  }, [hasWebGL, graphData.tiers, graphData.bounds, showTierPlanes, markDirty]);

  // 3. Build InstancedMesh for Nodes & LineSegments for Edges
  useEffect(() => {
    if (!hasWebGL || !sceneRef.current) return;
    const scene = sceneRef.current;

    // Clean up previous node and edge meshes
    if (instancedMeshRef.current) {
      scene.remove(instancedMeshRef.current);
      instancedMeshRef.current.geometry.dispose();
      (instancedMeshRef.current.material as THREE.Material).dispose();
      instancedMeshRef.current = null;
    }
    if (edgesLineRef.current) {
      scene.remove(edgesLineRef.current);
      edgesLineRef.current.geometry.dispose();
      (edgesLineRef.current.material as THREE.Material).dispose();
      edgesLineRef.current = null;
    }

    const nodeCount = graphData.nodes.length;
    if (nodeCount > 0) {
      // Create InstancedMesh for high-performance batch rendering
      // Brutalist beveled block geometry: width 3.2, height 1.2, depth 3.2
      const nodeGeometry = new THREE.BoxGeometry(3.2, 1.2, 3.2);
      const nodeMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.2,
      });

      const instancedMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
      const dummy = new THREE.Object3D();

      for (let i = 0; i < nodeCount; i++) {
        const node = graphData.nodes[i];
        dummy.position.set(node.x, node.y, node.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      scene.add(instancedMesh);
      instancedMeshRef.current = instancedMesh;
    }

    // Edges Rendering using THREE.LineSegments
    const edgeCount = graphData.edges.length;
    if (edgeCount > 0) {
      const positions = new Float32Array(edgeCount * 2 * 3);
      const colors = new Float32Array(edgeCount * 2 * 3);

      for (let i = 0; i < edgeCount; i++) {
        const edge = graphData.edges[i];
        const [sx, sy, sz] = edge.sourcePosition;
        const [tx, ty, tz] = edge.targetPosition;

        const idx = i * 6;
        // Vertex 1: source
        positions[idx] = sx;
        positions[idx + 1] = sy;
        positions[idx + 2] = sz;

        // Vertex 2: target
        positions[idx + 3] = tx;
        positions[idx + 4] = ty;
        positions[idx + 5] = tz;

        // Default edge color: deep moss / emerald wire
        const baseEdgeColor = new THREE.Color('#195f2d');
        colors[idx] = baseEdgeColor.r;
        colors[idx + 1] = baseEdgeColor.g;
        colors[idx + 2] = baseEdgeColor.b;
        colors[idx + 3] = baseEdgeColor.r;
        colors[idx + 4] = baseEdgeColor.g;
        colors[idx + 5] = baseEdgeColor.b;
      }

      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      edgeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const edgeMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });

      const edgesLine = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      scene.add(edgesLine);
      edgesLineRef.current = edgesLine;
    }

    markDirty();
  }, [hasWebGL, graphData.nodes, graphData.edges, markDirty]);

  // 4. Dynamic Instance Color & Scale Buffer Updates (Highlight & Selection state)
  useEffect(() => {
    if (!hasWebGL) return;
    const instancedMesh = instancedMeshRef.current;
    if (!instancedMesh) return;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    const hasHighlights = Boolean(highlightedChunkIds && highlightedChunkIds.size > 0);
    const hasSelection = Boolean(selectedChunkId);

    const nodeCount = graphData.nodes.length;
    for (let i = 0; i < nodeCount; i++) {
      const node = graphData.nodes[i];
      const isSelected = selectedChunkId === node.id;
      const isHighlighted = highlightedChunkIds?.has(node.id) ?? false;

      // Scale pulse for active / selected nodes
      const scale = isSelected ? 1.4 : isHighlighted ? 1.2 : 1.0;
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      // Color mapping:
      // - Selected: Brilliant pure white (#ffffff)
      // - Highlighted: Electric acid lime (#68f12b)
      // - Dimmed (when active filter): darkened stratum color
      // - Normal: Stratum tier color
      if (isSelected) {
        tempColor.set('#ffffff');
      } else if (isHighlighted) {
        tempColor.set('#68f12b'); // Electric acid lime
      } else if (hasHighlights || hasSelection) {
        // Dim unreferenced nodes in dim muted moss baseline (#162a1c)
        tempColor.set('#162a1c');
      } else {
        tempColor.set(node.color || STRATA_TIER_COLORS[node.tier] || '#38bdf8');
      }

      instancedMesh.setColorAt(i, tempColor);
    }

    // Dynamic instance color buffer flag MUST be set to true
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    // Update edge colors if connected to selected / highlighted nodes
    if (edgesLineRef.current) {
      const edgeColorsAttr = edgesLineRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
      if (edgeColorsAttr) {
        const edgeColors = edgeColorsAttr.array as Float32Array;
        const edgeCount = graphData.edges.length;

        for (let i = 0; i < edgeCount; i++) {
          const edge = graphData.edges[i];
          const isEdgeActive =
            (selectedChunkId && (edge.source === selectedChunkId || edge.target === selectedChunkId)) ||
            (highlightedChunkIds && (highlightedChunkIds.has(edge.source) || highlightedChunkIds.has(edge.target)));

          const edgeColor = new THREE.Color(isEdgeActive ? '#68f12b' : '#195f2d');
          const idx = i * 6;
          edgeColors[idx] = edgeColor.r;
          edgeColors[idx + 1] = edgeColor.g;
          edgeColors[idx + 2] = edgeColor.b;
          edgeColors[idx + 3] = edgeColor.r;
          edgeColors[idx + 4] = edgeColor.g;
          edgeColors[idx + 5] = edgeColor.b;
        }
        edgeColorsAttr.needsUpdate = true;
      }
    }

    markDirty();
  }, [hasWebGL, graphData.nodes, graphData.edges, selectedChunkId, highlightedChunkIds, markDirty]);

  // 5. Raycasting for Interaction (Click Selection & Hover Tooltips)
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseCoords = useMemo(() => new THREE.Vector2(), []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Left-click selection
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const instancedMesh = instancedMeshRef.current;
    if (!canvas || !camera || !instancedMesh) return;

    const rect = canvas.getBoundingClientRect();
    mouseCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouseCoords, camera);
    const intersects = raycaster.intersectObject(instancedMesh);

    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId;
      const clickedNode = nodeIndexMap.get(instanceId);
      if (clickedNode && onSelectNode) {
        onSelectNode(clickedNode.id);
      }
    }
  }, [nodeIndexMap, onSelectNode, raycaster, mouseCoords]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const instancedMesh = instancedMeshRef.current;
    if (!canvas || !camera || !instancedMesh) return;

    const rect = canvas.getBoundingClientRect();
    mouseCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouseCoords, camera);
    const intersects = raycaster.intersectObject(instancedMesh);

    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId;
      const node = nodeIndexMap.get(instanceId);
      if (node) {
        setHoveredNode({
          node,
          screenX: e.clientX - rect.left,
          screenY: e.clientY - rect.top,
        });
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    setHoveredNode(null);
    canvas.style.cursor = 'default';
  }, [nodeIndexMap, raycaster, mouseCoords]);

  const handlePointerLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  // Helper to reset camera viewpoint
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(110, 130, 150);
    controlsRef.current.target.set(0, 45, 0);
    controlsRef.current.update();
    markDirty();
  }, [markDirty]);

  // JSDOM / CI / Headless fallback when WebGL context cannot be created
  if (!hasWebGL) {
    return (
      <div
        data-testid="strata-canvas"
        className={`relative w-full h-full flex flex-col items-center justify-center bg-[#07160c] text-[#f4f3eb] p-6 select-none ${className}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#68f12b] animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-[#68f12b] font-semibold">
            3D Strata Architecture Canvas (Headless Mode)
          </span>
        </div>

        <p className="text-xs text-[#f4f3eb]/70 mb-4 max-w-md text-center">
          {graphData.nodes.length} nodes · {graphData.edges.length} caller-callee edges · 4 layered tiers
        </p>

        {/* Tiers List */}
        <div className="grid grid-cols-2 gap-2 max-w-lg w-full mb-4">
          {graphData.tiers.map((t) => (
            <div
              key={t.tier}
              className="border border-[#134721] bg-[#0a2212] p-2.5 rounded text-xs flex flex-col gap-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold" style={{ color: t.color }}>
                  Tier {t.tier}
                </span>
                <span className="text-[10px] font-mono text-[#f4f3eb]/60 bg-[#07160c] px-1.5 py-0.5 rounded">
                  {t.nodeCount} nodes
                </span>
              </div>
              <span className="font-medium text-[11px] text-[#f4f3eb]">{t.name}</span>
            </div>
          ))}
        </div>

        {/* Interactive node chips for testing click selection */}
        <div className="flex flex-wrap gap-1.5 max-w-lg max-h-36 overflow-y-auto p-2 bg-[#051008] border border-[#134721]/60 rounded">
          {graphData.nodes.map((node) => {
            const isSelected = selectedChunkId === node.id;
            const isHighlighted = highlightedChunkIds?.has(node.id);
            const hasActiveHighlights = Boolean(highlightedChunkIds && highlightedChunkIds.size > 0);

            return (
              <button
                key={node.id}
                data-testid={`strata-node-${node.id}`}
                onClick={() => onSelectNode?.(node.id)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#68f12b] text-[#0a1f10] border-[#68f12b] font-bold shadow-sm'
                    : isHighlighted
                    ? 'border-[#68f12b] text-[#68f12b] bg-[#0a1f10] font-semibold ring-1 ring-[#68f12b]/50'
                    : hasActiveHighlights
                    ? 'border-[#162a1c] text-[#162a1c] bg-[#07160c] opacity-60 hover:opacity-100 hover:text-[#f4f3eb]'
                    : 'border-[#134721] text-[#f4f3eb]/70 bg-[#07160c] hover:border-[#68f12b]/60'
                }`}
              >
                {node.identifier}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="strata-canvas"
      className={`relative w-full h-full overflow-hidden bg-[#07160c] select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full block outline-none"
      />

      {/* Floating View Controls HUD */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10 pointer-events-auto">
        <button
          onClick={handleResetCamera}
          className="px-2.5 py-1 text-xs font-mono font-medium rounded border border-[#134721] bg-[#0a2212]/90 text-[#f4f3eb] hover:border-[#68f12b] hover:text-[#68f12b] transition-colors cursor-pointer shadow-sm"
          title="Reset 3D Camera"
        >
          Reset View
        </button>
      </div>

      {/* Architectural Tier Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 p-2.5 rounded bg-[#07160c]/85 border border-[#134721] backdrop-blur-sm z-10 pointer-events-none text-xs font-mono">
        <div className="text-[10px] uppercase tracking-wider text-[#68f12b] font-semibold mb-0.5">
          Strata Tiers
        </div>
        {[3, 2, 1, 0].map((tierNum) => {
          const tier = graphData.tiers.find((t) => t.tier === tierNum);
          if (!tier) return null;
          return (
            <div key={tierNum} className="flex items-center gap-2 text-[11px] text-[#f4f3eb]/80">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                style={{ backgroundColor: tier.color }}
              />
              <span className="font-semibold" style={{ color: tier.color }}>
                T{tier.tier}:
              </span>
              <span className="truncate max-w-[140px]">{tier.name}</span>
              <span className="text-[10px] text-[#f4f3eb]/50 ml-auto">({tier.nodeCount})</span>
            </div>
          );
        })}
      </div>

      {/* Hover Node Tooltip */}
      {hoveredNode && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded bg-[#0a2212]/95 border border-[#68f12b]/60 shadow-lg text-xs font-mono text-[#f4f3eb] backdrop-blur-md max-w-xs transition-opacity duration-75"
          style={{
            left: `${Math.min(hoveredNode.screenX + 14, (containerRef.current?.clientWidth || 500) - 220)}px`,
            top: `${Math.min(hoveredNode.screenY + 14, (containerRef.current?.clientHeight || 500) - 120)}px`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredNode.node.color }}
            />
            <span className="font-bold text-[#68f12b] truncate">{hoveredNode.node.identifier}</span>
          </div>
          <div className="text-[10px] text-[#f4f3eb]/70 truncate">
            {hoveredNode.node.filePath}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-[#f4f3eb]/60 border-t border-[#134721] pt-1">
            <span>{hoveredNode.node.astNodeType}</span>
            <span style={{ color: hoveredNode.node.color }}>Tier {hoveredNode.node.tier}</span>
          </div>
        </div>
      )}
    </div>
  );
};
