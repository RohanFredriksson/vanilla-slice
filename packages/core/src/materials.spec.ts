import { describe, it, expect } from 'vitest';
import { computeVolume, createBox } from '@vanilla-slice/geometry';
import { defineMaterial, massFromDensity } from '@vanilla-slice/materials';
import { getMass } from '@vanilla-slice/physics';
import { createWorld } from './world';

describe('materials integration', () => {
  it('derives body mass from material density and geometry volume', () => {
    const world = createWorld({ materials: [defineMaterial('lead', { density: 5 })] });
    const box = createBox(2, 2, 2);
    const volume = Math.abs(computeVolume(box));
    const id = world.spawn({ geometry: box, material: 'lead' });
    const body = world.bodies.get(id)!;
    expect(getMass(body)).toBeCloseTo(massFromDensity(5, volume), 6);
    expect(world.materialRefs.get(id)?.materialId).toBe('lead');
  });

  it('lets an explicit mass override material-derived mass', () => {
    const world = createWorld({ materials: [defineMaterial('lead', { density: 5 })] });
    const id = world.spawn({ geometry: createBox(1, 1, 1), material: 'lead', mass: 3 });
    expect(getMass(world.bodies.get(id)!)).toBe(3);
  });

  it('leaves materialless bodies unchanged (default mass, no ref)', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox(2, 2, 2) });
    expect(world.materialRefs.has(id)).toBe(false);
    expect(getMass(world.bodies.get(id)!)).toBe(1);
  });

  it('resolves unknown material ids to the default material', () => {
    const world = createWorld();
    const box = createBox(2, 2, 2);
    const volume = Math.abs(computeVolume(box));
    const id = world.spawn({ geometry: box, material: 'missing' });
    // Default density is 1, so mass equals the mesh volume.
    expect(getMass(world.bodies.get(id)!)).toBeCloseTo(volume, 6);
    expect(world.materialRefs.get(id)?.materialId).toBe('missing');
  });

  it('drops the material ref on despawn', () => {
    const world = createWorld({ materials: [defineMaterial('glass', { toughness: 5 })] });
    const id = world.spawn({ geometry: createBox(1, 1, 1), material: 'glass' });
    expect(world.materialRefs.has(id)).toBe(true);
    world.despawn(id);
    expect(world.materialRefs.has(id)).toBe(false);
  });
});
