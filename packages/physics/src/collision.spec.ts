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
import type { ConvexShape } from './convex';

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

/** Box collider (8 corners) with the given half-extents, centred at local (cx, 0, cz). */
function boxCollider(hx: number, hy: number, hz: number, cx = 0, cz = 0): ConvexShape {
  const vertices: number[] = [];
  for (const x of [cx - hx, cx + hx]) {
    for (const y of [-hy, hy]) {
      for (const z of [cz - hz, cz + hz]) {
        vertices.push(x, y, z);
      }
    }
  }
  return { vertices };
}

describe('resolveHalfSpace tipping', () => {
  it('leaves a balanced tall box stable (COM inside the support polygon)', () => {
    // 0.5×3×0.5 box resting with its base on the ground; COM over the centre.
    const box = boxCollider(0.25, 1.5, 0.25);
    const body = createBody({ position: [0, 1.5, 0], radius: 0.25 });
    resolveHalfSpace(body, [0, 1, 0], 0, 0, box, 12);
    expect(body.angularVelocity).toEqual([0, 0, 0]);
  });

  it('tips a box whose COM projects outside the support polygon', () => {
    // Base offset so the footprint sits at world x∈[-0.25,0.25] while the COM is
    // at x=0.5 — a quarter-unit past the +X support edge.
    const box = boxCollider(0.25, 1.5, 0.25, -0.5);
    const body = createBody({ position: [0.5, 1.5, 0], radius: 0.25 });
    const resolved = resolveHalfSpace(body, [0, 1, 0], 0, 0, box, 12);
    expect(resolved).toBe(true);
    // Overhang is +X, so the body topples about the Z axis.
    expect(Math.abs(body.angularVelocity[2])).toBeGreaterThan(0);
    expect(body.angularVelocity[0]).toBeCloseTo(0, 10);
    expect(body.angularVelocity[1]).toBeCloseTo(0, 10);
  });

  it('never tips a static body even when the COM is outside the footprint', () => {
    const box = boxCollider(0.25, 1.5, 0.25, -0.5);
    const body = createBody({ position: [0.5, 1.5, 0], mass: 0, radius: 0.25 });
    const resolved = resolveHalfSpace(body, [0, 1, 0], 0, 0, box, 12);
    expect(resolved).toBe(false);
    expect(body.angularVelocity).toEqual([0, 0, 0]);
  });

  it('falls back to sphere behaviour when no collider is supplied', () => {
    const body = createBody({ position: [0, -1, 0], velocity: [0, -5, 0], radius: 0 });
    expect(() => resolveHalfSpace(body, [0, 1, 0], 0, 0.5)).not.toThrow();
    expect(body.position[1]).toBeCloseTo(0, 10);
    expect(body.angularVelocity).toEqual([0, 0, 0]);
  });
});

describe('cleanup', () => {
  it('detects out-of-bounds positions', () => {
    const bounds = createAabb([-10, -10, -10], [10, 10, 10]);
    expect(isOutOfBounds([0, 0, 0], bounds)).toBe(false);
    expect(isOutOfBounds([0, -20, 0], bounds)).toBe(true);
  });
});
