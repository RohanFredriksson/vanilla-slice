import { describe, it, expect } from 'vitest';
import { createBody } from './body';
import { resolveContact } from './solver';
import type { ContactManifold } from './convex';

/** A one-point manifold with normal from a toward b. */
function manifold(
  normal: [number, number, number],
  point: [number, number, number],
  penetration: number,
): ContactManifold {
  return { normal, points: [{ point, penetration }] };
}

describe('resolveContact', () => {
  it('stops an inelastic head-on impact against a static body', () => {
    const a = createBody({ mass: 1, position: [0, 0, 0], velocity: [2, 0, 0] });
    const b = createBody({ mass: 0, position: [2, 0, 0] });
    resolveContact(a, b, manifold([1, 0, 0], [1, 0, 0], 0), { friction: 0 });
    expect(a.velocity[0]).toBeCloseTo(0, 6);
  });

  it('reflects velocity with restitution 1', () => {
    const a = createBody({ mass: 1, position: [0, 0, 0], velocity: [2, 0, 0] });
    const b = createBody({ mass: 0, position: [2, 0, 0] });
    resolveContact(a, b, manifold([1, 0, 0], [1, 0, 0], 0), {
      restitution: 1,
      friction: 0,
    });
    expect(a.velocity[0]).toBeCloseTo(-2, 5);
  });

  it('shares velocity between equal dynamic masses (inelastic)', () => {
    const a = createBody({ mass: 1, position: [0, 0, 0], velocity: [2, 0, 0] });
    const b = createBody({ mass: 1, position: [2, 0, 0], velocity: [0, 0, 0] });
    resolveContact(a, b, manifold([1, 0, 0], [1, 0, 0], 0), { friction: 0 });
    expect(a.velocity[0]).toBeCloseTo(1, 5);
    expect(b.velocity[0]).toBeCloseTo(1, 5);
  });

  it('conserves linear momentum for two dynamic bodies', () => {
    const a = createBody({ mass: 2, position: [0, 0, 0], velocity: [3, 0, 0] });
    const b = createBody({ mass: 1, position: [2, 0, 0], velocity: [-1, 0, 0] });
    const before = 2 * 3 + 1 * -1;
    resolveContact(a, b, manifold([1, 0, 0], [1, 0, 0], 0), {
      restitution: 0.5,
      friction: 0,
    });
    const after = 2 * a.velocity[0] + 1 * b.velocity[0];
    expect(after).toBeCloseTo(before, 5);
  });

  it('does not pull separating bodies together', () => {
    const a = createBody({ mass: 1, position: [0, 0, 0], velocity: [-1, 0, 0] });
    const b = createBody({ mass: 0, position: [2, 0, 0] });
    resolveContact(a, b, manifold([1, 0, 0], [1, 0, 0], 0), { friction: 0 });
    expect(a.velocity[0]).toBeCloseTo(-1, 6); // Unchanged: already separating.
  });

  it('reduces tangential velocity via friction', () => {
    // b sits below a (normal a→b points -y); a slides in +x while pressing down.
    const a = createBody({ mass: 1, position: [0, 0, 0], velocity: [1, -1, 0] });
    const b = createBody({ mass: 0, position: [0, -1, 0] });
    resolveContact(a, b, manifold([0, -1, 0], [0, -0.5, 0], 0), { friction: 0.8 });
    expect(a.velocity[0]).toBeLessThan(1);
    expect(a.velocity[0]).toBeGreaterThanOrEqual(0);
  });

  it('pushes overlapping bodies apart by positional correction', () => {
    const a = createBody({ mass: 1, position: [0, 0, 0] });
    const b = createBody({ mass: 0, position: [1, 0, 0] });
    resolveContact(a, b, manifold([1, 0, 0], [0.5, 0, 0], 0.1), {
      positionCorrection: 0.2,
      penetrationSlop: 0.01,
    });
    // Only the dynamic body moves, and it moves away from b (−x).
    expect(a.position[0]).toBeLessThan(0);
    expect(b.position[0]).toBe(1);
  });

  it('induces spin from an off-center impact', () => {
    const a = createBody({ mass: 1, position: [0, 0, 0], velocity: [2, 0, 0] });
    const b = createBody({ mass: 0, position: [2, 0, 0] });
    // Contact offset in +y from a's center => torque about z.
    resolveContact(a, b, manifold([1, 0, 0], [1, 1, 0], 0), { friction: 0 });
    expect(Math.abs(a.angularVelocity[2])).toBeGreaterThan(0);
  });

  it('is a no-op when both bodies are static', () => {
    const a = createBody({ mass: 0, position: [0, 0, 0], velocity: [1, 0, 0] });
    const b = createBody({ mass: 0, position: [1, 0, 0] });
    resolveContact(a, b, manifold([1, 0, 0], [0.5, 0, 0], 0.1));
    expect(a.velocity).toEqual([1, 0, 0]);
    expect(a.position).toEqual([0, 0, 0]);
  });
});
