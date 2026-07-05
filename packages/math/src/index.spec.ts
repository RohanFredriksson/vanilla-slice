import { describe, it, expect } from 'vitest';
import { MATH_PACKAGE, Vec3, Quat, Mat4, EPSILON } from './index';
import type { Vec3 as Vec3Type } from './index';

describe('@slice/math', () => {
  it('exposes its package marker', () => {
    expect(MATH_PACKAGE).toBe('@slice/math');
  });

  it('re-exports scalar utilities', () => {
    expect(EPSILON).toBeGreaterThan(0);
  });

  it('re-exports namespaces whose names match their types', () => {
    const v: Vec3Type = Vec3.fromValues(1, 2, 3);
    expect(Vec3.length(v)).toBeCloseTo(Math.sqrt(14), 10);
    expect(Quat.create()).toEqual([0, 0, 0, 1]);
    expect(Mat4.create()[0]).toBe(1);
  });
});
