import { Vec2, Vec3 } from '@vanilla-slice/math';
import type { ReadonlyMat4 } from '@vanilla-slice/math';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
type Vec3T = ReturnType<typeof Vec3.create>;
/** Mutable 2-component vector (matches `@vanilla-slice/math`'s `Vec2`). */
type Vec2T = ReturnType<typeof Vec2.create>;

/**
 * A triangle mesh stored as flat, non-interleaved arrays.
 *
 * - `positions` holds vertex coordinates as `[x, y, z, x, y, z, ...]`.
 * - `indices` holds triangle vertex indices; its length is a multiple of 3.
 *
 * Normals are not stored; they are derived on demand via
 * {@link computeVertexNormals}. This keeps the representation minimal and lets
 * slicing operate purely on positions.
 *
 * The optional attribute channels support textured cutting and fracture
 * (ADR 0010). They are absent by default, so the positions-only path is
 * unchanged. When present they run parallel to `positions`:
 *
 * - `uvs` — 2 per vertex, the source model's texture coordinates.
 * - `tex3` — 3 per vertex, a rest-pose (model-space) coordinate that drives
 *   solid/triplanar texturing of newly-exposed interior surfaces; it is
 *   invariant under the rigid transforms applied while cutting, so interior
 *   textures stay welded to the material as fragments move.
 * - `groups` — 1 per *triangle* (length `indices.length / 3`): the material
 *   slot a face belongs to (`0` = exterior skin, `1` = interior/cut surface).
 */
export interface Mesh {
  positions: number[];
  indices: number[];
  uvs?: number[];
  tex3?: number[];
  groups?: number[];
}

/** Optional attribute channels attachable to a {@link Mesh}. */
export interface MeshAttributes {
  uvs?: number[];
  tex3?: number[];
  groups?: number[];
}

/** Axis-aligned bounding box. */
export interface Bounds {
  min: Vec3T;
  max: Vec3T;
}

/**
 * Create a mesh from raw position/index arrays (references, not copies).
 * Optional attribute channels are attached only when provided (ADR 0010).
 */
export function createMesh(
  positions: number[] = [],
  indices: number[] = [],
  attributes: MeshAttributes = {},
): Mesh {
  const mesh: Mesh = { positions, indices };
  if (attributes.uvs) mesh.uvs = attributes.uvs;
  if (attributes.tex3) mesh.tex3 = attributes.tex3;
  if (attributes.groups) mesh.groups = attributes.groups;
  return mesh;
}

/** Number of vertices in the mesh. */
export function vertexCount(mesh: Mesh): number {
  return mesh.positions.length / 3;
}

/** Number of triangles in the mesh. */
export function triangleCount(mesh: Mesh): number {
  return mesh.indices.length / 3;
}

/** Read vertex `index` into `out`. */
export function getVertex(mesh: Mesh, index: number, out: Vec3T): Vec3T {
  const base = index * 3;
  out[0] = mesh.positions[base] ?? 0;
  out[1] = mesh.positions[base + 1] ?? 0;
  out[2] = mesh.positions[base + 2] ?? 0;
  return out;
}

/** Read the UV of vertex `index` into `out`. Returns `[0, 0]` when absent. */
export function getUv(mesh: Mesh, index: number, out: Vec2T): Vec2T {
  const uvs = mesh.uvs;
  const base = index * 2;
  out[0] = uvs?.[base] ?? 0;
  out[1] = uvs?.[base + 1] ?? 0;
  return out;
}

/**
 * Read the rest-pose (model-space) coordinate of vertex `index` into `out`.
 * Returns `[0, 0, 0]` when absent.
 */
export function getTex3(mesh: Mesh, index: number, out: Vec3T): Vec3T {
  const tex3 = mesh.tex3;
  const base = index * 3;
  out[0] = tex3?.[base] ?? 0;
  out[1] = tex3?.[base + 1] ?? 0;
  out[2] = tex3?.[base + 2] ?? 0;
  return out;
}

