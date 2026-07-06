import { describe, it, expect } from 'vitest';
import { Vec2, Vec3, Mat4 } from '@vanilla-slice/math';
import {
  createMesh,
  vertexCount,
  triangleCount,
  getVertex,
  getUv,
  getTex3,
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

  it('leaves attribute channels untouched when transforming positions', () => {
    const mesh = createMesh([1, 1, 1], [], {
      uvs: [0.25, 0.75],
      tex3: [1, 1, 1],
      groups: [0],
    });
    transformMesh(mesh, Mat4.fromTranslation(Mat4.create(), [10, 20, 30]));
    // tex3 is a rest-pose coordinate — invariant under the pose transform.
    expect(mesh.tex3).toEqual([1, 1, 1]);
    expect(mesh.uvs).toEqual([0.25, 0.75]);
    expect(mesh.groups).toEqual([0]);
  });
});

describe('mesh attribute channels (ADR 0010)', () => {
  it('attaches only the provided channels', () => {
    const bare = createMesh([0, 0, 0], [0]);
    expect(bare.uvs).toBeUndefined();
    expect(bare.tex3).toBeUndefined();
    expect(bare.groups).toBeUndefined();

    const attributed = createMesh([0, 0, 0], [0], {
      uvs: [0.5, 0.5],
      tex3: [1, 2, 3],
      groups: [1],
    });
    expect(attributed.uvs).toEqual([0.5, 0.5]);
    expect(attributed.tex3).toEqual([1, 2, 3]);
    expect(attributed.groups).toEqual([1]);
  });

  it('deep-copies attribute channels on clone', () => {
    const mesh = createMesh([0, 0, 0, 1, 1, 1], [0, 1, 0], {
      uvs: [0, 0, 1, 1],
      tex3: [0, 0, 0, 1, 1, 1],
      groups: [0],
    });
    const copy = cloneMesh(mesh);
    copy.uvs![0] = 9;
    copy.tex3![0] = 9;
    copy.groups![0] = 9;
    expect(mesh.uvs![0]).toBe(0);
    expect(mesh.tex3![0]).toBe(0);
    expect(mesh.groups![0]).toBe(0);
  });

  it('reads uv and tex3 by vertex index, defaulting to zero when absent', () => {
    const mesh = createMesh([0, 0, 0, 1, 1, 1], [0, 1, 0], {
      uvs: [0.1, 0.2, 0.3, 0.4],
      tex3: [5, 6, 7, 8, 9, 10],
    });
    expect(getUv(mesh, 1, Vec2.create())).toEqual([0.3, 0.4]);
    expect(getTex3(mesh, 1, Vec3.create())).toEqual([8, 9, 10]);

    const bare = createMesh([0, 0, 0], [0]);
    expect(getUv(bare, 0, Vec2.create())).toEqual([0, 0]);
    expect(getTex3(bare, 0, Vec3.create())).toEqual([0, 0, 0]);
  });
});
