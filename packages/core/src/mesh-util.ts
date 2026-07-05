import { createMesh, getVertex, vertexCount } from '@slice/geometry';
import type { Mesh } from '@slice/geometry';
import type { Aabb } from '@slice/physics';
import type { Vec3T } from './types';

/** Return a copy of `mesh` with every vertex shifted so `center` becomes the origin. */
export function recenterMesh(mesh: Mesh, center: Vec3T): Mesh {
  const positions = mesh.positions.slice();
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] ?? 0) - center[0];
    positions[i + 1] = (positions[i + 1] ?? 0) - center[1];
    positions[i + 2] = (positions[i + 2] ?? 0) - center[2];
  }
  return createMesh(positions, mesh.indices.slice());
}

/** Maximum distance from `center` to any vertex — a bounding-sphere radius. */
export function boundingRadius(mesh: Mesh, center: Vec3T = [0, 0, 0]): number {
  const count = vertexCount(mesh);
  const v: Vec3T = [0, 0, 0];
  let maxSq = 0;
  for (let i = 0; i < count; i++) {
    getVertex(mesh, i, v);
    const dx = v[0] - center[0];
    const dy = v[1] - center[1];
    const dz = v[2] - center[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > maxSq) {
      maxSq = distSq;
    }
  }
  return Math.sqrt(maxSq);
}

/** Axis-aligned bounds of a bounding sphere at `center` with `radius`. */
export function sphereAabb(center: Vec3T, radius: number): Aabb {
  return {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
}
