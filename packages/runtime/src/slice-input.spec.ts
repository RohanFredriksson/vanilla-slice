import { describe, it, expect } from 'vitest';
import {
  createWorld,
  createBox,
  createPlane,
  fromNormalAndPoint,
} from '@vanilla-slice/core';
import type { ReadonlyMat4 } from '@vanilla-slice/math';
import {
  intersectRayPlane,
  swipeToSliceVolume,
  SwipeSlicer,
} from './slice-input';

const IDENTITY: ReadonlyMat4 = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];

describe('intersectRayPlane', () => {
  it('finds the hit point in front of the ray', () => {
    const ray = { origin: [0, 0, -1] as [number, number, number], direction: [0, 0, 1] as [number, number, number] };
    const plane = fromNormalAndPoint(createPlane(), [0, 0, 1], [0, 0, 0]);
    expect(intersectRayPlane(ray, plane)).toEqual([0, 0, 0]);
  });

  it('returns null when the ray is parallel to the plane', () => {
    const ray = { origin: [0, 1, 0] as [number, number, number], direction: [1, 0, 0] as [number, number, number] };
    const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);
    expect(intersectRayPlane(ray, plane)).toBeNull();
  });
});

describe('swipeToSliceVolume', () => {
  it('builds a bounded volume from a screen swipe on the play plane', () => {
    const playPlane = fromNormalAndPoint(createPlane(), [0, 0, 1], [0, 0, 0]);
    const volume = swipeToSliceVolume({
      swipe: { start: [300, 300], end: [500, 300] },
      width: 800,
      height: 600,
      invViewProjection: IDENTITY,
      viewDirection: [0, 0, -1],
      playPlane,
      radius: 1,
    });
    expect(volume).not.toBeNull();
    // Horizontal swipe + view -Z => cut plane normal ±Y.
    expect(Math.abs(volume!.plane.normal[1])).toBeCloseTo(1, 6);
  });
});

describe('SwipeSlicer', () => {
  it('slices the world on pointer release for a valid swipe', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      position: [0, 0, 0],
    });

    const slicer = new SwipeSlicer({
      world,
      getViewport: () => ({ width: 800, height: 600 }),
      getInverseViewProjection: () => IDENTITY,
      getViewDirection: () => [0, 0, -1],
      playPlane: fromNormalAndPoint(createPlane(), [0, 0, 1], [0, 0, 0]),
      radius: 2,
      minDistance: 8,
    });

    slicer.pointerDown(300, 300);
    slicer.pointerMove(400, 300);
    const outcome = slicer.pointerUp(500, 300);

    expect(outcome).not.toBeNull();
    expect(outcome!.removed).toEqual([id]);
    expect(outcome!.created).toHaveLength(2);
    expect(world.has(id)).toBe(false);
  });

  it('does nothing for a tap (below threshold)', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({ geometry: createBox(), meshRef: 'fruit' });
    const slicer = new SwipeSlicer({
      world,
      getViewport: () => ({ width: 800, height: 600 }),
      getInverseViewProjection: () => IDENTITY,
      getViewDirection: () => [0, 0, -1],
      playPlane: fromNormalAndPoint(createPlane(), [0, 0, 1], [0, 0, 0]),
    });
    slicer.pointerDown(400, 300);
    expect(slicer.pointerUp(402, 301)).toBeNull();
    expect(world.entityCount).toBe(1);
  });
});
