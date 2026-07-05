import { describe, it, expect } from 'vitest';
import { createPlane, fromNormalAndPoint } from './plane';
import { createBox } from './primitives';
import { computeVolume, triangleCount } from './mesh';
import { splitMeshByPlane } from './split';

describe('splitMeshByPlane', () => {
  it('splits a unit box through its center into two equal halves', () => {
    const box = createBox();
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const { front, back } = splitMeshByPlane(box, plane);

    expect(front).not.toBeNull();
    expect(back).not.toBeNull();
    expect(computeVolume(front!)).toBeCloseTo(0.5, 6);
    expect(computeVolume(back!)).toBeCloseTo(0.5, 6);
  });

  it('conserves total volume when capping (closed pieces)', () => {
    const box = createBox(2, 3, 4); // volume 24
    const plane = fromNormalAndPoint(createPlane(), [1, 1, 0], [0.3, -0.2, 0]);
    const { front, back } = splitMeshByPlane(box, plane);

    const total = computeVolume(front!) + computeVolume(back!);
    expect(total).toBeCloseTo(24, 6);
    expect(computeVolume(front!)).toBeGreaterThan(0);
    expect(computeVolume(back!)).toBeGreaterThan(0);
  });

  it('splits off-center with the expected volume ratio', () => {
    const box = createBox(); // volume 1, spans x in [-0.5, 0.5]
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0.25, 0, 0]);
    const { front, back } = splitMeshByPlane(box, plane);

    // Front is x in [0.25, 0.5] => thickness 0.25 => volume 0.25.
    expect(computeVolume(front!)).toBeCloseTo(0.25, 6);
    expect(computeVolume(back!)).toBeCloseTo(0.75, 6);
  });

  it('returns the whole mesh on one side when the plane misses it', () => {
    const box = createBox();
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [10, 0, 0]);
    const { front, back } = splitMeshByPlane(box, plane);

    expect(front).toBeNull();
    expect(back).not.toBeNull();
    expect(computeVolume(back!)).toBeCloseTo(1, 6);
  });

  it('produces fewer triangles when capping is disabled', () => {
    const box = createBox();
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const capped = splitMeshByPlane(box, plane, { cap: true });
    const uncapped = splitMeshByPlane(box, plane, { cap: false });

    expect(triangleCount(capped.front!)).toBeGreaterThan(
      triangleCount(uncapped.front!),
    );
  });
});
