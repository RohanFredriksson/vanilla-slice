import { describe, it, expect } from 'vitest';
import { Quat, Vec3 } from '@slice/math';
import { createBody, applyForce } from './body';
import { integrateBody, integrateBodies } from './integration';

const GRAVITY: [number, number, number] = [0, -10, 0];

describe('integrateBody', () => {
  it('applies gravity with semi-implicit Euler', () => {
    const body = createBody();
    integrateBody(body, GRAVITY, 1);
    // velocity updated first, then position uses the new velocity.
    expect(body.velocity).toEqual([0, -10, 0]);
    expect(body.position).toEqual([0, -10, 0]);
  });

  it('does not move static bodies under gravity', () => {
    const body = createBody({ mass: 0 });
    integrateBody(body, GRAVITY, 1);
    expect(body.velocity).toEqual([0, 0, 0]);
    expect(body.position).toEqual([0, 0, 0]);
  });

  it('consumes accumulated force and clears it', () => {
    const body = createBody({ mass: 2 });
    applyForce(body, [4, 0, 0]); // a = F/m = 2
    integrateBody(body, [0, 0, 0], 1);
    expect(body.velocity[0]).toBeCloseTo(2, 10);
    expect(body.force).toEqual([0, 0, 0]);
  });

  it('reduces velocity with linear damping', () => {
    const body = createBody({ velocity: [10, 0, 0], linearDamping: 0.5 });
    integrateBody(body, [0, 0, 0], 1);
    // retain = 1 - 0.5 * 1 = 0.5
    expect(body.velocity[0]).toBeCloseTo(5, 10);
  });

  it('keeps orientation a unit quaternion while spinning', () => {
    const body = createBody({ angularVelocity: [0, Math.PI, 0] });
    for (let i = 0; i < 100; i++) {
      integrateBody(body, [0, 0, 0], 1 / 60);
    }
    expect(Quat.length(body.orientation)).toBeCloseTo(1, 6);
  });

  it('spins toward the expected orientation about an axis', () => {
    const body = createBody({ angularVelocity: [0, 0, Math.PI / 2] });
    // Integrate ~1 second in small steps => ~90° about Z.
    for (let i = 0; i < 240; i++) {
      integrateBody(body, [0, 0, 0], 1 / 240);
    }
    const rotated = Vec3.transformQuat(Vec3.create(), [1, 0, 0], body.orientation);
    expect(rotated[0]).toBeCloseTo(0, 2);
    expect(rotated[1]).toBeCloseTo(1, 2);
  });

  it('integrates a collection of bodies', () => {
    const a = createBody();
    const b = createBody({ velocity: [1, 0, 0] });
    integrateBodies([a, b], GRAVITY, 1);
    expect(a.position).toEqual([0, -10, 0]);
    expect(b.position[0]).toBeCloseTo(1, 10);
  });
});
