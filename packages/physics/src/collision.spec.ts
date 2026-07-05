import { describe, it, expect } from 'vitest';
import {
  createAabb,
  aabbFromCenterHalfExtents,
  aabbOverlaps,
  aabbContainsPoint,
  aabbExpandByPoint,
} from './aabb';
import { sphereSphereContact, resolveHalfSpace } from './collision';
import { isOutOfBounds } from './cleanup';
import { createBody } from './body';

describe('Aabb', () => {
  it('builds from center and half-extents', () => {
    const box = aabbFromCenterHalfExtents([0, 0, 0], [1, 2, 3]);
    expect(box.min).toEqual([-1, -2, -3]);
    expect(box.max).toEqual([1, 2, 3]);
  });

  it('detects overlap and containment', () => {
    const a = createAabb([0, 0, 0], [2, 2, 2]);
    const b = createAabb([1, 1, 1], [3, 3, 3]);
    const c = createAabb([5, 5, 5], [6, 6, 6]);
    expect(aabbOverlaps(a, b)).toBe(true);
    expect(aabbOverlaps(a, c)).toBe(false);
    expect(aabbContainsPoint(a, [1, 1, 1])).toBe(true);
    expect(aabbContainsPoint(a, [3, 1, 1])).toBe(false);
  });

  it('expands to include a point', () => {
    const box = createAabb([0, 0, 0], [1, 1, 1]);
    aabbExpandByPoint(box, [2, -1, 0]);
    expect(box.min).toEqual([0, -1, 0]);
    expect(box.max).toEqual([2, 1, 1]);
  });
});

describe('collision', () => {
  it('reports sphere overlap with a normal and depth', () => {
    const contact = sphereSphereContact([0, 0, 0], 1, [1.5, 0, 0], 1);
    expect(contact).not.toBeNull();
    expect(contact!.normal).toEqual([1, 0, 0]);
    expect(contact!.depth).toBeCloseTo(0.5, 10);
  });

  it('returns null for separated spheres', () => {
    expect(sphereSphereContact([0, 0, 0], 1, [3, 0, 0], 1)).toBeNull();
  });

  it('resolves a half-space collision with restitution', () => {
    // Ground plane y >= 0; body radius 0 for a clean check.
    const body = createBody({ position: [0, -1, 0], velocity: [0, -5, 0], radius: 0 });
    const resolved = resolveHalfSpace(body, [0, 1, 0], 0, 0.5);
    expect(resolved).toBe(true);
    expect(body.position[1]).toBeCloseTo(0, 10);
    expect(body.velocity[1]).toBeCloseTo(2.5, 10);
  });

  it('accounts for the body radius against the surface', () => {
    const body = createBody({ position: [0, 0.3, 0], velocity: [0, 0, 0], radius: 0.5 });
    const resolved = resolveHalfSpace(body, [0, 1, 0], 0, 0);
    expect(resolved).toBe(true);
    expect(body.position[1]).toBeCloseTo(0.5, 10);
  });

  it('does nothing when the body is above the surface', () => {
    const body = createBody({ position: [0, 5, 0], radius: 0 });
    expect(resolveHalfSpace(body, [0, 1, 0], 0, 0.5)).toBe(false);
  });
});

describe('cleanup', () => {
  it('detects out-of-bounds positions', () => {
    const bounds = createAabb([-10, -10, -10], [10, 10, 10]);
    expect(isOutOfBounds([0, 0, 0], bounds)).toBe(false);
    expect(isOutOfBounds([0, -20, 0], bounds)).toBe(true);
  });
});
