import { describe, it, expect } from 'vitest';
import {
  createBody,
  isStatic,
  getMass,
  massToInvMass,
  applyForce,
  applyImpulse,
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
