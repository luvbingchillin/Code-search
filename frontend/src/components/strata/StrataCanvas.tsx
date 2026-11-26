import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  StrataGraphData,
  StrataModuleCluster,
  StrataNode,
  STRATA_TIER_COLORS,
} from '../../services/strata/strataLayout';
import {
  createClassMonolithGeometry,
  createFunctionPillarGeometry,
  extractLocalOutlineSegments,
} from './strataGeometry';

export type StrataEdgeMode = 'focused' | 'cross-tier' | 'all';

export interface StrataCanvasProps {
  graphData: StrataGraphData;
  highlightedChunkIds?: Set<string>;
  selectedChunkId?: string | null;
  onSelectNode?: (chunkId: string) => void;
  focusTargetId?: string | null;
  focusNonce?: number;
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

interface ProjectedLabel {
  id: string;
  identifier: string;
  x: number;
  y: number;
  isSelected: boolean;
}

interface ProjectedLandmark {
  id: string;
  text: string;
  subtext?: string;
  kind: 'tier' | 'module';
  color?: string;
  x: number;
  y: number;
}

interface LandmarkTarget {
  id: string;
  text: string;
  subtext?: string;
  kind: 'tier' | 'module';
  color?: string;
  wx: number;
  wy: number;
  wz: number;
}

function computeBuildingDimensions(
  node: StrataNode,
  isSelected: boolean,
  isHighlighted: boolean,
  isOneHopNeighbor: boolean
): { widthScale: number; heightScale: number } {
  const isClass = node.astNodeType === 'ClassDef';
  const baseHeight = isClass
    ? Math.max(2.4, (node.heightScale ?? 1.5) * 1.75)
    : Math.max(1.3, (node.heightScale ?? 1.1) * 1.45);
  const baseWidth = isClass ? (node.footprintScale ?? 1.0) * 1.08 : (node.footprintScale ?? 1.0);

  const widthBoost = isSelected ? 1.24 : isHighlighted ? 1.12 : isOneHopNeighbor ? 1.06 : 1.0;
  const heightBoost = isSelected ? 1.18 : isHighlighted ? 1.08 : isOneHopNeighbor ? 1.04 : 1.0;

  return {
    widthScale: baseWidth * widthBoost,
    heightScale: baseHeight * heightBoost,
  };
}

export const StrataCanvas: React.FC<StrataCanvasProps> = ({
  graphData,
  highlightedChunkIds,
  selectedChunkId,
  onSelectNode,
  focusTargetId,
  focusNonce,
  className = '',
  showTierPlanes = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasWebGL, setHasWebGL] = useState<boolean>(() => isWebGLAvailable());
  const [isContextLost, setIsContextLost] = useState<boolean>(false);
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const [projectedLandmarks, setProjectedLandmarks] = useState<ProjectedLandmark[]>([]);

  // Interactive visual controls
  const [edgeMode, setEdgeMode] = useState<StrataEdgeMode>('focused');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [dimUnfocused, setDimUnfocused] = useState<boolean>(true);
  const [isolatedTier, setIsolatedTier] = useState<number | null>(null);

  // Refs for latest projection inputs without re-creating markDirty
  const labelTargetsRef = useRef<StrataNode[]>([]);
  const landmarkTargetsRef = useRef<LandmarkTarget[]>([]);
  const showLandmarksRef = useRef<boolean>(showLandmarks);
  showLandmarksRef.current = showLandmarks;
  const selectedIdRef = useRef<string | null | undefined>(selectedChunkId);
  selectedIdRef.current = selectedChunkId;
  const nodeHeightMapRef = useRef<Map<string, number>>(new Map());

  // References for Three.js engine objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const classInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const funcInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const nodeEdgesLineRef = useRef<THREE.LineSegments | null>(null);
  const classOutlineLocalRef = useRef<Float32Array>(new Float32Array(0));
  const funcOutlineLocalRef = useRef<Float32Array>(new Float32Array(0));
  const maxOutlineSegmentsRef = useRef<number>(0);
  const edgesLineRef = useRef<THREE.LineSegments | null>(null);
  const maxEdgeSegmentsRef = useRef<number>(0);
  const tierHelpersRef = useRef<THREE.Group | null>(null);

  // Demand-driven dirty-flag render loop state
  const isDirtyRef = useRef<boolean>(true);
  const rafIdRef = useRef<number | null>(null);
  const cameraTransitionRef = useRef<{
    startTime: number;
    durationMs: number;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
  } | null>(null);

  // Split nodes cleanly into ClassDef architectural towers vs Function/Method hexagonal pillars
  const { classNodes, funcNodes, classIndexById, funcIndexById } = useMemo(() => {
    const classes: StrataNode[] = [];
    const funcs: StrataNode[] = [];
    const cMap = new Map<string, number>();
    const fMap = new Map<string, number>();

    for (const node of graphData.nodes) {
      if (node.astNodeType === 'ClassDef') {
        cMap.set(node.id, classes.length);
        classes.push(node);
      } else {
        fMap.set(node.id, funcs.length);
        funcs.push(node);
      }
    }

    return { classNodes: classes, funcNodes: funcs, classIndexById: cMap, funcIndexById: fMap };
  }, [graphData.nodes]);

  const classNodesRef = useRef<StrataNode[]>(classNodes);
  classNodesRef.current = classNodes;
  const funcNodesRef = useRef<StrataNode[]>(funcNodes);
  funcNodesRef.current = funcNodes;

  // Build resting landmark anchors (Tier floor badges + Top module island labels)
  useEffect(() => {
    const targets: LandmarkTarget[] = [];
    if (!showLandmarks) {
      landmarkTargetsRef.current = [];
      return;
    }

    for (const tier of graphData.tiers) {
      if (tier.nodeCount === 0) continue;
      if (isolatedTier !== null && isolatedTier !== tier.tier) continue;
      const discR = tier.discRadius ?? 38;
      targets.push({
        id: `tier-badge-${tier.tier}`,
        text: `T${tier.tier} · ${tier.name.split(' ')[0]}`,
        subtext: `${tier.nodeCount}`,
        kind: 'tier',
        color: tier.color,
        wx: -(discR + 2),
        wy: tier.yPosition + 1.0,
        wz: 0,
      });
    }

    const moduleClusters: Array<StrataModuleCluster & { tierColor: string; yPos: number }> = [];
    for (const tier of graphData.tiers) {
      if (isolatedTier !== null && isolatedTier !== tier.tier) continue;
      for (const cluster of tier.clusters ?? []) {
        if (cluster.nodeCount >= 2) {
          moduleClusters.push({
            ...cluster,
            tierColor: tier.color,
            yPos: tier.yPosition,
          });
        }
      }
    }
    moduleClusters.sort((a, b) => b.nodeCount - a.nodeCount);
    for (let i = 0; i < Math.min(8, moduleClusters.length); i++) {
      const c = moduleClusters[i];
      targets.push({
        id: `module-badge-${c.id}`,
        text: c.label,
        subtext: `${c.nodeCount}`,
        kind: 'module',
        color: c.tierColor,
        wx: c.centerX,
        wy: c.yPos + 0.6,
        wz: c.centerZ + c.radius + 1.0,
      });
    }

    landmarkTargetsRef.current = targets;
  }, [graphData.tiers, isolatedTier, showLandmarks]);

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
          let isTransitioning = false;
          const transition = cameraTransitionRef.current;
          if (transition && controlsRef.current) {
            const elapsed = performance.now() - transition.startTime;
            const rawT = transition.durationMs <= 0 ? 1 : Math.min(1, elapsed / transition.durationMs);
            const easedT = 1 - Math.pow(1 - rawT, 3);
            controlsRef.current.target.lerpVectors(transition.startTarget, transition.endTarget, easedT);
            cameraRef.current.position.lerpVectors(transition.startPos, transition.endPos, easedT);
            isDirtyRef.current = true;
            if (rawT >= 1) {
              cameraTransitionRef.current = null;
            } else {
              isTransitioning = true;
            }
          }

          let stillMoving = false;
          if (controlsRef.current) {
            stillMoving = controlsRef.current.update();
          }

          if (isDirtyRef.current || stillMoving || isTransitioning) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            isDirtyRef.current = false;

            const container = containerRef.current;
            if (container) {
              const w = container.clientWidth || 800;
              const h = container.clientHeight || 600;
              const projVec = new THREE.Vector3();

              // 1. Project active/selected node pins
              const targets = labelTargetsRef.current;
              if (targets.length > 0) {
                const nextLabels: ProjectedLabel[] = [];
                for (let i = 0; i < targets.length && nextLabels.length < 12; i++) {
                  const node = targets[i];
                  const topOffset = (nodeHeightMapRef.current.get(node.id) ?? 2.2) + 0.9;
                  projVec.set(node.x, node.y + topOffset, node.z);
                  projVec.project(cameraRef.current);
                  if (projVec.z >= -1 && projVec.z <= 1) {
                    const sx = (projVec.x * 0.5 + 0.5) * w;
                    const sy = (-projVec.y * 0.5 + 0.5) * h;
                    if (sx >= 16 && sx <= w - 16 && sy >= 16 && sy <= h - 16) {
                      nextLabels.push({
                        id: node.id,
                        identifier: node.identifier,
                        x: Math.round(sx),
                        y: Math.round(sy),
                        isSelected: selectedIdRef.current === node.id,
                      });
                    }
                  }
                }
                setProjectedLabels(nextLabels);
              } else {
                setProjectedLabels((prev) => (prev.length === 0 ? prev : []));
              }

              // 2. Project resting Tier Floor & Module Island landmarks
              const landmarks = landmarkTargetsRef.current;
              if (showLandmarksRef.current && landmarks.length > 0) {
                const nextLandmarks: ProjectedLandmark[] = [];
                for (let i = 0; i < landmarks.length; i++) {
                  const lm = landmarks[i];
                  projVec.set(lm.wx, lm.wy, lm.wz);
                  projVec.project(cameraRef.current);
                  if (projVec.z >= -1 && projVec.z <= 1) {
                    const sx = (projVec.x * 0.5 + 0.5) * w;
                    const sy = (-projVec.y * 0.5 + 0.5) * h;
                    if (sx >= 24 && sx <= w - 24 && sy >= 24 && sy <= h - 24) {
                      nextLandmarks.push({
                        id: lm.id,
                        text: lm.text,
                        subtext: lm.subtext,
                        kind: lm.kind,
                        color: lm.color,
                        x: Math.round(sx),
                        y: Math.round(sy),
                      });
                    }
                  }
                }
                setProjectedLandmarks(nextLandmarks);
              } else {
                setProjectedLandmarks((prev) => (prev.length === 0 ? prev : []));
              }
            }
          }

