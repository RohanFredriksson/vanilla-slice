import { describe, it, expect } from 'vitest';
import { createBox } from './primitives';
import { createMesh, vertexCount } from './mesh';
import { splitMeshByPlane } from './split';
import {
  computeConvexHull,
  convexHullFromPoints,
  hullFromConvexMesh,
  translateHull,
} from './hull';
import type { ConvexHull } from './hull';

/** Max signed distance of any point in front of any hull face (<= eps if inside). */
function maxOutside(hull: ConvexHull, points: number[]): number {
  let worst = -Infinity;
  for (const face of hull.faces) {
    const [ia] = face.indices;
    const ax = hull.vertices[ia * 3]!;
    const ay = hull.vertices[ia * 3 + 1]!;
    const az = hull.vertices[ia * 3 + 2]!;
    for (let i = 0; i < points.length; i += 3) {
      const d =
        face.normal[0] * (points[i]! - ax) +
        face.normal[1] * (points[i + 1]! - ay) +
        face.normal[2] * (points[i + 2]! - az);
      if (d > worst) {
        worst = d;
      }
    }
  }
  return worst;
}

describe('convex hull', () => {
  it('hulls a box into 8 vertices and 12 triangles', () => {
    const box = createBox(2, 2, 2);
    const hull = computeConvexHull(box);
    expect(hull.vertices.length / 3).toBe(8);
    expect(hull.faces.length).toBe(12);
    // No original point lies outside the hull.
    expect(maxOutside(hull, box.positions)).toBeLessThan(1e-6);
  });

  it('produces outward-facing unit normals', () => {
    const hull = computeConvexHull(createBox(1, 1, 1));
    for (const face of hull.faces) {
      const len = Math.hypot(...face.normal);
      expect(len).toBeCloseTo(1);
      // Box centered at origin: outward normal points away from center.
      const [ia] = face.indices;
      const dot =
        face.normal[0] * hull.vertices[ia * 3]! +
        face.normal[1] * hull.vertices[ia * 3 + 1]! +
        face.normal[2] * hull.vertices[ia * 3 + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('discards interior points', () => {
    // Cube corners plus a point at the center; center must be dropped.
    const points: [number, number, number][] = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
      [0, 0, 0],
    ];
    const hull = convexHullFromPoints(points);
    expect(hull.vertices.length / 3).toBe(8);
  });

  it('hulls a tetrahedron into 4 faces', () => {
    const points: [number, number, number][] = [
      [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    ];
    const hull = convexHullFromPoints(points);
    expect(hull.vertices.length / 3).toBe(4);
    expect(hull.faces.length).toBe(4);
  });

  it('returns a faceless hull for coplanar points', () => {
    const points: [number, number, number][] = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    ];
    const hull = convexHullFromPoints(points);
    expect(hull.faces).toEqual([]);
    expect(hull.vertices.length / 3).toBe(4);
  });

  it('ignores mesh indices and duplicate vertices', () => {
    // Two coincident corners collapse to one hull vertex.
    const mesh = createMesh(
      [
        -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
        -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
        -1, -1, -1, // duplicate of vertex 0
      ],
      [],
    );
    expect(vertexCount(mesh)).toBe(9);
    const hull = computeConvexHull(mesh);
    expect(hull.vertices.length / 3).toBe(8);
  });

  it('translates hull vertices in place', () => {
    const hull = convexHullFromPoints([
      [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    ]);
    const returned = translateHull(hull, [10, 0, 0]);
    expect(returned).toBe(hull);
    for (let i = 0; i < hull.vertices.length; i += 3) {
      expect(hull.vertices[i]).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('hullFromConvexMesh', () => {
  it('matches computeConvexHull on a box (8 verts, 6 polygons, contains all points)', () => {
    const box = createBox(2, 2, 2);
    const fast = hullFromConvexMesh(box);
    const full = computeConvexHull(box);
    expect(fast.vertices.length / 3).toBe(8);
    expect(fast.faces.length).toBe(full.faces.length); // 12 triangles
    expect(fast.polygons.length).toBe(6); // one quad per box face
    // Every box vertex lies inside (on) the fast hull.
    expect(maxOutside(fast, box.positions)).toBeLessThan(1e-6);
  });

  it('produces outward-facing unit normals', () => {
    const hull = hullFromConvexMesh(createBox(1, 1, 1));
    for (const face of hull.faces) {
      expect(Math.hypot(...face.normal)).toBeCloseTo(1);
      const [ia] = face.indices;
      const dot =
        face.normal[0] * hull.vertices[ia * 3]! +
        face.normal[1] * hull.vertices[ia * 3 + 1]! +
        face.normal[2] * hull.vertices[ia * 3 + 2]!;
      expect(dot).toBeGreaterThan(0); // box centered at origin
    }
  });

  it('builds a valid convex hull from a clipped (still convex) fragment', () => {
    // Cut a box; the front piece is convex — the fast path must contain it.
    const { front } = splitMeshByPlane(
      createBox(2, 2, 2),
      { normal: [1, 0, 0], constant: 0 },
      { cap: true },
    );
    expect(front).not.toBeNull();
    const hull = hullFromConvexMesh(front!);
    expect(hull.vertices.length / 3).toBeGreaterThanOrEqual(4);
    expect(hull.faces.length).toBeGreaterThan(0);
    expect(maxOutside(hull, front!.positions)).toBeLessThan(1e-6);
  });
});
