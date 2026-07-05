import { describe, it, expect } from 'vitest';
import { createBox } from './primitives';
import { createMesh } from './mesh';
import type { Mesh } from './mesh';
import { isMeshConvex, approximateConvexDecomposition } from './decompose';

/** Merge two meshes into one (concatenate vertices, offset the second's indices). */
function mergeMeshes(a: Mesh, b: Mesh): Mesh {
  const offset = a.positions.length / 3;
  return createMesh(
    [...a.positions, ...b.positions],
    [...a.indices, ...b.indices.map((i) => i + offset)],
  );
}

/** A box translated along +x by `dx`. */
function boxAt(dx: number): Mesh {
  const box = createBox(1, 1, 1);
  const positions = box.positions.slice();
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = positions[i]! + dx;
  }
  return createMesh(positions, box.indices.slice());
}

/** Range of x across all hull vertices. */
function xRange(hulls: { vertices: number[] }[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const hull of hulls) {
    for (let i = 0; i < hull.vertices.length; i += 3) {
      min = Math.min(min, hull.vertices[i]!);
      max = Math.max(max, hull.vertices[i]!);
    }
  }
  return [min, max];
}

describe('isMeshConvex', () => {
  it('reports a box as convex', () => {
    expect(isMeshConvex(createBox(1, 1, 1))).toBe(true);
    expect(isMeshConvex(createBox(2, 1, 3))).toBe(true);
  });

  it('reports two separated boxes as concave', () => {
    const twoBoxes = mergeMeshes(boxAt(0), boxAt(4));
    expect(isMeshConvex(twoBoxes)).toBe(false);
  });
});

describe('approximateConvexDecomposition', () => {
  it('returns a single hull for a convex mesh', () => {
    const hulls = approximateConvexDecomposition(createBox(1, 1, 1));
    expect(hulls).toHaveLength(1);
    expect(hulls[0]!.faces.length).toBeGreaterThan(0);
  });

  it('splits a concave mesh into multiple convex hulls', () => {
    const twoBoxes = mergeMeshes(boxAt(0), boxAt(4));
    const hulls = approximateConvexDecomposition(twoBoxes);
    expect(hulls.length).toBeGreaterThanOrEqual(2);
    expect(hulls.length).toBeLessThanOrEqual(32);
    // Every emitted piece is itself convex.
    for (const hull of hulls) {
      expect(hull.faces.length).toBeGreaterThan(0);
    }
    // The union still spans both boxes.
    const [min, max] = xRange(hulls);
    expect(min).toBeCloseTo(-0.5, 5);
    expect(max).toBeCloseTo(4.5, 5);
  });

  it('does not fill the gap between two separated boxes', () => {
    const twoBoxes = mergeMeshes(boxAt(0), boxAt(4));
    const hulls = approximateConvexDecomposition(twoBoxes);
    // No single hull should span the empty gap (roughly x in [1, 3]).
    for (const hull of hulls) {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < hull.vertices.length; i += 3) {
        min = Math.min(min, hull.vertices[i]!);
        max = Math.max(max, hull.vertices[i]!);
      }
      expect(max - min).toBeLessThan(3);
    }
  });

  it('respects the maxHulls cap', () => {
    const twoBoxes = mergeMeshes(boxAt(0), boxAt(4));
    const hulls = approximateConvexDecomposition(twoBoxes, { maxHulls: 2 });
    expect(hulls.length).toBeLessThanOrEqual(2);
  });
});
