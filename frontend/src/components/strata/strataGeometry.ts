import * as THREE from 'three';

interface GeometryPartSpec {
  geometry: THREE.BufferGeometry;
  yOffset: number;
  sideBrightness: number;
  topBrightness: number;
  bottomBrightness: number;
}

/**
 * Converts a primitive into non-indexed triangles, positions it with yOffset,
 * and bakes per-vertex luminance multipliers so InstancedMesh multiplies
 * vertexColor * instanceColor cleanly in a single draw call.
 */
function buildColoredPart(spec: GeometryPartSpec): THREE.BufferGeometry {
  const geom = spec.geometry.index ? spec.geometry.toNonIndexed() : spec.geometry.clone();
  geom.translate(0, spec.yOffset, 0);
  geom.computeVertexNormals();

  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geom.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const ny = normAttr.getY(i);
    let shade = spec.sideBrightness;
    if (ny > 0.65) {
      shade = spec.topBrightness;
    } else if (ny < -0.65) {
      shade = spec.bottomBrightness;
    }
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

/**
 * Merges multiple non-indexed colored BufferGeometries into a single BufferGeometry
 * normalized to base Y = 0 and total height = 1.
 */
function mergeColoredParts(parts: GeometryPartSpec[]): THREE.BufferGeometry {
  const prepared = parts.map((p) => buildColoredPart(p));
  let totalVertices = 0;
  for (const g of prepared) {
    totalVertices += g.getAttribute('position').count;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const colors = new Float32Array(totalVertices * 3);

  let offset = 0;
  for (const g of prepared) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const norm = g.getAttribute('normal') as THREE.BufferAttribute;
    const col = g.getAttribute('color') as THREE.BufferAttribute;

    positions.set(pos.array as Float32Array, offset * 3);
    normals.set(norm.array as Float32Array, offset * 3);
    colors.set(col.array as Float32Array, offset * 3);

    offset += pos.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Creates a 3-part stepped square monolith for ClassDef symbols (y ∈ [0, 1]).
 * Base plinth anchors onto the module pad, recessed shaft carries tier hue,
 * and wide beveled crown gleams on top for strong 3-value architectural contrast.
 */
export function createClassMonolithGeometry(): THREE.BufferGeometry {
  return mergeColoredParts([
    {
      // Anchored plinth (y: 0.00 -> 0.14)
      geometry: new THREE.BoxGeometry(3.75, 0.14, 3.75),
      yOffset: 0.07,
      sideBrightness: 0.56,
      topBrightness: 0.78,
      bottomBrightness: 0.45,
    },
    {
      // Recessed main architectural shaft (y: 0.14 -> 0.88)
      geometry: new THREE.BoxGeometry(3.12, 0.74, 3.12),
      yOffset: 0.51,
      sideBrightness: 0.94,
      topBrightness: 1.0,
      bottomBrightness: 0.7,
    },
    {
      // Stepped architectural crown cap (y: 0.88 -> 1.00)
      geometry: new THREE.BoxGeometry(3.48, 0.12, 3.48),
      yOffset: 0.94,
      sideBrightness: 1.08,
      topBrightness: 1.32,
      bottomBrightness: 0.78,
    },
  ]);
}

/**
 * Creates a 3-part stepped hexagonal pillar for FunctionDef / Method symbols (y ∈ [0, 1]).
 * Compact hex base + subtly tapered 6-sided column + bright crown cap.
 */
export function createFunctionPillarGeometry(): THREE.BufferGeometry {
  return mergeColoredParts([
    {
      // Hex pedestal plinth (y: 0.00 -> 0.12)
      geometry: new THREE.CylinderGeometry(1.52, 1.66, 0.12, 6),
      yOffset: 0.06,
      sideBrightness: 0.56,
      topBrightness: 0.78,
      bottomBrightness: 0.45,
    },
    {
      // Tapered hexagonal shaft (y: 0.12 -> 0.88)
      geometry: new THREE.CylinderGeometry(1.2, 1.38, 0.76, 6),
      yOffset: 0.5,
      sideBrightness: 0.94,
      topBrightness: 1.0,
      bottomBrightness: 0.7,
    },
    {
      // Crisp overhanging hex cap (y: 0.88 -> 1.00)
      geometry: new THREE.CylinderGeometry(1.3, 1.42, 0.12, 6),
      yOffset: 0.94,
      sideBrightness: 1.1,
      topBrightness: 1.3,
      bottomBrightness: 0.78,
    },
  ]);
}

/**
 * Extracts crisp architectural outline line segments (x0,y0,z0,x1,y1,z1...)
 * in unit geometry space, filtering ground-plane edges to avoid disc z-fighting.
 */
export function extractLocalOutlineSegments(
  geometry: THREE.BufferGeometry,
  thresholdAngle: number = 24
): Float32Array {
  const edgesGeom = new THREE.EdgesGeometry(geometry, thresholdAngle);
  const posAttr = edgesGeom.getAttribute('position') as THREE.BufferAttribute;
  const raw = posAttr.array as Float32Array;

  const kept: number[] = [];
  for (let i = 0; i < raw.length; i += 6) {
    const y0 = raw[i + 1];
    const y1 = raw[i + 4];
    // Skip edges resting flush on y=0 disc surface
    if (y0 < 0.005 && y1 < 0.005) {
      continue;
    }
    kept.push(raw[i], y0, raw[i + 2], raw[i + 3], y1, raw[i + 5]);
  }

  edgesGeom.dispose();
  return new Float32Array(kept);
}
