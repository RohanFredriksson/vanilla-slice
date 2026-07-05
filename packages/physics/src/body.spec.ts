import { describe, it, expect } from 'vitest';
import { Quat } from '@vanilla-slice/math';
import {
  createBody,
  isStatic,
  getMass,
  massToInvMass,
  applyForce,
  applyImpulse,
  applyAngularImpulse,
  applyImpulseAtPoint,
  solidSphereInvInertia,
  boxInvInertia,
  clearForces,
} from './body';

describe('RigidBody', () => {
  it('fills defaults', () => {
    const body = createBody();
    expect(body.position).toEqual([0, 0, 0]);
    expect(body.velocity).toEqual([0, 0, 0]);
    expect(body.orientation).toEqual([0, 0, 0, 1]);
    expect(body.invMass).toBe(1);
    expect(isStatic(body)).toBe(false);
  });

  it('treats non-positive or non-finite mass as static', () => {
    expect(massToInvMass(0)).toBe(0);
    expect(massToInvMass(-5)).toBe(0);
    expect(massToInvMass(Infinity)).toBe(0);
    expect(massToInvMass(2)).toBe(0.5);
    expect(isStatic(createBody({ mass: 0 }))).toBe(true);
    expect(getMass(createBody({ mass: 0 }))).toBe(Infinity);
    expect(getMass(createBody({ mass: 4 }))).toBe(4);
  });

  it('clones input vectors instead of aliasing', () => {
    const position = [1, 2, 3];
    const body = createBody({ position });
    position[0] = 99;
    expect(body.position[0]).toBe(1);
  });

  it('accumulates and clears forces', () => {
    const body = createBody();
    applyForce(body, [1, 0, 0]);
    applyForce(body, [0, 2, 0]);
    expect(body.force).toEqual([1, 2, 0]);
    clearForces(body);
    expect(body.force).toEqual([0, 0, 0]);
  });

  it('applies impulses scaled by inverse mass', () => {
    const body = createBody({ mass: 2 });
    applyImpulse(body, [10, 0, 0]);
    expect(body.velocity).toEqual([5, 0, 0]);
    const staticBody = createBody({ mass: 0 });
    applyImpulse(staticBody, [10, 0, 0]);
    expect(staticBody.velocity).toEqual([0, 0, 0]);
  });
});

describe('rotational inertia', () => {
  it('defaults to a solid-sphere inverse inertia from mass and radius', () => {
    const body = createBody({ mass: 2, radius: 0.5 });
    // I = 2/5 * m * r^2 = 0.4 * 2 * 0.25 = 0.2 ; invI = 5
    expect(body.invInertia[0]).toBeCloseTo(5);
    expect(body.invInertia[1]).toBeCloseTo(5);
    expect(body.invInertia[2]).toBeCloseTo(5);
  });

  it('treats static bodies as rotationally locked', () => {
    expect(solidSphereInvInertia(0, 1)).toEqual([0, 0, 0]);
    expect(boxInvInertia(0, 1, 1, 1)).toEqual([0, 0, 0]);
    expect(createBody({ mass: 0 }).invInertia).toEqual([0, 0, 0]);
  });

  it('computes anisotropic box inverse inertia', () => {
    // Unit mass box 2x2x2: I_axis = 1/12 * m * (4 + 4) = 8/12 ; inv = 1.5
    const inv = boxInvInertia(1, 2, 2, 2);
    expect(inv[0]).toBeCloseTo(1.5);
    expect(inv[1]).toBeCloseTo(1.5);
    expect(inv[2]).toBeCloseTo(1.5);
    // A long, thin box spins more easily about its long (x) axis.
    const rod = boxInvInertia(1, 4, 1, 1);
    expect(rod[0]).toBeGreaterThan(rod[1]);
    expect(rod[1]).toBeCloseTo(rod[2]);
  });

  it('accepts an explicit inverse inertia override', () => {
    const body = createBody({ invInertia: [1, 2, 3] });
    expect(body.invInertia).toEqual([1, 2, 3]);
    const source = [7, 8, 9];
    const cloned = createBody({ invInertia: source });
    source[0] = 99;
    expect(cloned.invInertia[0]).toBe(7);
  });

  it('applies angular impulse scaled by world inverse inertia', () => {
    const body = createBody({ mass: 1, invInertia: [2, 0, 0] });
    applyAngularImpulse(body, [3, 0, 0]);
    // Identity orientation: Δω = invInertia ⊙ L = [6, 0, 0].
    expect(body.angularVelocity[0]).toBeCloseTo(6);
    expect(body.angularVelocity[1]).toBeCloseTo(0);
    expect(body.angularVelocity[2]).toBeCloseTo(0);
  });

  it('rotates local inverse inertia into world space', () => {
    // 90° about Z maps local x-axis onto world y-axis.
    const orientation = Quat.setAxisAngle(Quat.create(), [0, 0, 1], Math.PI / 2);
    const body = createBody({ orientation, invInertia: [4, 0, 0] });
    // World torque about y should excite the (locally-x) spin axis.
    applyAngularImpulse(body, [0, 1, 0]);
    expect(body.angularVelocity[0]).toBeCloseTo(0);
    expect(body.angularVelocity[1]).toBeCloseTo(4);
    expect(body.angularVelocity[2]).toBeCloseTo(0);
  });

  it('applies an off-center impulse as linear + angular response', () => {
    const body = createBody({ mass: 1, invInertia: [1, 1, 1] });
    // Impulse +x applied above the center (offset +y) => linear +x, spin about -z.
    applyImpulseAtPoint(body, [1, 0, 0], [0, 1, 0]);
    expect(body.velocity).toEqual([1, 0, 0]);
    // torque = r × impulse = (0,1,0) × (1,0,0) = (0,0,-1)
    expect(body.angularVelocity[2]).toBeCloseTo(-1);
  });

  it('does not rotate static bodies from off-center impulses', () => {
    const staticBody = createBody({ mass: 0 });
    applyImpulseAtPoint(staticBody, [10, 0, 0], [0, 1, 0]);
    expect(staticBody.velocity).toEqual([0, 0, 0]);
    expect(staticBody.angularVelocity).toEqual([0, 0, 0]);
  });
});
