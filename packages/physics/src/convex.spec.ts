import { describe, it, expect } from 'vitest';
import { convexConvexContact, convexConvexManifold, convexSupport } from './convex';
import type { ConvexShape } from './convex';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

/** A box collider centered at the local origin with the given half-extents. */
function boxShape(hx: number, hy: number, hz: number): ConvexShape {
  return {
    vertices: [
      -hx, -hy, -hz, hx, -hy, -hz, hx, hy, -hz, -hx, hy, -hz,
      -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    ],
  };
}

/** A box collider that also carries its six polygon faces (for manifolds). */
function boxShapeWithFaces(hx: number, hy: number, hz: number): ConvexShape {
  return {
    ...boxShape(hx, hy, hz),
    polygons: [
      { indices: [4, 5, 6, 7], normal: [0, 0, 1] },
      { indices: [0, 3, 2, 1], normal: [0, 0, -1] },
      { indices: [1, 2, 6, 5], normal: [1, 0, 0] },
      { indices: [0, 4, 7, 3], normal: [-1, 0, 0] },
      { indices: [3, 7, 6, 2], normal: [0, 1, 0] },
      { indices: [0, 1, 5, 4], normal: [0, -1, 0] },
    ],
  };
}

/** Quaternion for a rotation of `rad` about +Z. */
function rotZ(rad: number): [number, number, number, number] {
  return [0, 0, Math.sin(rad / 2), Math.cos(rad / 2)];
}

describe('convexSupport', () => {
  it('returns the farthest world vertex along a direction', () => {
    const box = boxShape(1, 1, 1);
    const out = convexSupport(box, [5, 0, 0], IDENTITY, [1, 0, 0]);
    expect(out[0]).toBe(6);
  });

  it('accounts for orientation', () => {
    const box = boxShape(1, 0.1, 0.1);
    // Rotated 90° about Z: the local +x face points along world +y.
    const out = convexSupport(box, [0, 0, 0], rotZ(Math.PI / 2), [0, 1, 0]);
    expect(out[1]).toBeCloseTo(1, 6);
  });
});

describe('convexConvexContact (GJK + EPA)', () => {
  it('returns null for separated shapes', () => {
    const a = boxShape(1, 1, 1);
    const b = boxShape(1, 1, 1);
    expect(convexConvexContact(a, [0, 0, 0], IDENTITY, b, [3, 0, 0], IDENTITY)).toBeNull();
  });

  it('reports axis-aligned box overlap with normal and depth', () => {
    const a = boxShape(1, 1, 1);
    const b = boxShape(1, 1, 1);
    const contact = convexConvexContact(a, [0, 0, 0], IDENTITY, b, [1.5, 0, 0], IDENTITY);
    expect(contact).not.toBeNull();
    // Normal points from a toward b (+x); overlap = 2 - 1.5 = 0.5.
    expect(contact!.normal[0]).toBeCloseTo(1, 4);
    expect(Math.abs(contact!.normal[1])).toBeLessThan(1e-3);
    expect(Math.abs(contact!.normal[2])).toBeLessThan(1e-3);
    expect(contact!.depth).toBeCloseTo(0.5, 4);
  });

  it('resolves the shallowest axis for an offset overlap', () => {
    const a = boxShape(1, 1, 1);
    const b = boxShape(1, 1, 1);
    // Overlap 0.5 on x, 1.6 on y => separating axis is x.
    const contact = convexConvexContact(a, [0, 0, 0], IDENTITY, b, [1.5, 0.4, 0], IDENTITY);
    expect(contact).not.toBeNull();
    expect(Math.abs(contact!.normal[0])).toBeCloseTo(1, 3);
    expect(contact!.depth).toBeCloseTo(0.5, 3);
  });

  it('reports full penetration depth for coincident boxes', () => {
    const a = boxShape(1, 1, 1);
    const b = boxShape(1, 1, 1);
    const contact = convexConvexContact(a, [0, 0, 0], IDENTITY, b, [0, 0, 0], IDENTITY);
    expect(contact).not.toBeNull();
    expect(contact!.depth).toBeCloseTo(2, 4);
  });

  it('handles a rotated box overlap', () => {
    const a = boxShape(1, 1, 1);
    const b = boxShape(1, 1, 1);
    const contact = convexConvexContact(
      a,
      [0, 0, 0],
      IDENTITY,
      b,
      [1.6, 0, 0],
      rotZ(Math.PI / 4),
    );
    expect(contact).not.toBeNull();
    expect(contact!.depth).toBeGreaterThan(0);
    const len = Math.hypot(...contact!.normal);
    expect(len).toBeCloseTo(1, 5);
  });
});

describe('convexConvexManifold (face clipping)', () => {
  it('returns null for separated shapes', () => {
    const a = boxShapeWithFaces(1, 1, 1);
    const b = boxShapeWithFaces(1, 1, 1);
    expect(convexConvexManifold(a, [0, 0, 0], IDENTITY, b, [3, 0, 0], IDENTITY)).toBeNull();
  });

  it('produces a 4-point manifold for a face-face overlap', () => {
    const a = boxShapeWithFaces(1, 1, 1);
    const b = boxShapeWithFaces(1, 1, 1);
    const manifold = convexConvexManifold(a, [0, 0, 0], IDENTITY, b, [1.5, 0, 0], IDENTITY);
    expect(manifold).not.toBeNull();
    expect(manifold!.normal[0]).toBeCloseTo(1, 4);
    expect(manifold!.points).toHaveLength(4);
    for (const p of manifold!.points) {
      expect(p.penetration).toBeCloseTo(0.5, 4);
    }
  });

  it('produces a stable resting manifold for a vertical stack', () => {
    const a = boxShapeWithFaces(1, 1, 1);
    const b = boxShapeWithFaces(1, 1, 1);
    const manifold = convexConvexManifold(a, [0, 0, 0], IDENTITY, b, [0, 1.8, 0], IDENTITY);
    expect(manifold).not.toBeNull();
    expect(manifold!.normal[1]).toBeCloseTo(1, 4);
    expect(manifold!.points).toHaveLength(4);
    for (const p of manifold!.points) {
      expect(p.penetration).toBeCloseTo(0.2, 4);
      // Contact points lie on the shared face near y ≈ +1 / -0.8.
      expect(p.point[1]).toBeLessThan(1.01);
    }
  });

  it('caps the manifold at four points', () => {
    const a = boxShapeWithFaces(2, 2, 2);
    const b = boxShapeWithFaces(1, 1, 1);
    const manifold = convexConvexManifold(a, [0, 0, 0], IDENTITY, b, [0, 2.5, 0], IDENTITY);
    expect(manifold).not.toBeNull();
    expect(manifold!.points.length).toBeLessThanOrEqual(4);
  });

  it('falls back to a single point without polygon faces', () => {
    const a = boxShape(1, 1, 1);
    const b = boxShape(1, 1, 1);
    const manifold = convexConvexManifold(a, [0, 0, 0], IDENTITY, b, [1.5, 0, 0], IDENTITY);
    expect(manifold).not.toBeNull();
    expect(manifold!.points).toHaveLength(1);
    expect(manifold!.points[0]!.penetration).toBeCloseTo(0.5, 4);
  });
});
