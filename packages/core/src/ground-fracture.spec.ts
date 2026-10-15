import { describe, it, expect } from 'vitest';
import { createBox } from '@vanilla-slice/geometry';
import { defineMaterial } from '@vanilla-slice/materials';
import { createWorld } from './world';

const GROUND_Y = -2;

function stoneWorld() {
  return createWorld({
    gravity: [0, -9.81, 0],
    ground: { normal: [0, 1, 0], offset: GROUND_Y, restitution: 0 },
    materials: [
      defineMaterial('stone', {
        toughness: 2,
        brittleness: 0.4,
        fracturePropagationFactor: 0.3,
      }),
    ],
  });
}

describe('ground-impact fracture', () => {
  it('fractures a fracturable body that hits the ground hard', () => {
    const world = stoneWorld();
    const id = world.spawn({
      geometry: createBox(1, 1, 1),
      position: [0, GROUND_Y + 3, 0],
      velocity: [0, -6, 0],
      mass: 1,
      material: 'stone',
    });
    let fractured = false;
    for (let i = 0; i < 240; i++) {
      world.update(1 / 60);
      if (!world.has(id)) {
        fractured = true;
        break;
      }
    }
    expect(fractured).toBe(true);
    // The parent was replaced by multiple fragment bodies.
    expect(world.entityCount).toBeGreaterThanOrEqual(2);
  });

  it('leaves a gently-resting body intact', () => {
    const world = stoneWorld();
    const id = world.spawn({
      geometry: createBox(1, 1, 1),
      position: [0, GROUND_Y + 0.5, 0], // base already on the ground
      velocity: [0, 0, 0],
      mass: 1,
      material: 'stone',
    });
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60);
    }
    expect(world.has(id)).toBe(true);
  });

  it('never fractures a materialless (unbreakable) body on impact', () => {
    const world = createWorld({
      gravity: [0, -9.81, 0],
      ground: { normal: [0, 1, 0], offset: GROUND_Y, restitution: 0 },
    });
    const id = world.spawn({
      geometry: createBox(1, 1, 1),
      position: [0, GROUND_Y + 3, 0],
      velocity: [0, -8, 0],
      mass: 1,
    });
    for (let i = 0; i < 240; i++) {
      world.update(1 / 60);
    }
    expect(world.has(id)).toBe(true);
  });

  it('caps re-fracturing so a hard drop cannot cascade into dust', () => {
    // Very low toughness would fracture every fragment on every bounce; the
    // generation cap must keep the body count bounded.
    const world = createWorld({
      gravity: [0, -9.81, 0],
      bounds: { min: [-50, -50, -50], max: [50, 50, 50] },
      ground: { normal: [0, 1, 0], offset: GROUND_Y, restitution: 0 },
      materials: [
        defineMaterial('brittle', {
          toughness: 0.1,
          brittleness: 0.4,
          fracturePropagationFactor: 0.3,
        }),
      ],
    });
    world.spawn({
      geometry: createBox(2, 2, 2),
      position: [0, GROUND_Y + 8, 0],
      velocity: [0, -10, 0],
      mass: 1,
      material: 'brittle',
    });
    for (let i = 0; i < 600; i++) {
      world.update(1 / 60);
    }
    // One original → at most a couple of shatter generations, never a runaway.
    expect(world.entityCount).toBeLessThan(64);
  });
});
