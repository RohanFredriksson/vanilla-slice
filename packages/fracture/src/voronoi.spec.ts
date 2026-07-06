import { describe, it, expect } from 'vitest';
import { createBox, computeVolume, vertexCount } from '@vanilla-slice/geometry';
import { fractureMesh } from './voronoi';

/** Sum of the absolute volumes of a set of fragment meshes. */
function totalVolume(meshes: { mesh: { positions: number[]; indices: number[] } }[]): number {
  return meshes.reduce((sum, f) => sum + Math.abs(computeVolume(f.mesh)), 0);
}

describe('fractureMesh', () => {
  it('splits a box into multiple closed fragments', () => {
    const box = createBox(2, 2, 2);
    const fragments = fractureMesh(box, { count: 5, seed: 1 });
    expect(fragments.length).toBeGreaterThanOrEqual(2);
    for (const fragment of fragments) {
      expect(vertexCount(fragment.mesh)).toBeGreaterThan(0);
    }
  });

  it('approximately conserves total volume (Voronoi cells tile the mesh)', () => {
    const box = createBox(2, 2, 2);
    const boxVolume = Math.abs(computeVolume(box)); // 8
    const fragments = fractureMesh(box, { count: 6, seed: 3 });
    expect(totalVolume(fragments)).toBeCloseTo(boxVolume, 4);
  });

  it('is deterministic for a given seed', () => {
    const box = createBox(1, 1, 1);
    const a = fractureMesh(box, { count: 4, seed: 99 });
    const b = fractureMesh(box, { count: 4, seed: 99 });
    expect(a.length).toBe(b.length);
    expect(a.map((f) => f.centroid)).toEqual(b.map((f) => f.centroid));
  });

  it('accepts explicit world-space seeds', () => {
    const box = createBox(2, 2, 2);
    const fragments = fractureMesh(box, {
      seeds: [
        [-0.5, 0, 0],
        [0.5, 0, 0],
      ],
    });
    expect(fragments).toHaveLength(2);
  });

  it('maps a normalized pattern into the mesh bounds', () => {
    const box = createBox(2, 2, 2);
    const fragments = fractureMesh(box, {
      pattern: {
        seeds: [
          [0.25, 0.5, 0.5],
          [0.75, 0.5, 0.5],
        ],
      },
    });
    expect(fragments).toHaveLength(2);
  });

  it('pushes fragments radially away from the origin', () => {
    const box = createBox(2, 2, 2);
    const fragments = fractureMesh(box, {
      seeds: [
        [-0.5, 0, 0],
        [0.5, 0, 0],
      ],
      origin: [0, 0, 0],
      separationSpeed: 3,
    });
    // Each fragment's impulse points from the origin toward its centroid.
    for (const fragment of fragments) {
      const dot =
        fragment.impulse[0] * fragment.centroid[0] +
        fragment.impulse[1] * fragment.centroid[1] +
        fragment.impulse[2] * fragment.centroid[2];
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('returns nothing when fewer than two seeds are given', () => {
    const box = createBox(1, 1, 1);
    expect(fractureMesh(box, { seeds: [[0, 0, 0]] })).toEqual([]);
  });

  describe('propagation', () => {
    const box = createBox(4, 4, 4);
    const origin: [number, number, number] = [2, 2, 2]; // a corner
    const meanDistToOrigin = (
      fragments: { centroid: [number, number, number] }[],
    ): number =>
      fragments.reduce(
        (sum, f) =>
          sum +
          Math.hypot(
            f.centroid[0] - origin[0],
            f.centroid[1] - origin[1],
            f.centroid[2] - origin[2],
          ),
        0,
      ) / fragments.length;

    it('clusters fragments near the origin at low propagation, spreads them at high', () => {
      const localized = fractureMesh(box, { count: 8, seed: 5, origin, propagation: 0 });
      const spread = fractureMesh(box, { count: 8, seed: 5, origin, propagation: 1 });
      // Localized fracture keeps most fragment centroids nearer the impact origin.
      expect(meanDistToOrigin(localized)).toBeLessThan(meanDistToOrigin(spread));
    });

    it('is deterministic for a given seed and propagation', () => {
      const a = fractureMesh(box, { count: 6, seed: 8, origin, propagation: 0.3 });
      const b = fractureMesh(box, { count: 6, seed: 8, origin, propagation: 0.3 });
      expect(a.map((f) => f.centroid)).toEqual(b.map((f) => f.centroid));
    });
  });
});
