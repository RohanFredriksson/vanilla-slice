import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  type PerspectiveCamera,
  type OrthographicCamera,
} from 'three';
import type { Mesh as EngineMesh } from '@slice/core';
import { Mat4 } from '@slice/math';

/** Column-major 4x4 matrix (matches `@slice/math`'s `Mat4`). */
type Mat4T = ReturnType<typeof Mat4.create>;

type Camera = PerspectiveCamera | OrthographicCamera;

/**
 * Convert an engine mesh (flat positions + indices) to a Three.js
 * `BufferGeometry`, computing smooth vertex normals. Rendering owns the GPU
 * geometry; the engine mesh is never mutated.
 */
export function meshToBufferGeometry(mesh: EngineMesh): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(mesh.positions.slice(), 3),
  );
  geometry.setIndex(mesh.indices.slice());
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Compute the inverse view-projection matrix of a Three.js camera as a
 * `@slice/math` `Mat4`. Three's `Matrix4.elements` are column-major, matching
 * the engine's matrix layout, so the elements copy across directly.
 *
 * The result feeds `@slice/slicing`'s `rayFromNdc` / `rayFromScreen` to convert
 * a screen gesture into a world-space ray.
 */
export function inverseViewProjection(camera: Camera): Mat4T {
  camera.updateMatrixWorld();
  const viewProjection = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  const inverse = viewProjection.invert();
  const e = inverse.elements;
  return [
    e[0]!, e[1]!, e[2]!, e[3]!,
    e[4]!, e[5]!, e[6]!, e[7]!,
    e[8]!, e[9]!, e[10]!, e[11]!,
    e[12]!, e[13]!, e[14]!, e[15]!,
  ];
}
