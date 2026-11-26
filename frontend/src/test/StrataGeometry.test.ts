import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createClassMonolithGeometry,
  createFunctionPillarGeometry,
  extractLocalOutlineSegments,
} from '../components/strata/strataGeometry';

describe('StrataGeometry Architectural Builders', () => {
  it('creates normalized unit-height ClassMonolith geometry (y in [0, 1]) with crown brighter than plinth', () => {
    const geom = createClassMonolithGeometry();
    geom.computeBoundingBox();

    expect(geom.boundingBox).not.toBeNull();
    expect(geom.boundingBox!.min.y).toBeCloseTo(0, 4);
    expect(geom.boundingBox!.max.y).toBeCloseTo(1, 4);

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute;
    expect(colAttr).toBeDefined();
    expect(colAttr.count).toBe(posAttr.count);

    let maxRoofShade = 0;
    let minPlinthShade = Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const r = colAttr.getX(i);
      if (y > 0.99) maxRoofShade = Math.max(maxRoofShade, r);
      if (y < 0.15) minPlinthShade = Math.min(minPlinthShade, r);
    }

    expect(maxRoofShade).toBeGreaterThan(1.2);
    expect(minPlinthShade).toBeLessThan(0.7);

    geom.dispose();
  });

  it('creates normalized unit-height FunctionPillar geometry (y in [0, 1]) with distinct crown and plinth shading', () => {
    const geom = createFunctionPillarGeometry();
    geom.computeBoundingBox();

    expect(geom.boundingBox).not.toBeNull();
    expect(geom.boundingBox!.min.y).toBeCloseTo(0, 4);
    expect(geom.boundingBox!.max.y).toBeCloseTo(1, 4);

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute;

    let maxRoofShade = 0;
    let minPlinthShade = Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const r = colAttr.getX(i);
      if (y > 0.99) maxRoofShade = Math.max(maxRoofShade, r);
      if (y < 0.13) minPlinthShade = Math.min(minPlinthShade, r);
    }

    expect(maxRoofShade).toBeGreaterThan(1.2);
    expect(minPlinthShade).toBeLessThan(0.7);

    geom.dispose();
  });

  it('extracts finite local wireframe outline segments excluding ground-plane z-fighting edges', () => {
    const geom = createClassMonolithGeometry();
    const segments = extractLocalOutlineSegments(geom, 24);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.length % 6).toBe(0);

    for (let i = 0; i < segments.length; i += 6) {
      const y0 = segments[i + 1];
      const y1 = segments[i + 4];
      expect(Number.isFinite(y0)).toBe(true);
      expect(Number.isFinite(y1)).toBe(true);
      // Should never keep edges sitting entirely on y = 0 floor
      expect(y0 < 0.005 && y1 < 0.005).toBe(false);
    }

    geom.dispose();
  });
});
