import { describe, it, expect } from 'vitest';
import { Mat4, Vec3 } from '@slice/math';
import { createRay, rayAt, screenToNdc, rayFromNdc } from './ray';

describe('ray', () => {
  it('evaluates a point along a ray', () => {
    const ray = createRay();
    ray.origin = [1, 0, 0];
    ray.direction = [0, 0, -1];
    expect(rayAt(ray, 5, Vec3.create())).toEqual([1, 0, -5]);
  });

  it('maps pixels to normalized device coordinates (Y flipped)', () => {
    const [cx, cy] = screenToNdc(400, 300, 800, 600);
    expect(cx).toBeCloseTo(0, 10);
    expect(cy).toBeCloseTo(0, 10);
    expect(screenToNdc(0, 0, 800, 600)).toEqual([-1, 1]);
    expect(screenToNdc(800, 600, 800, 600)).toEqual([1, -1]);
  });

  it('unprojects an NDC point into a world-space ray', () => {
    // With an identity inverse view-projection, NDC maps straight through:
    // near = (x, y, -1), far = (x, y, 1) => direction +Z.
    const ray = rayFromNdc(createRay(), 0, 0, Mat4.create());
    expect(ray.origin).toEqual([0, 0, -1]);
    expect(ray.direction[2]).toBeCloseTo(1, 10);
    expect(Vec3.length(ray.direction)).toBeCloseTo(1, 10);
  });
});