/** Deep-copy a mesh, including any optional attribute channels. */
export function cloneMesh(mesh: Mesh): Mesh {
  const clone: Mesh = {
    positions: mesh.positions.slice(),
    indices: mesh.indices.slice(),
  };
  if (mesh.uvs) clone.uvs = mesh.uvs.slice();
  if (mesh.tex3) clone.tex3 = mesh.tex3.slice();
  if (mesh.groups) clone.groups = mesh.groups.slice();
  return clone;
}

/** Whether the mesh has no triangles. */
export function isEmpty(mesh: Mesh): boolean {
  return mesh.indices.length === 0;
}

/** Compute the axis-aligned bounds of the mesh. */
export function computeBounds(mesh: Mesh): Bounds {
  const min: Vec3T = [Infinity, Infinity, Infinity];
  const max: Vec3T = [-Infinity, -Infinity, -Infinity];
  const { positions } = mesh;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] ?? 0;
    const y = positions[i + 1] ?? 0;
    const z = positions[i + 2] ?? 0;
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
  return { min, max };
}

/**
 * Compute smooth per-vertex normals by accumulating (area-weighted) face
 * normals. Returns a flat array parallel to `positions`.
 */
export function computeVertexNormals(mesh: Mesh): number[] {
  const { positions, indices } = mesh;
  const normals = new Array<number>(positions.length).fill(0);

  const a: Vec3T = [0, 0, 0];
  const b: Vec3T = [0, 0, 0];
  const c: Vec3T = [0, 0, 0];
  const ab: Vec3T = [0, 0, 0];
  const ac: Vec3T = [0, 0, 0];
  const faceNormal: Vec3T = [0, 0, 0];

  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t] ?? 0;
    const i1 = indices[t + 1] ?? 0;
    const i2 = indices[t + 2] ?? 0;
    getVertex(mesh, i0, a);
    getVertex(mesh, i1, b);
    getVertex(mesh, i2, c);
    Vec3.subtract(ab, b, a);
    Vec3.subtract(ac, c, a);
    // Non-normalized cross product => area-weighted contribution.
    Vec3.cross(faceNormal, ab, ac);
    for (const index of [i0, i1, i2]) {
      const base = index * 3;
      normals[base] = (normals[base] ?? 0) + faceNormal[0];
      normals[base + 1] = (normals[base + 1] ?? 0) + faceNormal[1];
      normals[base + 2] = (normals[base + 2] ?? 0) + faceNormal[2];
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i] ?? 0;
    const ny = normals[i + 1] ?? 0;
    const nz = normals[i + 2] ?? 0;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      normals[i] = nx / len;
      normals[i + 1] = ny / len;
      normals[i + 2] = nz / len;
    }
  }
  return normals;
}

/**
 * Signed volume of a closed mesh via the divergence theorem (sum of signed
 * tetrahedron volumes). Requires consistent outward-facing winding; the sign is
 * positive for counter-clockwise (outward) faces.
 */
export function computeVolume(mesh: Mesh): number {
  const { indices } = mesh;
  const a: Vec3T = [0, 0, 0];
  const b: Vec3T = [0, 0, 0];
  const c: Vec3T = [0, 0, 0];
  const cross: Vec3T = [0, 0, 0];
  let sum = 0;
  for (let t = 0; t < indices.length; t += 3) {
    getVertex(mesh, indices[t] ?? 0, a);
    getVertex(mesh, indices[t + 1] ?? 0, b);
    getVertex(mesh, indices[t + 2] ?? 0, c);
    Vec3.cross(cross, b, c);
    sum += Vec3.dot(a, cross);
  }
  return sum / 6;
}

/** Transform all vertex positions of `mesh` by column-major matrix `m`. */
export function transformMesh(mesh: Mesh, m: ReadonlyMat4): Mesh {
  const v: Vec3T = [0, 0, 0];
  const positions = mesh.positions;
  for (let i = 0; i < positions.length; i += 3) {
    v[0] = positions[i] ?? 0;
    v[1] = positions[i + 1] ?? 0;
    v[2] = positions[i + 2] ?? 0;
    Vec3.transformMat4(v, v, m);
    positions[i] = v[0];
    positions[i + 1] = v[1];
    positions[i + 2] = v[2];
  }
  return mesh;
}