          if (stillMoving || isTransitioning) {
            markDirty();
          }
        }
      });
    }
  }, []);

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
    renderer.toneMappingExposure = 1.22;
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070a12');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    camera.position.set(115, 132, 155);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 850;
    controls.minDistance = 14;
    controls.target.set(0, 45, 0);
    const cancelCameraTransition = () => {
      cameraTransitionRef.current = null;
    };
    controls.addEventListener('start', cancelCameraTransition);
    controls.addEventListener('change', markDirty);
    controlsRef.current = controls;

    // 3-point architectural studio lighting for crisp 3-value face separation
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x0b1120, 0.58);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.65);
    dirLight1.position.set(75, 150, 85);
    scene.add(dirLight1);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.62);
    rimLight.position.set(-85, 45, -75);
    scene.add(rimLight);

    const tierGroup = new THREE.Group();
    scene.add(tierGroup);
    tierHelpersRef.current = tierGroup;

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

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setIsContextLost(true);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const handleContextRestored = () => {
      setIsContextLost(false);
      markDirty();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    markDirty();

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      controls.removeEventListener('start', cancelCameraTransition);
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

  // 2. Build Fitted Tier Reference Discs & File/Module Island Baseplates
  useEffect(() => {
    if (!hasWebGL || !sceneRef.current || !tierHelpersRef.current) return;
    const tierGroup = tierHelpersRef.current;

    // Dispose prior child geometries/materials cleanly
    tierGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    tierGroup.clear();

    if (!showTierPlanes) {
      markDirty();
      return;
    }

    for (const tier of graphData.tiers) {
      const isDimmedByFilter = isolatedTier !== null && isolatedTier !== tier.tier;
      const isFocusedTier = isolatedTier === tier.tier;
      const tierRadius = tier.discRadius ?? 38;
      const tierColor = new THREE.Color(tier.color || STRATA_TIER_COLORS[tier.tier]);

      // Subtle fitted floor disc
      const discGeom = new THREE.CircleGeometry(tierRadius, 56);
      discGeom.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: tierColor,
        transparent: true,
        opacity: isDimmedByFilter ? 0.012 : isFocusedTier ? 0.075 : 0.035,
        depthWrite: false,
      });
      const discMesh = new THREE.Mesh(discGeom, discMat);
      discMesh.position.set(0, tier.yPosition - 0.15, 0);
      tierGroup.add(discMesh);

      // Crisp architectural floor perimeter ring
      const ringGeom = new THREE.RingGeometry(Math.max(0.5, tierRadius - 0.35), tierRadius, 64);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: tierColor,
        transparent: true,
        opacity: isDimmedByFilter ? 0.08 : isFocusedTier ? 0.5 : 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(0, tier.yPosition - 0.1, 0);
      tierGroup.add(ringMesh);

      // File / Module Island pads on the floor disc (kept dark so bright blocks pop forward)
      for (const cluster of tier.clusters ?? []) {
        if (cluster.nodeCount < 2) continue;
        const padGeom = new THREE.CircleGeometry(cluster.radius, 32);
        padGeom.rotateX(-Math.PI / 2);
        const padMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#0a101d'),
          transparent: true,
          opacity: isDimmedByFilter ? 0.12 : 0.72,
          depthWrite: false,
        });
        const padMesh = new THREE.Mesh(padGeom, padMat);
        padMesh.position.set(cluster.centerX, tier.yPosition - 0.06, cluster.centerZ);
        tierGroup.add(padMesh);

        const borderGeom = new THREE.RingGeometry(Math.max(0.2, cluster.radius - 0.24), cluster.radius, 36);
        borderGeom.rotateX(-Math.PI / 2);
        const borderMat = new THREE.MeshBasicMaterial({
          color: isFocusedTier ? tierColor : new THREE.Color('#334155'),
          transparent: true,
          opacity: isDimmedByFilter ? 0.1 : 0.6,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const borderMesh = new THREE.Mesh(borderGeom, borderMat);
        borderMesh.position.set(cluster.centerX, tier.yPosition - 0.04, cluster.centerZ);
        tierGroup.add(borderMesh);
      }
    }

    markDirty();
  }, [hasWebGL, graphData.tiers, isolatedTier, showTierPlanes, markDirty]);

  // 3. Build Dual Semantic Stepped InstancedMeshes, Outline Cage & Curved Edge Pool
  useEffect(() => {
    if (!hasWebGL || !sceneRef.current) return;
    const scene = sceneRef.current;

    if (classInstancedMeshRef.current) {
      scene.remove(classInstancedMeshRef.current);
      classInstancedMeshRef.current.geometry.dispose();
      (classInstancedMeshRef.current.material as THREE.Material).dispose();
      classInstancedMeshRef.current = null;
    }
    if (funcInstancedMeshRef.current) {
      scene.remove(funcInstancedMeshRef.current);
      funcInstancedMeshRef.current.geometry.dispose();
      (funcInstancedMeshRef.current.material as THREE.Material).dispose();
      funcInstancedMeshRef.current = null;
    }
    if (nodeEdgesLineRef.current) {
      scene.remove(nodeEdgesLineRef.current);
      nodeEdgesLineRef.current.geometry.dispose();
      (nodeEdgesLineRef.current.material as THREE.Material).dispose();
      nodeEdgesLineRef.current = null;
    }
    if (edgesLineRef.current) {
      scene.remove(edgesLineRef.current);
      edgesLineRef.current.geometry.dispose();
      (edgesLineRef.current.material as THREE.Material).dispose();
      edgesLineRef.current = null;
    }

    classOutlineLocalRef.current = new Float32Array(0);
    funcOutlineLocalRef.current = new Float32Array(0);

    if (classNodes.length > 0) {
      // Classes: 3-part stepped square architectural monoliths (y ∈ [0, 1])
      const classGeom = createClassMonolithGeometry();
      classOutlineLocalRef.current = extractLocalOutlineSegments(classGeom, 24);
      const classMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.04,
        flatShading: true,
      });
      const classMesh = new THREE.InstancedMesh(classGeom, classMat, classNodes.length);
      scene.add(classMesh);
      classInstancedMeshRef.current = classMesh;
    }

    if (funcNodes.length > 0) {
      // Functions / Methods: 3-part stepped hexagonal columns (y ∈ [0, 1])
      const funcGeom = createFunctionPillarGeometry();
      funcOutlineLocalRef.current = extractLocalOutlineSegments(funcGeom, 24);
      const funcMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.44,
        metalness: 0.04,
        flatShading: true,
      });
      const funcMesh = new THREE.InstancedMesh(funcGeom, funcMat, funcNodes.length);
      scene.add(funcMesh);
      funcInstancedMeshRef.current = funcMesh;
    }

    // Batched CAD wireframe outlines across all blocks for sharp figure separation
    const classSegsPerNode = classOutlineLocalRef.current.length / 6;
    const funcSegsPerNode = funcOutlineLocalRef.current.length / 6;
    const totalOutlineSegs =
      classNodes.length * classSegsPerNode + funcNodes.length * funcSegsPerNode;
    maxOutlineSegmentsRef.current = totalOutlineSegs;

    if (totalOutlineSegs > 0) {
      const outlinePositions = new Float32Array(totalOutlineSegs * 2 * 3);
      const outlineColors = new Float32Array(totalOutlineSegs * 2 * 3);
      const outlineGeom = new THREE.BufferGeometry();
      const outPosAttr = new THREE.BufferAttribute(outlinePositions, 3);
      const outColAttr = new THREE.BufferAttribute(outlineColors, 3);
      outPosAttr.setUsage(THREE.DynamicDrawUsage);
      outColAttr.setUsage(THREE.DynamicDrawUsage);
      outlineGeom.setAttribute('position', outPosAttr);
      outlineGeom.setAttribute('color', outColAttr);
      outlineGeom.setDrawRange(0, 0);

      const outlineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const outlineLines = new THREE.LineSegments(outlineGeom, outlineMat);
      outlineLines.frustumCulled = false;
      scene.add(outlineLines);
      nodeEdgesLineRef.current = outlineLines;
    }

    // Preallocate LineSegments geometry for multi-segment curved arcs
    let totalSegments = 0;
    for (const edge of graphData.edges) {
      totalSegments += Math.max(1, (edge.points?.length ?? 2) - 1);
    }
    maxEdgeSegmentsRef.current = totalSegments;

    if (totalSegments > 0) {
      const positions = new Float32Array(totalSegments * 2 * 3);
      const colors = new Float32Array(totalSegments * 2 * 3);
      const edgeGeometry = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      const colAttr = new THREE.BufferAttribute(colors, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      colAttr.setUsage(THREE.DynamicDrawUsage);
      edgeGeometry.setAttribute('position', posAttr);
      edgeGeometry.setAttribute('color', colAttr);
      edgeGeometry.setDrawRange(0, 0);

      const edgeMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      const edgesLine = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edgesLine.frustumCulled = false;
      scene.add(edgesLine);
      edgesLineRef.current = edgesLine;
    }

    markDirty();
  }, [hasWebGL, classNodes, funcNodes, graphData.edges, markDirty]);

  // 4. Dynamic Building Heights, 1-Hop Illumination & Curved Directional Edge Filtering
  useEffect(() => {
    if (!hasWebGL) return;

    const focusNodeId = selectedChunkId || hoveredNodeId || null;
    const callerNeighborIds = new Set<string>();
    const calleeNeighborIds = new Set<string>();

    if (focusNodeId) {
      for (const edge of graphData.edges) {
        if (edge.target === focusNodeId) callerNeighborIds.add(edge.source);
        if (edge.source === focusNodeId) calleeNeighborIds.add(edge.target);
      }
    }

    const hasHighlights = Boolean(highlightedChunkIds && highlightedChunkIds.size > 0);
    const hasSelection = Boolean(selectedChunkId);
    const hasFilterContext = hasHighlights || hasSelection || Boolean(hoveredNodeId);

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    const dimSlateTarget = new THREE.Color('#475569');
    const outlineColor = new THREE.Color();
    const nextHeightMap = new Map<string, number>();

    const outPosAttr = nodeEdgesLineRef.current
      ? (nodeEdgesLineRef.current.geometry.getAttribute('position') as THREE.BufferAttribute)
      : null;
    const outColAttr = nodeEdgesLineRef.current
      ? (nodeEdgesLineRef.current.geometry.getAttribute('color') as THREE.BufferAttribute)
      : null;
    const outPosArr = outPosAttr ? (outPosAttr.array as Float32Array) : null;
    const outColArr = outColAttr ? (outColAttr.array as Float32Array) : null;
    let outlineSegCursor = 0;
    const maxOutlineSegs = maxOutlineSegmentsRef.current;

    const updateBatch = (
      nodes: StrataNode[],
      mesh: THREE.InstancedMesh | null,
      localOutline: Float32Array
    ) => {
      if (!mesh) return;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isSelected = selectedChunkId === node.id;
        const isHovered = hoveredNodeId === node.id;
        const isHighlighted = highlightedChunkIds?.has(node.id) ?? false;
        const isOneHop = callerNeighborIds.has(node.id) || calleeNeighborIds.has(node.id);
        const matchesTier = isolatedTier === null || node.tier === isolatedTier;
        const tierHex = node.color || STRATA_TIER_COLORS[node.tier] || '#818cf8';

        const { widthScale, heightScale } = computeBuildingDimensions(
          node,
          isSelected || isHovered,
          isHighlighted,
          isOneHop
        );
        const finalH = matchesTier ? heightScale : Math.max(0.45, heightScale * 0.45);
        const finalW = matchesTier ? widthScale : widthScale * 0.72;
        nextHeightMap.set(node.id, finalH);

        // Stepped monoliths & pillars have y ∈ [0, 1], so node.y sits flush on the tier disc
        dummy.position.set(node.x, node.y, node.z);
        dummy.scale.set(finalW, finalH, finalW);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        if (!matchesTier && !isSelected && !isHighlighted) {
          tempColor.set('#1e293b');
          outlineColor.set('#334155');
        } else if (isSelected) {
          tempColor.set('#ffffff');
          outlineColor.set('#38bdf8');
        } else if (isHovered && !hasSelection) {
          tempColor.set('#f8fafc');
          outlineColor.set('#ffffff');
        } else if (isHighlighted) {
          tempColor.set('#38bdf8'); // Electric Sky reserved exclusively for AI citations
          outlineColor.set('#bae6fd');
        } else if (isOneHop) {
          tempColor.set(tierHex);
          outlineColor.set(tierHex).lerp(new THREE.Color('#ffffff'), 0.45);
        } else if (dimUnfocused && hasFilterContext) {
          // Option 1: Tier-tinted legible slate instead of disappearing into dark canvas
          tempColor.set(tierHex).lerp(dimSlateTarget, 0.64);
          outlineColor.set(tierHex).lerp(new THREE.Color('#94a3b8'), 0.55);
        } else {
          tempColor.set(tierHex);
          outlineColor.set(tierHex).lerp(new THREE.Color('#f8fafc'), 0.45);
        }

        mesh.setColorAt(i, tempColor);

        // Stamp crisp wireframe outline edges for every building silhouette
        if (outPosArr && outColArr && localOutline.length > 0 && matchesTier) {
          for (let k = 0; k < localOutline.length && outlineSegCursor < maxOutlineSegs; k += 6) {
            const baseIdx = outlineSegCursor * 6;
            outPosArr[baseIdx] = localOutline[k] * finalW + node.x;
            outPosArr[baseIdx + 1] = localOutline[k + 1] * finalH + node.y;
            outPosArr[baseIdx + 2] = localOutline[k + 2] * finalW + node.z;

            outPosArr[baseIdx + 3] = localOutline[k + 3] * finalW + node.x;
            outPosArr[baseIdx + 4] = localOutline[k + 4] * finalH + node.y;
            outPosArr[baseIdx + 5] = localOutline[k + 5] * finalW + node.z;

            outColArr[baseIdx] = outlineColor.r;
            outColArr[baseIdx + 1] = outlineColor.g;
            outColArr[baseIdx + 2] = outlineColor.b;
            outColArr[baseIdx + 3] = outlineColor.r;
            outColArr[baseIdx + 4] = outlineColor.g;
            outColArr[baseIdx + 5] = outlineColor.b;

            outlineSegCursor++;
          }
        }
      }

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateBatch(classNodes, classInstancedMeshRef.current, classOutlineLocalRef.current);
    updateBatch(funcNodes, funcInstancedMeshRef.current, funcOutlineLocalRef.current);
    nodeHeightMapRef.current = nextHeightMap;

    if (nodeEdgesLineRef.current && outPosAttr && outColAttr) {
      nodeEdgesLineRef.current.geometry.setDrawRange(0, outlineSegCursor * 2);
      outPosAttr.needsUpdate = true;
      outColAttr.needsUpdate = true;
    }

    // Populate directional curved arcs for active EdgeMode
    if (edgesLineRef.current && maxEdgeSegmentsRef.current > 0) {
      const nodeLookup = new Map(graphData.nodes.map((n) => [n.id, n]));
      const posAttr = edgesLineRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = edgesLineRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;

      const cSrc = new THREE.Color();
      const cTgt = new THREE.Color();
      const cMix = new THREE.Color();

      let segCursor = 0;
      const maxSegs = maxEdgeSegmentsRef.current;

      for (const edge of graphData.edges) {
        const srcNode = nodeLookup.get(edge.source);
        const tgtNode = nodeLookup.get(edge.target);
        if (!srcNode || !tgtNode) continue;

        if (isolatedTier !== null && srcNode.tier !== isolatedTier && tgtNode.tier !== isolatedTier) {
          continue;
        }

        const touchesFocus = Boolean(focusNodeId && (edge.source === focusNodeId || edge.target === focusNodeId));
        const touchesCited = Boolean(
          highlightedChunkIds && (highlightedChunkIds.has(edge.source) || highlightedChunkIds.has(edge.target))
        );
        const isCrossTier = edge.sourceTier !== edge.targetTier;
        const isActive = touchesFocus || touchesCited;

        let shouldDraw = true;
        if (edgeMode === 'focused') {
          if (focusNodeId || hasHighlights) {
            shouldDraw = isActive;
          } else {
            shouldDraw = isCrossTier;
          }
        } else if (edgeMode === 'cross-tier') {
          shouldDraw = isCrossTier || isActive;
        }

        if (!shouldDraw) continue;

        // Assign directional gradient colors: Caller -> Callee (or Violet -> Lavender for Inheritance)
        if (edge.edgeType === 'inherits') {
          if (focusNodeId && (edge.source === focusNodeId || edge.target === focusNodeId)) {
            cSrc.set('#c4b5fd');
            cTgt.set('#a855f7');
          } else if (touchesCited) {
            cSrc.set('#a855f7');
            cTgt.set('#38bdf8');
          } else {
            cSrc.set('#6d28d9');
            cTgt.set('#312e81');
          }
        } else if (focusNodeId && edge.source === focusNodeId) {
          // Outgoing from focus: White -> Electric Sky
          cSrc.set('#ffffff');
          cTgt.set('#38bdf8');
        } else if (focusNodeId && edge.target === focusNodeId) {
          // Incoming into focus: Emerald -> White
          cSrc.set('#34d399');
          cTgt.set('#ffffff');
        } else if (touchesCited) {
          cSrc.set(srcNode.color || '#94a3b8');
          cTgt.set('#38bdf8');
        } else {
          // Calm directional resting gradient (source tier tint -> muted callee slate)
          cSrc.set('#475569');
          cTgt.set('#1e293b');
        }

        const srcH = nextHeightMap.get(srcNode.id) ?? 1.8;
        const tgtH = nextHeightMap.get(tgtNode.id) ?? 1.8;
        const ySrcOffset = srcH * 0.72;
        const yTgtOffset = tgtH * 0.72;

        const pts = edge.points && edge.points.length >= 2 ? edge.points : [edge.sourcePosition, edge.targetPosition];
        const steps = pts.length - 1;

        for (let k = 0; k < steps && segCursor < maxSegs; k++) {
          const t0 = k / steps;
          const t1 = (k + 1) / steps;
          const p0 = pts[k];
          const p1 = pts[k + 1];

          const baseIdx = segCursor * 6;
          posArr[baseIdx] = p0[0];
          posArr[baseIdx + 1] = p0[1] + ySrcOffset * (1 - t0) + yTgtOffset * t0;
          posArr[baseIdx + 2] = p0[2];

          posArr[baseIdx + 3] = p1[0];
          posArr[baseIdx + 4] = p1[1] + ySrcOffset * (1 - t1) + yTgtOffset * t1;
          posArr[baseIdx + 5] = p1[2];

          cMix.lerpColors(cSrc, cTgt, t0);
          colArr[baseIdx] = cMix.r;
          colArr[baseIdx + 1] = cMix.g;
          colArr[baseIdx + 2] = cMix.b;

          cMix.lerpColors(cSrc, cTgt, t1);
          colArr[baseIdx + 3] = cMix.r;
          colArr[baseIdx + 4] = cMix.g;
          colArr[baseIdx + 5] = cMix.b;

          segCursor++;
        }
      }

      edgesLineRef.current.geometry.setDrawRange(0, segCursor * 2);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Update projected 2D node pins for selected/cited symbols
    labelTargetsRef.current = graphData.nodes.filter(
      (n) => selectedChunkId === n.id || Boolean(highlightedChunkIds?.has(n.id))
    );

    markDirty();
  }, [
    hasWebGL,
    graphData.nodes,
    graphData.edges,
    classNodes,
    funcNodes,
    selectedChunkId,
    hoveredNodeId,
    highlightedChunkIds,
    edgeMode,
    dimUnfocused,
    isolatedTier,
    markDirty,
  ]);

  // Smoothly focus 3D camera onto a specific node or cited source
  useEffect(() => {
    if (!hasWebGL || !focusTargetId || !cameraRef.current || !controlsRef.current) return;
    const targetNode = graphData.nodes.find((n) => n.id === focusTargetId);
    if (!targetNode) return;

    const endTarget = new THREE.Vector3(targetNode.x, targetNode.y + 2, targetNode.z);
    const endPos = new THREE.Vector3(targetNode.x + 42, targetNode.y + 34, targetNode.z + 56);
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      cameraTransitionRef.current = null;
      controlsRef.current.target.copy(endTarget);
      cameraRef.current.position.copy(endPos);
      controlsRef.current.update();
      markDirty();
      return;
    }

    cameraTransitionRef.current = {
      startTime: performance.now(),
      durationMs: 400,
      startTarget: controlsRef.current.target.clone(),
      endTarget,
      startPos: cameraRef.current.position.clone(),
      endPos,
    };
    markDirty();
  }, [hasWebGL, focusTargetId, focusNonce, graphData.nodes, markDirty]);

  // 5. Raycasting across Class & Function InstancedMeshes
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseCoords = useMemo(() => new THREE.Vector2(), []);

  const pickNodeAtPointer = useCallback(
    (clientX: number, clientY: number): { node: StrataNode; relX: number; relY: number } | null => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return null;

      const meshes: THREE.Object3D[] = [];
      if (classInstancedMeshRef.current) meshes.push(classInstancedMeshRef.current);
      if (funcInstancedMeshRef.current) meshes.push(funcInstancedMeshRef.current);
      if (meshes.length === 0) return null;

      const rect = canvas.getBoundingClientRect();
      mouseCoords.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoords.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseCoords, camera);
      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length === 0 || intersects[0].instanceId === undefined) return null;

      const hit = intersects[0];
      const hitNode =
        hit.object === classInstancedMeshRef.current
          ? classNodesRef.current[hit.instanceId!]
          : funcNodesRef.current[hit.instanceId!];

      if (!hitNode) return null;
      return {
        node: hitNode,
        relX: clientX - rect.left,
        relY: clientY - rect.top,
      };
    },
    [raycaster, mouseCoords]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const picked = pickNodeAtPointer(e.clientX, e.clientY);
      if (picked && onSelectNode) {
        onSelectNode(picked.node.id);
      }
    },
    [pickNodeAtPointer, onSelectNode]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const picked = pickNodeAtPointer(e.clientX, e.clientY);
      if (picked) {
        setHoveredNode({
          node: picked.node,
          screenX: picked.relX,
          screenY: picked.relY,
        });
        setHoveredNodeId((prev) => (prev === picked.node.id ? prev : picked.node.id));
        canvas.style.cursor = 'pointer';
        return;
      }

      setHoveredNode(null);
      setHoveredNodeId((prev) => (prev === null ? prev : null));
      canvas.style.cursor = 'default';
    },
    [pickNodeAtPointer]
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredNode(null);
    setHoveredNodeId(null);
  }, []);

  const handleResetCamera = useCallback(() => {
    setIsolatedTier(null);
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(115, 132, 155);
    controlsRef.current.target.set(0, 45, 0);
    controlsRef.current.update();
    markDirty();
  }, [markDirty]);

  const handleToggleTierIsolation = useCallback(
    (tierNum: number) => {
      setIsolatedTier((prev) => {
        const next = prev === tierNum ? null : tierNum;
        if (next !== null && cameraRef.current && controlsRef.current) {
          const tier = graphData.tiers.find((t) => t.tier === next);
          if (tier) {
            const discR = tier.discRadius ?? 42;
            cameraTransitionRef.current = {
              startTime: performance.now(),
              durationMs: 360,
              startTarget: controlsRef.current.target.clone(),
              endTarget: new THREE.Vector3(0, tier.yPosition + 2, 0),
              startPos: cameraRef.current.position.clone(),
              endPos: new THREE.Vector3(discR * 1.15 + 22, tier.yPosition + 46, discR * 1.25 + 28),
            };
          }
        }
        return next;
      });
      markDirty();
    },
    [graphData.tiers, markDirty]
  );

  const hasFocusableNodes = useMemo(
    () =>
      graphData.nodes.some(
        (n) => selectedChunkId === n.id || Boolean(highlightedChunkIds?.has(n.id))
      ),
    [graphData.nodes, selectedChunkId, highlightedChunkIds]
  );

  const handleFocusCited = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const targets = graphData.nodes.filter(
      (n) => selectedChunkId === n.id || Boolean(highlightedChunkIds?.has(n.id))
    );
    if (targets.length === 0) return;

    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const n of targets) {
      cx += n.x;
      cy += n.y;
      cz += n.z;
    }
    cx /= targets.length;
    cy /= targets.length;
    cz /= targets.length;

    controlsRef.current.target.set(cx, cy + 2, cz);
    cameraRef.current.position.set(cx + 65, cy + 55, cz + 85);
    controlsRef.current.update();
    markDirty();
  }, [graphData.nodes, selectedChunkId, highlightedChunkIds, markDirty]);

  const visibleHeadlessNodes = useMemo(
    () =>
      isolatedTier === null
        ? graphData.nodes
        : graphData.nodes.filter((n) => n.tier === isolatedTier),
    [graphData.nodes, isolatedTier]
  );

  // Also ensure classIndexById / funcIndexById don't flag unused
  void classIndexById;
  void funcIndexById;

  // JSDOM / CI / Headless fallback when WebGL context cannot be created
  if (!hasWebGL) {
    return (
      <div
        data-testid="strata-canvas"
        className={`relative w-full h-full flex flex-col items-center justify-center bg-[#070a12] text-slate-100 p-6 select-none ${className}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-sky-400 font-semibold">
            3D Strata Architecture Canvas (Headless Mode)
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3 max-w-md text-center">
          {graphData.nodes.length} nodes · {graphData.edges.length} caller-callee edges · 4 layered tiers
        </p>

        {/* Edge Mode & Contrast Filter Controls */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
          {(['focused', 'cross-tier', 'all'] as StrataEdgeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              data-testid={`strata-edge-mode-${mode}`}
              onClick={() => setEdgeMode(mode)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                edgeMode === mode
                  ? 'border-sky-400 bg-sky-500/20 text-sky-300 font-semibold'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'focused' ? 'Focused Edges' : mode === 'cross-tier' ? 'Cross-Tier' : 'All Edges'}
            </button>
          ))}
          <button
            type="button"
            data-testid="strata-toggle-dim-btn"
            onClick={() => setDimUnfocused((prev) => !prev)}
            aria-pressed={dimUnfocused}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
              dimUnfocused
                ? 'border-sky-500/50 bg-slate-900 text-sky-300'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Focus Dim
          </button>
        </div>

        {/* Interactive Tiers List */}
        <div className="grid grid-cols-2 gap-2 max-w-lg w-full mb-4">
          {graphData.tiers.map((t) => {
            const isIsolated = isolatedTier === t.tier;
            return (
              <button
                key={t.tier}
                type="button"
                data-testid={`strata-tier-filter-${t.tier}`}
                onClick={() => handleToggleTierIsolation(t.tier)}
                aria-pressed={isIsolated}
                className={`text-left border p-2.5 rounded text-xs flex flex-col gap-0.5 cursor-pointer transition-colors ${
                  isIsolated
                    ? 'border-sky-400 bg-slate-800/90 ring-1 ring-sky-400/50'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono font-bold" style={{ color: t.color }}>
                    Tier {t.tier}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                    {t.nodeCount} nodes
                  </span>
                </div>
                <span className="font-medium text-[11px] text-slate-200">{t.name}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive node chips for testing click selection */}
        <div className="flex flex-wrap gap-1.5 max-w-lg max-h-36 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded">
          {visibleHeadlessNodes.map((node) => {
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
                    ? 'bg-[#38bdf8] text-slate-950 border-[#38bdf8] font-bold shadow-sm'
                    : isHighlighted
                    ? 'border-[#38bdf8] text-[#38bdf8] bg-sky-950/70 font-semibold ring-1 ring-sky-400/50'
                    : hasActiveHighlights
                    ? 'border-[#1e293b] text-[#64748b] bg-[#070a12] opacity-60 hover:opacity-100 hover:text-slate-100'
                    : 'border-slate-800 text-slate-300 bg-[#070a12] hover:border-sky-500/60'
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
      className={`relative w-full h-full overflow-hidden bg-[#070a12] select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full block outline-none"
      />

      {/* Floating View & Edge Filter Controls HUD */}
      <div className="absolute top-3 right-3 flex flex-wrap items-center justify-end gap-1.5 z-10 pointer-events-auto">
        <div
          role="group"
          aria-label="Edge visibility mode"
          className="inline-flex items-center rounded border border-slate-700 bg-slate-900/90 p-0.5 text-[11px] font-mono shadow-sm backdrop-blur-xs"
        >
          {(
            [
              { id: 'focused', label: 'Focused' },
              { id: 'cross-tier', label: 'Cross-Tier' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid={`strata-edge-mode-${opt.id}`}
              onClick={() => setEdgeMode(opt.id)}
              aria-pressed={edgeMode === opt.id}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                edgeMode === opt.id
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Show ${opt.label.toLowerCase()} call edges`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          data-testid="strata-toggle-labels-btn"
          onClick={() => {
            setShowLandmarks((prev) => !prev);
            markDirty();
          }}
          aria-pressed={showLandmarks}
          className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer shadow-sm ${
            showLandmarks
              ? 'border-sky-500/50 bg-slate-900/90 text-sky-300'
              : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Tier Floor & Module Island Labels"
        >
          Labels
        </button>

        <button
          type="button"
          data-testid="strata-toggle-dim-btn"
          onClick={() => {
            setDimUnfocused((prev) => !prev);
            markDirty();
          }}
          aria-pressed={dimUnfocused}
          className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer shadow-sm ${
            dimUnfocused
              ? 'border-sky-500/50 bg-slate-900/90 text-sky-300'
              : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle dimming of unreferenced background blocks when nodes are focused"
        >
          Focus Dim
        </button>

        {hasFocusableNodes && (
          <button
            type="button"
            data-testid="strata-focus-cited-btn"
            onClick={handleFocusCited}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded border border-sky-500/60 bg-slate-900/90 text-sky-400 hover:bg-sky-500 hover:text-slate-950 transition-colors cursor-pointer shadow-sm"
            title="Frame camera on highlighted/selected nodes"
          >
            Focus Cited
          </button>
        )}
        <button
          type="button"
          onClick={handleResetCamera}
          className="px-2.5 py-1 text-xs font-mono font-medium rounded border border-slate-700 bg-slate-900/90 text-slate-200 hover:border-sky-400 hover:text-sky-300 transition-colors cursor-pointer shadow-sm"
          title="Reset 3D Camera & Filters"
        >
          Reset View
        </button>
      </div>

      {/* Resting 3D Spatial Landmarks (Tier Floor Badges & Module Islands) */}
      {showLandmarks && projectedLandmarks.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {projectedLandmarks.map((lm) => (
            <div
              key={lm.id}
              style={{
                left: `${lm.x}px`,
                top: `${lm.y}px`,
                transform: 'translate(-50%, -50%)',
                borderColor: lm.kind === 'tier' && lm.color ? `${lm.color}66` : undefined,
                color: lm.kind === 'tier' && lm.color ? lm.color : undefined,
              }}
              className={`absolute px-1.5 py-0.5 rounded font-mono whitespace-nowrap backdrop-blur-xs ${
                lm.kind === 'tier'
                  ? 'text-[10px] font-bold bg-slate-950/80 border tracking-wide shadow-sm'
                  : 'text-[9px] text-slate-300 bg-slate-900/75 border border-slate-700/70'
              }`}
            >
              <span>{lm.text}</span>
              {lm.subtext && <span className="ml-1 text-slate-400 font-normal">({lm.subtext})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Projected Floating 2D Label Pins for Highlighted & Selected 3D Nodes */}
      {projectedLabels.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {projectedLabels.map((lbl) => (
            <button
              key={lbl.id}
              type="button"
              data-testid={`strata-floating-label-${lbl.id}`}
              onClick={() => onSelectNode?.(lbl.id)}
              style={{
                left: `${lbl.x}px`,
                top: `${lbl.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className={`absolute pointer-events-auto px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap shadow-md transition-colors cursor-pointer ${
                lbl.isSelected
                  ? 'bg-white text-slate-950 font-bold border border-sky-400'
                  : 'bg-slate-900/90 text-sky-300 border border-sky-500/60 hover:bg-sky-500 hover:text-slate-950'
              }`}
            >
              {lbl.identifier}
            </button>
          ))}
        </div>
      )}

      {/* Interactive Architectural Tier & Geometry Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 p-2.5 rounded bg-slate-900/90 border border-slate-800 backdrop-blur-sm z-10 pointer-events-auto text-xs font-mono">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
            Strata Tiers
          </span>
          {isolatedTier !== null && (
            <button
              type="button"
              data-testid="strata-clear-tier-filter-btn"
              onClick={() => setIsolatedTier(null)}
              className="text-[10px] text-sky-300 hover:text-white underline cursor-pointer"
            >
              All Tiers
            </button>
          )}
        </div>
        {[3, 2, 1, 0].map((tierNum) => {
          const tier = graphData.tiers.find((t) => t.tier === tierNum);
          if (!tier) return null;
          const isIsolated = isolatedTier === tierNum;
          const isDimmed = isolatedTier !== null && !isIsolated;
          return (
            <button
              key={tierNum}
              type="button"
              data-testid={`strata-tier-filter-${tierNum}`}
              onClick={() => handleToggleTierIsolation(tierNum)}
              aria-pressed={isIsolated}
              className={`flex items-center gap-2 text-[11px] rounded px-1 py-0.5 -mx-1 transition-colors cursor-pointer text-left ${
                isIsolated
                  ? 'bg-slate-800 text-white ring-1 ring-sky-400/50'
                  : isDimmed
                  ? 'text-slate-500 hover:text-slate-200'
                  : 'text-slate-200 hover:bg-slate-800/70'
              }`}
              title={`Click to ${isIsolated ? 'show all tiers' : `isolate Tier ${tier.tier}`}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                style={{ backgroundColor: tier.color }}
              />
              <span className="font-semibold" style={{ color: tier.color }}>
                T{tier.tier}:
              </span>
              <span className="truncate max-w-[175px]">{tier.name}</span>
              <span className="text-[10px] text-slate-400 ml-auto">({tier.nodeCount})</span>
            </button>
          );
        })}
        <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between gap-3 text-[9px] text-slate-400">
          <span>Square: Class · Hex: Func</span>
          <span>Height: LOC</span>
        </div>
      </div>

      {/* Hover Node Tooltip */}
      {hoveredNode && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded bg-slate-900/95 border border-sky-500/50 shadow-lg text-xs font-mono text-slate-100 backdrop-blur-md max-w-xs transition-opacity duration-75"
          style={{
            left: `${Math.min(hoveredNode.screenX + 14, (containerRef.current?.clientWidth || 500) - 230)}px`,
            top: `${Math.min(hoveredNode.screenY + 14, (containerRef.current?.clientHeight || 500) - 135)}px`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredNode.node.color }}
            />
            <span className="font-bold text-sky-300 truncate">{hoveredNode.node.identifier}</span>
          </div>
          <div className="text-[10px] text-slate-300 truncate">
            {hoveredNode.node.filePath}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-slate-400 border-t border-slate-800 pt-1">
            <span>{hoveredNode.node.astNodeType === 'ClassDef' ? 'Class' : 'Function'} · {hoveredNode.node.loc ?? 1} LOC</span>
            <span>{hoveredNode.node.inDegree ?? 0} in · {hoveredNode.node.outDegree ?? 0} out</span>
          </div>
        </div>
      )}

      {/* 3D Navigation Gesture Hint */}
      <div
        data-testid="strata-gesture-hint"
        className="absolute bottom-3 right-3 px-2 py-1 rounded bg-slate-900/85 border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-none select-none hidden sm:block backdrop-blur-xs"
      >
        Left-drag: Orbit · Right-drag: Pan · Scroll: Zoom
      </div>

      {/* WebGL Context Suspended / Lost Overlay */}
      {isContextLost && (
        <div
          data-testid="strata-context-lost-overlay"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#070a12]/90 text-center p-4 font-mono select-none"
        >
          <span className="text-amber-400 text-sm font-semibold mb-1">GPU Context Suspended</span>
          <span className="text-slate-300 text-xs max-w-sm mb-3">
            The browser reclaimed WebGL resources (e.g. system sleep or driver reset). Restoring scene...
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded bg-slate-900 border border-sky-400 text-sky-400 text-xs hover:bg-sky-500 hover:text-slate-950 transition-colors cursor-pointer"
          >
            Reload View
          </button>
        </div>
      )}
    </div>
  );
};
