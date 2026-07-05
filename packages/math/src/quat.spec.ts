import { describe, it, expect } from 'vitest';
import * as Quat from './quat';
import * as Vec3 from './vec3';

describe('Quat', () => {
  it('creates identity', () => {
    expect(Quat.create()).toEqual([0, 0, 0, 1]);
  });

  it('identity rotation leaves a vector unchanged', () => {
    const v = Vec3.transformQuat(Vec3.create(), [1, 2, 3], Quat.create());
    expect(Vec3.equals(v, [1, 2, 3])).toBe(true);
  });

  it('rotates a vector 90° about Z', () => {
    const q = Quat.setAxisAngle(Quat.create(), [0, 0, 1], Math.PI / 2);
    const v = Vec3.transformQuat(Vec3.create(), [1, 0, 0], q);
    expect(v[0]).toBeCloseTo(0, 10);
    expect(v[1]).toBeCloseTo(1, 10);
    expect(v[2]).toBeCloseTo(0, 10);
  });

  it('multiplication composes rotations', () => {
    const half = Quat.setAxisAngle(Quat.create(), [0, 1, 0], Math.PI / 2);
    const full = Quat.multiply(Quat.create(), half, half);
    const v = Vec3.transformQuat(Vec3.create(), [1, 0, 0], full);
    // Two 90° turns about Y take +X to -X.
    expect(v[0]).toBeCloseTo(-1, 10);
    expect(v[1]).toBeCloseTo(0, 10);
    expect(v[2]).toBeCloseTo(0, 10);
  });

  it('normalizes to unit length', () => {
    const q = Quat.normalize(Quat.create(), [1, 2, 3, 4]);
    expect(Quat.length(q)).toBeCloseTo(1, 10);
  });

  it('conjugate inverts a unit rotation', () => {
    const q = Quat.setAxisAngle(Quat.create(), [0, 1, 0], Math.PI / 3);
    const inv = Quat.conjugate(Quat.create(), q);
    const back = Quat.multiply(Quat.create(), q, inv);
    expect(Quat.equals(back, Quat.create())).toBe(true);
  });

  it('slerp endpoints return the inputs', () => {
    const a = Quat.setAxisAngle(Quat.create(), [0, 1, 0], 0);
    const b = Quat.setAxisAngle(Quat.create(), [0, 1, 0], Math.PI / 2);
    expect(Quat.equals(Quat.slerp(Quat.create(), a, b, 0), a)).toBe(true);
    expect(Quat.equals(Quat.slerp(Quat.create(), a, b, 1), b)).toBe(true);
  });

  it('slerp midpoint is a unit quaternion', () => {
    const a = Quat.setAxisAngle(Quat.create(), [0, 1, 0], 0);
    const b = Quat.setAxisAngle(Quat.create(), [0, 1, 0], Math.PI / 2);
    const mid = Quat.slerp(Quat.create(), a, b, 0.5);
    expect(Quat.length(mid)).toBeCloseTo(1, 10);
  });
});
