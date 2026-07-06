import { describe, it, expect } from 'vitest';
import { createBox, createMesh } from '@vanilla-slice/geometry';
import type { Mesh } from '@vanilla-slice/geometry';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';
import { createSliceVolume } from '@vanilla-slice/slicing';
import { createWorld } from './world';
import { fractureEntity } from './fracture-system';

/** A unit box carrying UVs and a rest-pose `tex3` equal to its local positions. */
function texturedBox(): Mesh {
  const box = createBox();
  const uvs: number[] = [];
  for (let i = 0; i < box.positions.length / 3; i++) uvs.push(0, 0);
  return createMesh(box.positions.slice(), box.indices.slice(), {
    uvs,
    tex3: box.positions.slice(),
  });
}

/** The largest absolute component of a mesh's `tex3` channel. */
function maxAbsTex3(mesh: Mesh): number {
  let max = 0;
  for (const t of mesh.tex3 ?? []) max = Math.max(max, Math.abs(t));
  return max;
}

describe('textured fragments — model-space tex3 (ADR 0010, P4)', () => {
  it('keeps slice-fragment tex3 in model space for a far-translated body', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({
      geometry: texturedBox(),
      position: [100, 0, 0],
      mass: 1,
    });

    // Cut through the body at world x = 100 (its local origin).
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [100, 0, 0]);
    const outcome = world.slice(createSliceVolume(plane, [100, 0, 0], 2));
    expect(outcome.created).toHaveLength(2);

    for (const fragId of outcome.created) {
      const mesh = world.sliceables.get(fragId)!.mesh;
      // Exterior AND interior (cap) tex3 must stay within the original unit
      // box's model-space bounds — never the far world position (~100).
      expect(maxAbsTex3(mesh)).toBeLessThan(0.6);
      // The cut introduced an interior slot.
      expect(mesh.groups).toContain(1);
    }
  });

  it('keeps fracture-fragment tex3 in model space for a far-translated body', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: texturedBox(),
      position: [0, 100, 0],
      mass: 1,
    });

    const outcome = fractureEntity(world, id, {
      count: 6,
      seed: 1,
      separationSpeed: 1,
    });
    expect(outcome.created.length).toBeGreaterThanOrEqual(2);

    for (const fragId of outcome.created) {
      const mesh = world.sliceables.get(fragId)!.mesh;
      expect(maxAbsTex3(mesh)).toBeLessThan(0.6);
    }
  });

  it('surfaces the entity material id on the render state', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      materials: [
        {
          id: 'wood',
          density: 700,
          friction: 0.5,
          restitution: 0.2,
          toughness: 100,
          brittleness: 0.2,
          fracturePropagationFactor: 0.3,
        },
      ],
    });
    world.spawn({
      geometry: texturedBox(),
      position: [0, 0, 0],
      meshRef: 'log',
      material: 'wood',
    });
    world.spawn({ geometry: createBox(), position: [5, 0, 0], meshRef: 'plain' });

    const state = world.getRenderState();
    const withMaterial = state.find((item) => item.meshRef === 'log');
    const withoutMaterial = state.find((item) => item.meshRef === 'plain');
    expect(withMaterial?.materialId).toBe('wood');
    expect(withoutMaterial?.materialId).toBeUndefined();
  });
});
