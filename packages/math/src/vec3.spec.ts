import { describe, it, expect } from 'vitest';
import * as Vec3 from './vec3';

describe('Vec3', () => {
  it('constructs and copies', () => {
    expect(Vec3.create()).toEqual([0, 0, 0]);
    expect(Vec3.fromValues(1, 2, 3)).toEqual([1, 2, 3]);
    expect(Vec3.clone([1, 2, 3])).toEqual([1, 2, 3]);
    const out = Vec3.create();
    expect(Vec3.copy(out, [4, 5, 6])).toBe(out);
    expect(out).toEqual([4, 5, 6]);
  });

  it('adds, subtracts, and scales', () => {
    const out = Vec3.create();
    expect(Vec3.add(out, [1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(Vec3.subtract(out, [4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(Vec3.scale(out, [1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(Vec3.scaleAndAdd(out, [1, 1, 1], [0, 1, 2], 3)).toEqual([1, 4, 7]);
  });

  it('computes dot and cross products', () => {
    expect(Vec3.dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(Vec3.dot([1, 2, 3], [4, 5, 6])).toBe(32);
    const out = Vec3.create();
    // x × y = z
    expect(Vec3.cross(out, [1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it('cross product is orthogonal to inputs', () => {
    const a = Vec3.fromValues(1, 2, 3);
    const b = Vec3.fromValues(-2, 0, 4);
    const c = Vec3.cross(Vec3.create(), a, b);
    expect(Vec3.dot(c, a)).toBeCloseTo(0, 10);
    expect(Vec3.dot(c, b)).toBeCloseTo(0, 10);
  });

  it('measures length and distance', () => {
    expect(Vec3.length([3, 4, 0])).toBe(5);
    expect(Vec3.squaredLength([1, 2, 2])).toBe(9);
    expect(Vec3.distance([0, 0, 0], [0, 3, 4])).toBe(5);
    expect(Vec3.squaredDistance([1, 1, 1], [2, 3, 3])).toBe(9);
  });

  it('normalizes to unit length and leaves zero vectors zero', () => {
    const out = Vec3.create();
    Vec3.normalize(out, [0, 3, 4]);
    expect(Vec3.length(out)).toBeCloseTo(1, 10);
    expect(Vec3.normalize(Vec3.create(), [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('lerps, mins, and maxes componentwise', () => {
    const out = Vec3.create();
    expect(Vec3.lerp(out, [0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
    expect(Vec3.min(out, [1, 5, 3], [4, 2, 6])).toEqual([1, 2, 3]);
    expect(Vec3.max(out, [1, 5, 3], [4, 2, 6])).toEqual([4, 5, 6]);
  });

  it('compares approximately and exactly', () => {
    expect(Vec3.equals([1, 2, 3], [1, 2, 3 + 1e-9])).toBe(true);
    expect(Vec3.exactEquals([1, 2, 3], [1, 2, 3 + 1e-9])).toBe(false);
    expect(Vec3.exactEquals([1, 2, 3], [1, 2, 3])).toBe(true);
  });
});
