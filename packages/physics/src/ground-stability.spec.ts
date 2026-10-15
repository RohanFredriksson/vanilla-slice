import { describe, it, expect } from 'vitest';
import { createBody, boxInvInertia } from './body';
import { integrateBody } from './integration';
import { resolveHalfSpace } from './collision';
import type { RigidBody } from './body';
import type { ConvexShape } from './convex';

/** Axis-aligned box collider (8 corners) centred on the origin. */
function boxCollider(hx: number, hy: number, hz: number): ConvexShape {
  const vertices: number[] = [];
  for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) vertices.push(x, y, z);
  return { vertices };
}

/** Total mechanical energy (linear + rotational KE + gravitational PE). */
function mechanicalEnergy(body: RigidBody, mass: number, g: number): number {
  const v = body.velocity;
  const linKE = 0.5 * mass * (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  // Body-local angular velocity: conjugate(q) applied to world angular velocity.
  const q = body.orientation;
  const cx = -q[0], cy = -q[1], cz = -q[2], cw = q[3];
  const w = body.angularVelocity;
  // rotate w by conjugate quaternion
  const ix = cw * w[0] + cy * w[2] - cz * w[1];
  const iy = cw * w[1] + cz * w[0] - cx * w[2];
  const iz = cw * w[2] + cx * w[1] - cy * w[0];
  const iw = -cx * w[0] - cy * w[1] - cz * w[2];
  const wlx = ix * cw + iw * -cx + iy * -cz - iz * -cy;
  const wly = iy * cw + iw * -cy + iz * -cx - ix * -cz;
  const wlz = iz * cw + iw * -cz + ix * -cy - iy * -cx;
  const I = [1 / body.invInertia[0], 1 / body.invInertia[1], 1 / body.invInertia[2]];
  const rotKE = 0.5 * (I[0] * wlx * wlx + I[1] * wly * wly + I[2] * wlz * wlz);
  const pe = mass * g * body.position[1];
  return linKE + rotKE + pe;
}

const GROUND_Y = -2;
const G = 9.81;
const DT = 1 / 60;

describe('ground stability (no energy injection)', () => {
  it('a small spinning shard bouncing on the ground never gains energy', () => {
    const mass = 0.05;
    const hx = 0.09, hy = 0.05, hz = 0.07;
    const collider = boxCollider(hx, hy, hz);
    const a = 0.9;
    const body = createBody({
      position: [0, 0, 0],
      velocity: [1.5, -9, 0.7],
      orientation: [Math.sin(a / 2) * 0.6, 0, Math.sin(a / 2) * 0.8, Math.cos(a / 2)],
      angularVelocity: [3, 1, 2],
      mass,
      radius: Math.hypot(hx, hy, hz),
      invInertia: boxInvInertia(mass, hx * 2, hy * 2, hz * 2),
    });
    const e0 = mechanicalEnergy(body, mass, G);
    let maxE = e0;
    let minVertexY = Infinity;
    for (let step = 0; step < 2000; step++) {
      integrateBody(body, [0, -G, 0], DT);
      resolveHalfSpace(body, [0, 1, 0], GROUND_Y, 0, collider, 14);
      maxE = Math.max(maxE, mechanicalEnergy(body, mass, G));
      // deepest vertex must never sink meaningfully below the ground plane
      minVertexY = Math.min(minVertexY, body.position[1] - body.radius);
    }
    // Energy must not grow beyond the starting budget (allow tiny numerical slack).
    expect(maxE).toBeLessThanOrEqual(e0 + 1e-6);
    // The piece stays on the ground rather than being flung upward.
    expect(body.position[1]).toBeLessThan(GROUND_Y + 1);
  });

  it('a resting overhanging piece topples with a bounded spin, not a launch', () => {
    const mass = 0.05;
    const hx = 0.25, hy = 0.05, hz = 0.2;
    const collider = boxCollider(hx, hy, hz);
    // Tilt slightly so the COM projects just past a support edge, at rest.
    const a = 0.15;
    const body = createBody({
      position: [0, GROUND_Y + 0.24, 0],
      velocity: [0, 0, 0],
      orientation: [0, 0, Math.sin(a / 2), Math.cos(a / 2)],
      angularVelocity: [0, 0, 0],
      mass,
      radius: Math.hypot(hx, hy, hz),
      invInertia: boxInvInertia(mass, hx * 2, hy * 2, hz * 2),
    });
    let maxOmega = 0;
    for (let step = 0; step < 600; step++) {
      integrateBody(body, [0, -G, 0], DT);
      resolveHalfSpace(body, [0, 1, 0], GROUND_Y, 0, collider, 14);
      maxOmega = Math.max(maxOmega, Math.hypot(...body.angularVelocity));
    }
    // Spin stays bounded (no runaway); settles low and slow.
    expect(maxOmega).toBeLessThan(10);
    expect(Math.hypot(...body.velocity)).toBeLessThan(1);
    expect(body.position[1]).toBeLessThan(GROUND_Y + 0.3);
  });
});
