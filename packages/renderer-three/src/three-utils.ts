import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  type PerspectiveCamera,
  type OrthographicCamera,
} from 'three';
import type { Mesh as EngineMesh } from '@vanilla-slice/core';
import { Mat4 } from '@vanilla-slice/math';

/** Column-major 4x4 matrix (matches `@vanilla-slice/math`'s `Mat4`). */
type Mat4T = ReturnType<typeof Mat4.create>;

type Camera = PerspectiveCamera | OrthographicCamera;

/**
 * Convert an engine mesh (flat positions + indices) to a Three.js
 * `BufferGeometry`, computing smooth vertex normals. Rendering owns the GPU
 * geometry; the engine mesh is never mutated.
 *
 * Optional attribute channels are uploaded when present (ADR 0010): `uvs` as the
 * standard `uv` attribute, `tex3` (rest-pose/model-space coordinate) as a custom
 * `tex3` attribute for solid/triplanar interior shaders, and per-triangle
 * `groups` coalesced into geometry groups so a material array can paint exterior
 * (slot 0) and interior/cut (slot 1) faces differently.
 */
export function meshToBufferGeometry(mesh: EngineMesh): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(mesh.positions.slice(), 3),
  );
  if (mesh.uvs) {
    geometry.setAttribute('uv', new Float32BufferAttribute(mesh.uvs.slice(), 2));
  }
  if (mesh.tex3) {
    geometry.setAttribute(
      'tex3',
      new Float32BufferAttribute(mesh.tex3.slice(), 3),
    );
  }
  geometry.setIndex(mesh.indices.slice());
  geometry.computeVertexNormals();
  if (mesh.uvs) {
    // Exterior tangent-space normal mapping (ADR 0010 P6): tangents are derived
    // from positions + uv + normal, so a slot-0 material's `normalMap` works
    // without carrying tangents through the engine or the split.
    geometry.computeTangents();
  }
  if (mesh.groups) {
    applyGroups(geometry, mesh.groups);
  }
  return geometry;
}

/**
 * Coalesce a per-triangle material-slot list into contiguous geometry groups so
 * the mesh can carry a material array (exterior/interior). Indices are three per
 * triangle, so ranges are expressed in index units.
 */
function applyGroups(geometry: BufferGeometry, groups: number[]): void {
  geometry.clearGroups();
  if (groups.length === 0) {
    return;
  }
  let runStart = 0;
  let runSlot = groups[0] ?? 0;
  for (let t = 1; t <= groups.length; t++) {
    const slot = groups[t];
    if (t === groups.length || slot !== runSlot) {
      geometry.addGroup(runStart * 3, (t - runStart) * 3, runSlot);
      runStart = t;
      runSlot = slot ?? 0;
    }
  }
}

/**
 * Compute the inverse view-projection matrix of a Three.js camera as a
 * `@vanilla-slice/math` `Mat4`. Three's `Matrix4.elements` are column-major, matching
 * the engine's matrix layout, so the elements copy across directly.
 *
 * The result feeds `@vanilla-slice/slicing`'s `rayFromNdc` / `rayFromScreen` to convert
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
