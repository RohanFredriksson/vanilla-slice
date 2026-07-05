import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { createBox, rayFromNdc } from '@slice/core';
import { Vec3 } from '@slice/math';
import { meshToBufferGeometry, inverseViewProjection } from './three-utils';

describe('meshToBufferGeometry', () => {
  it('converts positions, indices, and computes normals', () => {
    const geometry = meshToBufferGeometry(createBox());
    expect(geometry.getAttribute('position').count).toBe(8);
    expect(geometry.getIndex()!.count).toBe(36);
    expect(geometry.getAttribute('normal')).toBeDefined();
  });

  it('does not alias the engine mesh arrays', () => {
    const mesh = createBox();
    const geometry = meshToBufferGeometry(mesh);
    mesh.positions[0] = 999;
    const position = geometry.getAttribute('position');
    expect(position.getX(0)).not.toBe(999);
  });
});

describe('inverseViewProjection', () => {
  it('returns a 16-element column-major matrix', () => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    const inv = inverseViewProjection(camera);
    expect(inv).toHaveLength(16);
  });

  it('unprojects a center NDC point into a ray toward the scene', () => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    const inv = inverseViewProjection(camera);

    const ray = rayFromNdc(
      { origin: [0, 0, 0], direction: [0, 0, -1] },
      0,
      0,
      inv,
    );
    // Camera looks down -Z from +5, so the center ray points toward -Z.
    expect(ray.direction[2]).toBeLessThan(0);
    expect(Vec3.length(ray.direction)).toBeCloseTo(1, 6);
  });
});
