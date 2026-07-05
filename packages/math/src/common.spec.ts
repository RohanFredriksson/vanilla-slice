import { describe, it, expect } from 'vitest';
import {
  EPSILON,
  clamp,
  lerp,
  toRadians,
  toDegrees,
  approxEqual,
} from './common';

describe('common', () => {
  it('exposes a small epsilon', () => {
    expect(EPSILON).toBeGreaterThan(0);
    expect(EPSILON).toBeLessThan(1e-3);
  });

  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerps between endpoints', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('converts between degrees and radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 12);
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 12);
    expect(toDegrees(toRadians(37))).toBeCloseTo(37, 12);
  });

  it('compares approximately', () => {
    expect(approxEqual(1, 1 + EPSILON / 2)).toBe(true);
    expect(approxEqual(1, 1.1)).toBe(false);
    expect(approxEqual(1_000_000, 1_000_000.0001)).toBe(true);
  });
});
