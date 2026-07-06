import { describe, it, expect } from 'vitest';
import { createBox } from '@vanilla-slice/geometry';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';
import { defineMaterial } from '@vanilla-slice/materials';
import { createSliceVolume } from '@vanilla-slice/slicing';
import { createWorld } from './world';
import { fractureEntity, fractureCount } from './fracture-system';

describe('fracture system', () => {
  it('registers the fracture processor for impact by default', () => {
    const world = createWorld();
    expect(world.interactionRegistry.has('impact')).toBe(true);
  });

  it('scales fragment count with brittleness', () => {
    expect(fractureCount(0)).toBe(2);
    expect(fractureCount(1)).toBe(6);
    expect(fractureCount(0.5)).toBe(4);
  });

  it('fractures an entity into multiple fragment bodies', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox(2, 2, 2) });
    const before = world.entityCount;
    const outcome = fractureEntity(world, id, { count: 5, seed: 1 });
    expect(outcome.removed).toContain(id);
    expect(outcome.created.length).toBeGreaterThanOrEqual(2);
    expect(world.has(id)).toBe(false);
    expect(world.entityCount).toBe(before - 1 + outcome.created.length);
  });

  it('shatters a brittle material when sliced (slice-driven fracture)', () => {
    const world = createWorld({
      materials: [defineMaterial('glass', { brittleness: 0.9 })],
    });
    const id = world.spawn({ geometry: createBox(2, 2, 2), material: 'glass' });
    const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 3);
    const outcome = world.slice(volume);
    // A brittle slice shatters into more than the two clean-cut halves.
    expect(outcome.removed).toContain(id);
    expect(outcome.created.length).toBeGreaterThan(2);
  });

  it('cleanly cuts a non-brittle material (two halves)', () => {
    const world = createWorld({
      materials: [defineMaterial('jelly', { brittleness: 0 })],
    });
    const id = world.spawn({ geometry: createBox(2, 2, 2), material: 'jelly' });
    const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);
    const volume = createSliceVolume(plane, [0, 0, 0], 3);
    const outcome = world.slice(volume);
    expect(outcome.removed).toContain(id);
    expect(outcome.created).toHaveLength(2);
  });

  it('fractures a brittle body on a hard collision', () => {
    const world = createWorld({
      materials: [defineMaterial('glass', { toughness: 0.001, brittleness: 0.8 })],
    });
    world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0], material: 'glass' });
    world.spawn({
      geometry: createBox(1, 1, 1),
      position: [0.6, 0, 0],
      velocity: [-10, 0, 0],
      material: 'glass',
    });
    const before = world.entityCount;
    world.update(1 / 60);
    // At least one body fractured, increasing the entity count.
    expect(world.entityCount).toBeGreaterThan(before);
  });
});
