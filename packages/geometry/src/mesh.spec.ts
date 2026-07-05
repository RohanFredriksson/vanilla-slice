import { describe, it, expect } from 'vitest';
import { Vec3, Mat4 } from '@vanilla-slice/math';
import {
  createMesh,
  vertexCount,
  triangleCount,
  getVertex,
  cloneMesh,
  computeBounds,
  computeVertexNormals,
  computeVolume,
  transformMesh,
} from './mesh';
import { createBox } from './primitives';

describe('mesh', () => {
  it('reports vertex and triangle counts', () => {
    const box = createBox();
    expect(vertexCount(box)).toBe(8);
    expect(triangleCount(box)).toBe(12);
  });

  it('reads vertices and clones independently', () => {
    const mesh = createMesh([1, 2, 3, 4, 5, 6], [0, 1, 0]);
    expect(getVertex(mesh, 1, Vec3.create())).toEqual([4, 5, 6]);
    const copy = cloneMesh(mesh);
    copy.positions[0] = 99;
    expect(mesh.positions[0]).toBe(1);
  });

  it('computes bounds of a box', () => {
    const box = createBox(2, 4, 6);
    const bounds = computeBounds(box);
    expect(bounds.min).toEqual([-1, -2, -3]);
    expect(bounds.max).toEqual([1, 2, 3]);
  });

  it('computes a unit-length normal per vertex', () => {
    const box = createBox();
    const normals = computeVertexNormals(box);
    expect(normals.length).toBe(box.positions.length);
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!);
      expect(len).toBeCloseTo(1, 6);
    }
  });

  it('computes the volume of a box from its winding', () => {
    expect(computeVolume(createBox(2, 3, 4))).toBeCloseTo(24, 6);
    expect(computeVolume(createBox())).toBeCloseTo(1, 6);
  });

  it('transforms vertex positions in place', () => {
    const mesh = createMesh([1, 1, 1], []);
    transformMesh(mesh, Mat4.fromTranslation(Mat4.create(), [10, 20, 30]));
    expect(mesh.positions).toEqual([11, 21, 31]);
  });
});
