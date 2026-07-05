import { describe, it, expect } from 'vitest';
import * as Vec2 from './vec2';

describe('Vec2', () => {
  it('constructs and copies', () => {
    expect(Vec2.create()).toEqual([0, 0]);
    expect(Vec2.fromValues(1, 2)).toEqual([1, 2]);
    expect(Vec2.clone([3, 4])).toEqual([3, 4]);
  });

  it('adds, subtracts, and scales', () => {
    const out = Vec2.create();
    expect(Vec2.add(out, [1, 2], [3, 4])).toEqual([4, 6]);
    expect(Vec2.subtract(out, [3, 4], [1, 2])).toEqual([2, 2]);
    expect(Vec2.scale(out, [1, 2], 3)).toEqual([3, 6]);
    expect(Vec2.scaleAndAdd(out, [1, 1], [2, 3], 2)).toEqual([5, 7]);
  });

  it('computes dot and 2D cross', () => {
    expect(Vec2.dot([1, 0], [0, 1])).toBe(0);
    expect(Vec2.dot([1, 2], [3, 4])).toBe(11);
    // x × y = +1
    expect(Vec2.cross([1, 0], [0, 1])).toBe(1);
    expect(Vec2.cross([0, 1], [1, 0])).toBe(-1);
  });

  it('measures length and distance', () => {
    expect(Vec2.length([3, 4])).toBe(5);
    expect(Vec2.squaredLength([3, 4])).toBe(25);
    expect(Vec2.distance([0, 0], [3, 4])).toBe(5);
    expect(Vec2.squaredDistance([0, 0], [3, 4])).toBe(25);
  });

  it('normalizes and lerps', () => {
    const out = Vec2.create();
    Vec2.normalize(out, [3, 4]);
    expect(Vec2.length(out)).toBeCloseTo(1, 10);
    expect(Vec2.normalize(Vec2.create(), [0, 0])).toEqual([0, 0]);
    expect(Vec2.lerp(out, [0, 0], [10, 20], 0.5)).toEqual([5, 10]);
  });

  it('compares approximately and exactly', () => {
    expect(Vec2.equals([1, 2], [1, 2 + 1e-9])).toBe(true);
    expect(Vec2.exactEquals([1, 2], [1, 2 + 1e-9])).toBe(false);
  });
});
