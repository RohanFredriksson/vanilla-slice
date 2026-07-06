import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { createBox, rayFromNdc } from '@vanilla-slice/core';
import type { Mesh } from '@vanilla-slice/core';
import { Vec3 } from '@vanilla-slice/math';
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

  it('leaves uv/tex3/groups off a positions-only mesh', () => {
    const geometry = meshToBufferGeometry(createBox());
    expect(geometry.getAttribute('uv')).toBeUndefined();
    expect(geometry.getAttribute('tex3')).toBeUndefined();
    expect(geometry.getAttribute('tangent')).toBeUndefined();
    expect(geometry.groups).toHaveLength(0);
  });

  it('computes exterior tangents when UVs are present (ADR 0010 P6)', () => {
    const mesh: Mesh = {
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 0, 2, 3],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    };
    const geometry = meshToBufferGeometry(mesh);
    const tangent = geometry.getAttribute('tangent');
    expect(tangent).toBeDefined();
    expect(tangent.itemSize).toBe(4);
    expect(tangent.count).toBe(4);
  });

  it('uploads uv and tex3 attributes and coalesces groups (ADR 0010)', () => {
    // A quad (two triangles): exterior (slot 0) then interior/cut (slot 1).
    const mesh: Mesh = {
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 0, 2, 3],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      tex3: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      groups: [0, 1],
    };
    const geometry = meshToBufferGeometry(mesh);

    expect(geometry.getAttribute('uv').count).toBe(4);
    const tex3 = geometry.getAttribute('tex3');
    expect(tex3.itemSize).toBe(3);
    expect(tex3.count).toBe(4);

    // Two runs → two groups, each one triangle (3 indices).
    expect(geometry.groups).toHaveLength(2);
    expect(geometry.groups[0]).toMatchObject({ start: 0, count: 3, materialIndex: 0 });
    expect(geometry.groups[1]).toMatchObject({ start: 3, count: 3, materialIndex: 1 });
  });

  it('coalesces adjacent same-slot triangles into one group', () => {
    const mesh: Mesh = {
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 0, 2, 3, 0, 1, 3],
      tex3: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      groups: [0, 0, 1],
    };
    const geometry = meshToBufferGeometry(mesh);
    expect(geometry.groups).toHaveLength(2);
    expect(geometry.groups[0]).toMatchObject({ start: 0, count: 6, materialIndex: 0 });
    expect(geometry.groups[1]).toMatchObject({ start: 6, count: 3, materialIndex: 1 });
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
