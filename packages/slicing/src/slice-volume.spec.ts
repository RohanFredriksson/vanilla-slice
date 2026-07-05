import { describe, it, expect } from 'vitest';
import { Vec3 } from '@vanilla-slice/math';
import { signedDistanceToPoint } from '@vanilla-slice/geometry';
import { createSpatialHash, insert } from '@vanilla-slice/spatial';
import {
  createSliceVolume,
  sliceVolume,
  sphereRegion,
  cylinderRegion,
  boxRegion,
  unboundedRegion,
  regionContains,
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
    expect(volume.region.kind).toBe('sphere');
    expect(volume.region).toMatchObject({ center: [0, 0, 0], radius: 1 });
    // A point on the swipe line lies on the plane.
    expect(signedDistanceToPoint(volume.plane, [1, 0, 0])).toBeCloseTo(0, 10);
  });

  it('builds a view-aligned cylinder region when requested', () => {
    const volume = sliceVolumeFromSwipe([-1, 0, 0], [1, 0, 0], [0, 0, -1], 1.2, {
      extendAlongView: true,
    });
    expect(volume.region.kind).toBe('cylinder');
    if (volume.region.kind === 'cylinder') {
      expect(volume.region.axis).toEqual([0, 0, -1]);
      expect(volume.region.radius).toBeCloseTo(1.2, 10);
    }
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
    const region = volume.region;
    expect(region.kind === 'sphere' && region.center[0]).toBe(1);
  });
});

describe('slice regions', () => {
  const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);

  it('cylinder ignores displacement along its axis but bounds the radius', () => {
    const volume = sliceVolume(plane, cylinderRegion([0, 0, 0], [0, 0, 1], 1));
    // Far along the axis (z) but on the plane => still contained.
    expect(sliceIntersectsSphere(volume, [0, 0, 50], 0.2)).toBe(true);
    // Off-axis beyond the radius => rejected.
    expect(sliceIntersectsSphere(volume, [5, 0, 0], 0.2)).toBe(false);
  });

  it('cylinder halfLength bounds the axis', () => {
    const region = cylinderRegion([0, 0, 0], [0, 0, 1], 1, 2);
    expect(regionContains(region, [0, 0, 1], 0.2)).toBe(true);
    expect(regionContains(region, [0, 0, 5], 0.2)).toBe(false);
  });

  it('box contains points within its (optionally oriented) extents', () => {
    const region = boxRegion([0, 0, 0], [1, 2, 3]);
    expect(regionContains(region, [0.9, 1.9, 2.9], 0)).toBe(true);
    expect(regionContains(region, [1.5, 0, 0], 0)).toBe(false);
    // A 90° turn about z aligns the box's local x-axis (half-extent 1) with
    // world y, and its local y-axis (half-extent 2) with world x.
    const turned = boxRegion([0, 0, 0], [1, 2, 3], [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    expect(regionContains(turned, [1.5, 0, 0], 0)).toBe(true); // within rotated extent (2)
    expect(regionContains(turned, [0, 1.5, 0], 0)).toBe(false); // beyond rotated extent (1)
  });

  it('unbounded region contains everything', () => {
    expect(regionContains(unboundedRegion(), [1000, -1000, 0], 0)).toBe(true);
  });

  it('broad-phase matches each region shape', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, { min: [-0.4, -0.4, -0.4], max: [0.4, 0.4, 0.4] });
    insert(hash, 2, { min: [-0.4, -0.4, 39.6], max: [0.4, 0.4, 40.4] }); // far along z
    // A sphere at the origin misses the distant object...
    const sphere = sliceVolume(plane, sphereRegion([0, 0, 0], 1.5));
    expect(querySliceCandidates(hash, sphere)).not.toContain(2);
    // ...but a z-cylinder finds it (unbounded axis scans all entities).
    const cyl = sliceVolume(plane, cylinderRegion([0, 0, 0], [0, 0, 1], 1.5));
    const found = querySliceCandidates(hash, cyl);
    expect(found).toContain(1);
    expect(found).toContain(2);
    // Unbounded returns all tracked entities.
    const all = querySliceCandidates(hash, sliceVolume(plane, unboundedRegion()));
    expect(all).toContain(1);
    expect(all).toContain(2);
  });
});
