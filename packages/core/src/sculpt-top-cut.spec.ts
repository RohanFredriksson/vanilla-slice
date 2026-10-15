import { describe, it, expect } from 'vitest';
import { createBox } from '@vanilla-slice/geometry';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';
import { createSliceVolume } from '@vanilla-slice/slicing';
import { defineMaterial } from '@vanilla-slice/materials';
import { createWorld } from './world';

const GROUND_Y = -2;

function appWorld(sep: number) {
  return createWorld({
    gravity: [0, -9.81, 0],
    bounds: { min: [-20, -12, -20], max: [20, 12, 20] },
    materials: [
      defineMaterial('stone', {
        density: 2.5, friction: 0.7, restitution: 0,
        toughness: 1.5, brittleness: 0.49, fracturePropagationFactor: 0.35,
      }),
    ],
    sliceSeparationSpeed: sep,
    collisions: true, friction: 0.7, restitution: 0,
    ground: { normal: [0, 1, 0], offset: GROUND_Y, restitution: 0 },
    tipFactor: 14,
  });
}

function stoneBlock(world: ReturnType<typeof appWorld>) {
  return world.spawn({
    geometry: createBox(2.0, 5.0, 2.0),
    position: [0, GROUND_Y + 2.5, 0],
    mass: 0, sliceable: true, material: 'stone',
    linearDamping: 20, angularDamping: 20, name: 'block',
  });
}

function runAndCount(world: ReturnType<typeof appWorld>, startCount: number) {
  for (let i = 0; i < 600; i++) world.update(1 / 60);
  return world.entityCount - startCount;
}

describe('sculpt top cut', () => {
  it('a gentle horizontal top cut rests on the block without fracturing', () => {
    const world = appWorld(0.1);
    stoneBlock(world);
    const cy = GROUND_Y + 3.5;
    const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, cy, 0]);
    const out = world.slice(createSliceVolume(plane, [0, cy, 0], 4));
    expect(out.created.length).toBe(2);
    expect(runAndCount(world, world.entityCount)).toBe(0);
  });
});
