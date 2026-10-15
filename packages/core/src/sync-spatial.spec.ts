import { describe, it, expect, vi } from 'vitest';
import { createBox } from '@vanilla-slice/geometry';
import { queryPoint } from '@vanilla-slice/spatial';
import { createWorld } from './world';
import { syncSpatial } from './systems';

const insertSpy = vi.hoisted(() => vi.fn());

vi.mock('@vanilla-slice/spatial', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vanilla-slice/spatial')>();
  return {
    ...actual,
    insert: (...args: Parameters<typeof actual.insert>) => {
      insertSpy(...args);
      return actual.insert(...args);
    },
  };
});

describe('syncSpatial', () => {
  it('does not re-insert bodies that have not moved', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0], mass: 0 });
    syncSpatial(world); // first sync records the placement
    insertSpy.mockClear();
    for (let i = 0; i < 10; i++) syncSpatial(world);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('re-inserts a moving body so queries follow it', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: createBox(1, 1, 1),
      position: [0, 0, 0],
      velocity: [5, 0, 0],
      mass: 1,
    });
    for (let i = 0; i < 60; i++) world.update(1 / 60);
    const pos = world.bodies.get(id)!.position;
    expect(pos[0]).toBeGreaterThan(1);
    expect(queryPoint(world.spatial, [pos[0], pos[1], pos[2]])).toContain(id);
  });

  it('still tracks a static body that is moved by hand', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0], mass: 0 });
    syncSpatial(world);
    world.bodies.get(id)!.position[0] = 10;
    syncSpatial(world);
    expect(queryPoint(world.spatial, [10, 0, 0])).toContain(id);
    expect(queryPoint(world.spatial, [0, 0, 0])).not.toContain(id);
  });
});
