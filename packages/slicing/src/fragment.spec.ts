import { describe, it, expect } from 'vitest';
import { createPlane, fromNormalAndPoint, computeVolume, createBox, signedDistanceToPoint } from '@vanilla-slice/geometry';
import { createSliceVolume } from './slice-volume';
import { sliceMesh, computeCentroid } from './fragment';

describe('sliceMesh', () => {
  it('produces two fragments with opposite sides and impulses', () => {
    const box = createBox();
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);

    const fragments = sliceMesh(box, volume, { separationSpeed: 5 });
    expect(fragments).toHaveLength(2);

    const front = fragments.find((f) => f.side === 1)!;
    const back = fragments.find((f) => f.side === -1)!;
    expect(front.impulse[0]).toBeCloseTo(5, 10);
    expect(front.impulse[1]).toBeCloseTo(0, 10);
    expect(front.impulse[2]).toBeCloseTo(0, 10);
    expect(back.impulse[0]).toBeCloseTo(-5, 10);
    expect(back.impulse[1]).toBeCloseTo(0, 10);
    expect(back.impulse[2]).toBeCloseTo(0, 10);
  });

  it('keeps fragment volumes closed and conserving', () => {
    const box = createBox(2, 2, 2); // volume 8
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 3);

    const fragments = sliceMesh(box, volume);
    const total = fragments.reduce((sum, f) => sum + computeVolume(f.mesh), 0);
    expect(total).toBeCloseTo(8, 6);
  });

  it('places fragment centroids on the correct side of the plane', () => {
    const box = createBox();
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);

    const fragments = sliceMesh(box, volume);
    const front = fragments.find((f) => f.side === 1)!;
    const back = fragments.find((f) => f.side === -1)!;
    expect(signedDistanceToPoint(plane, front.centroid)).toBeGreaterThan(0);
    expect(signedDistanceToPoint(plane, back.centroid)).toBeLessThan(0);
  });

  it('returns a single fragment when the plane misses the mesh', () => {
    const box = createBox();
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [10, 0, 0]);
    const volume = createSliceVolume(plane, [10, 0, 0], 2);
    const fragments = sliceMesh(box, volume);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]!.side).toBe(-1);
  });

  it('computes the centroid of a mesh', () => {
    const box = createBox(2, 2, 2);
    expect(computeCentroid(box)).toEqual([0, 0, 0]);
  });
});
