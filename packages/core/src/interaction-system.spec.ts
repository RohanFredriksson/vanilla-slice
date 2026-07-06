import { describe, it, expect } from 'vitest';
import { createBox } from '@vanilla-slice/geometry';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';
import { defineMaterial } from '@vanilla-slice/materials';
import type { InteractionOutcome, InteractionProcessor } from '@vanilla-slice/interactions';
import { createSliceVolume } from '@vanilla-slice/slicing';
import { createWorld } from './world';
import type { SimWorld } from './types';

describe('interaction framework', () => {
  it('registers the slice processor by default', () => {
    const world = createWorld();
    expect(world.interactionRegistry.has('slice')).toBe(true);
  });

  it('slices through the interaction framework (sliceWorld shim)', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox(1, 1, 1) });
    // A horizontal plane through the origin divides the unit box.
    const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 2);
    const outcome = world.slice(volume);
    expect(outcome.removed).toContain(id);
    expect(outcome.created.length).toBeGreaterThanOrEqual(2);
    expect(world.has(id)).toBe(false);
    expect(world.interactions.size).toBe(0); // queue drained
  });

  it('enqueues nothing for materialless collisions (behaviour-neutral)', () => {
    const world = createWorld();
    // Two overlapping bodies collide, but with no material they cannot fracture.
    world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0] });
    world.spawn({ geometry: createBox(1, 1, 1), position: [0.5, 0, 0], velocity: [-5, 0, 0] });
    world.update(1 / 60);
    expect(world.interactions.size).toBe(0);
  });

  it('routes collision impacts to a registered processor when the material threshold is exceeded', () => {
    const world = createWorld({
      materials: [defineMaterial('glass', { toughness: 0.001, brittleness: 0.9 })],
    });

    // A test fracture processor that records the impact and removes the entity.
    const handled: number[] = [];
    const fractureProcessor: InteractionProcessor<SimWorld> = {
      type: 'impact',
      evaluate: () => ({ applies: true }),
      apply: (ctx): InteractionOutcome => {
        handled.push(ctx.event.entity as number);
        ctx.world.despawn(ctx.event.entity);
        return { removed: [ctx.event.entity], created: [] };
      },
    };
    world.interactionRegistry.register(fractureProcessor);

    world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0], material: 'glass' });
    world.spawn({
      geometry: createBox(1, 1, 1),
      position: [0.6, 0, 0],
      velocity: [-8, 0, 0],
      material: 'glass',
    });
    world.update(1 / 60);

    expect(handled.length).toBeGreaterThan(0);
  });
});
