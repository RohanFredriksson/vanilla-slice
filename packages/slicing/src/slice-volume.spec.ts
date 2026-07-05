import { describe, it, expect } from 'vitest';
import { Vec3 } from '@vanilla-slice/math';
import { signedDistanceToPoint } from '@vanilla-slice/geometry';
import { createSpatialHash, insert } from '@vanilla-slice/spatial';
import {
  createSliceVolume,
  sliceVolumeFromSwipe,
  sliceIntersectsSphere,
  filterSliceCandidates,
  querySliceCandidates,
} from './slice-volume';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';

describe('slice volume', () => {
  it('builds a plane spanned by the swipe and view directions', () => {
    // Horizontal swipe along X, camera looking down -Z => cut plane normal +Y.
    const volume = sliceVolumeFromSwipe([-1, 0, 0], [1, 0, 0], [0, 0, -1]);
    expect(Math.abs(volume.plane.normal[1])).toBeCloseTo(1, 10);
    expect(volume.center).toEqual([0, 0, 0]);
    expect(volume.radius).toBeCloseTo(1, 10);
    // A point on the swipe line lies on the plane.
    expect(signedDistanceToPoint(volume.plane, [1, 0, 0])).toBeCloseTo(0, 10);
  });

  it('accepts spheres that cross the plane within the region', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);
    // On the plane, inside the region.
    expect(sliceIntersectsSphere(volume, [0, 0, 0], 0.5)).toBe(true);
    // Crosses the plane (|dist| 0.3 < radius 0.5), inside region.
    expect(sliceIntersectsSphere(volume, [0.3, 0, 0], 0.5)).toBe(true);
  });

  it('rejects spheres that miss the plane or fall outside the region', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);
    // Too far from the plane to cross it.
    expect(sliceIntersectsSphere(volume, [5, 0, 0], 0.5)).toBe(false);
    // On the plane but outside the bounded region.
    expect(sliceIntersectsSphere(volume, [0, 10, 0], 0.5)).toBe(false);
  });

  it('filters a candidate list', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);
    const ids = filterSliceCandidates(volume, [
      { id: 1, center: [0, 0, 0], radius: 0.5 },
      { id: 2, center: [10, 0, 0], radius: 0.5 },
      { id: 3, center: [0, 1, 0], radius: 0.5 },
    ]);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
    expect(ids).not.toContain(2);
  });

  it('broad-phase queries a spatial hash for candidates', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, { min: [-0.4, -0.4, -0.4], max: [0.4, 0.4, 0.4] });
    insert(hash, 2, { min: [9.6, -0.4, -0.4], max: [10.4, 0.4, 0.4] });
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 1.5);
    const candidates = querySliceCandidates(hash, volume);
    expect(candidates).toContain(1);
    expect(candidates).not.toContain(2);
  });

  it('clones the center so the volume is independent of the input', () => {
    const plane = createPlane();
    const center = Vec3.fromValues(1, 2, 3);
    const volume = createSliceVolume(plane, center, 1);
    center[0] = 99;
    expect(volume.center[0]).toBe(1);
  });
});
