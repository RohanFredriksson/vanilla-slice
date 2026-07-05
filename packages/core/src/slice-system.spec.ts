import { describe, it, expect } from 'vitest';
import { Mat4 } from '@vanilla-slice/math';
import { createBox } from '@vanilla-slice/geometry';
import {
  createSliceVolume,
  sliceVolumeFromSwipe,
  rayFromNdc,
} from '@vanilla-slice/slicing';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';
import { createWorld } from './world';

describe('World slicing (end-to-end)', () => {
  it('replaces a sliced entity with two fragments carrying impulses', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      position: [0, 0, 0],
      mass: 2,
      tags: ['fruit'],
    });

    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);
    const outcome = world.slice(volume, { separationSpeed: 3 });

    expect(outcome.removed).toEqual([id]);
    expect(outcome.created).toHaveLength(2);
    expect(world.has(id)).toBe(false);
    expect(world.entityCount).toBe(2);

    const [frontId, backId] = outcome.created;
    const front = world.bodies.get(frontId!)!;
    const back = world.bodies.get(backId!)!;
    // Fragments separate along ±normal (X) from the parent's zero velocity.
    expect(front.velocity[0]).toBeCloseTo(3, 6);
    expect(back.velocity[0]).toBeCloseTo(-3, 6);

    // Fragments inherit renderable + metadata from the parent.
    expect(world.renderables.get(frontId!)!.meshRef).toBe('fruit');
    expect(world.metadata.get(frontId!)!.tags.has('fruit')).toBe(true);
    // Fragments are themselves sliceable again.
    expect(world.sliceables.has(frontId!)).toBe(true);
  });

  it('runs the full gesture pipeline: screen swipe -> world volume -> fragments', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({ geometry: createBox(), position: [0, 0, 0], mass: 1 });

    // A horizontal world-space swipe with the camera looking down -Z.
    const volume = sliceVolumeFromSwipe([-1, 0, 0], [1, 0, 0], [0, 0, -1], 2);
    const outcome = world.slice(volume);

    expect(outcome.created.length).toBeGreaterThanOrEqual(2);
    expect(outcome.removed).toHaveLength(1);
  });

  it('leaves entities outside the bounded volume untouched', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const near = world.spawn({ geometry: createBox(), position: [0, 0, 0] });
    const far = world.spawn({ geometry: createBox(), position: [50, 0, 0] });

    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);
    const outcome = world.slice(volume);

    expect(outcome.removed).toEqual([near]);
    expect(world.has(far)).toBe(true);
  });

  it('supports unprojecting a screen ray for gesture input', () => {
    // Smoke test that the ray helper composes with world slicing inputs.
    const ray = rayFromNdc({ origin: [0, 0, 0], direction: [0, 0, -1] }, 0, 0, Mat4.create());
    expect(ray.origin).toEqual([0, 0, -1]);
  });
});
