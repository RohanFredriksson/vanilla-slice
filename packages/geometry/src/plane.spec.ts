import { describe, it, expect } from 'vitest';
import { Vec3 } from '@vanilla-slice/math';
import {
  createPlane,
  fromNormalAndPoint,
  fromCoplanarPoints,
  normalizePlane,
  signedDistanceToPoint,
  classifyPoint,
  Side,
} from './plane';

describe('plane', () => {
  it('creates a default plane', () => {
    const p = createPlane();
    expect(p.normal).toEqual([0, 1, 0]);
    expect(p.constant).toBe(0);
  });

  it('builds from a normal and point with a unit normal', () => {
    const p = fromNormalAndPoint(createPlane(), [0, 0, 5], [0, 0, 2]);
    expect(Vec3.length(p.normal)).toBeCloseTo(1, 10);
    // Plane z = 2 => signed distance at origin is -2.
    expect(signedDistanceToPoint(p, [0, 0, 0])).toBeCloseTo(-2, 10);
    expect(signedDistanceToPoint(p, [0, 0, 5])).toBeCloseTo(3, 10);
  });

  it('builds from three coplanar points', () => {
    const p = fromCoplanarPoints(
      createPlane(),
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    );
    // Points on the XY plane => normal is ±Z.
    expect(Math.abs(p.normal[2])).toBeCloseTo(1, 10);
    expect(signedDistanceToPoint(p, [0, 0, 3])).toBeCloseTo(3, 10);
  });

  it('normalizes a plane with a non-unit normal', () => {
    const p = normalizePlane(createPlane(), { normal: [0, 0, 2], constant: 4 });
    expect(Vec3.length(p.normal)).toBeCloseTo(1, 10);
    expect(p.constant).toBeCloseTo(2, 10);
  });

  it('classifies points relative to the plane', () => {
    const p = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    expect(classifyPoint(p, [1, 0, 0])).toBe(Side.Front);
    expect(classifyPoint(p, [-1, 0, 0])).toBe(Side.Back);
    expect(classifyPoint(p, [0, 5, 5])).toBe(Side.On);
  });
});
