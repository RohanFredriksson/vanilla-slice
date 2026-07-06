import {
  splitMeshByPlane,
  computeBounds,
  vertexCount,
  getVertex,
  cloneMesh,
  isEmpty,
} from '@vanilla-slice/geometry';
import type { Mesh, Plane } from '@vanilla-slice/geometry';
import { createRng } from './rng';
import type { FractureFragment, FractureOptions, Vec3T } from './types';

const DEFAULT_COUNT = 4;
/** Upper bound on seeds (fragment budget) — memory/perf guard (ADR 0009). */
const MAX_SEEDS = 64;

/** Average vertex position of a mesh. */
function centroidOf(mesh: Mesh): Vec3T {
  const centroid: Vec3T = [0, 0, 0];
  const count = vertexCount(mesh);
  if (count === 0) {
    return centroid;
  }
  const v: Vec3T = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    getVertex(mesh, i, v);
    centroid[0] += v[0];
    centroid[1] += v[1];
    centroid[2] += v[2];
  }
  centroid[0] /= count;
  centroid[1] /= count;
  centroid[2] /= count;
  return centroid;
}

/** Resolve the world-space seed points to build Voronoi cells around. */
function resolveSeeds(worldMesh: Mesh, options: FractureOptions): Vec3T[] {
  if (options.seeds && options.seeds.length > 0) {
    return options.seeds.slice(0, MAX_SEEDS).map((s) => [s[0], s[1], s[2]]);
  }
  const { min, max } = computeBounds(worldMesh);
  if (options.pattern && options.pattern.seeds.length > 0) {
    return options.pattern.seeds.slice(0, MAX_SEEDS).map((s) => [
      min[0] + s[0] * (max[0] - min[0]),
      min[1] + s[1] * (max[1] - min[1]),
      min[2] + s[2] * (max[2] - min[2]),
    ]);
  }
  const count = Math.max(2, Math.min(options.count ?? DEFAULT_COUNT, MAX_SEEDS));
  const rng = createRng(options.seed ?? 1);
  const seeds: Vec3T[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push([
      min[0] + rng() * (max[0] - min[0]),
      min[1] + rng() * (max[1] - min[1]),
      min[2] + rng() * (max[2] - min[2]),
    ]);
  }
  return seeds;
}

/**
 * The bisecting plane of two seeds (the set of points equidistant to both), with
 * its normal pointing toward `b`. Returns `null` for coincident seeds.
 */
function bisector(a: Vec3T, b: Vec3T): Plane | null {
  const nx = b[0] - a[0];
  const ny = b[1] - a[1];
  const nz = b[2] - a[2];
  const len = Math.hypot(nx, ny, nz);
  if (len === 0) {
    return null;
  }
  const normal: Vec3T = [nx / len, ny / len, nz / len];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const mz = (a[2] + b[2]) / 2;
  return { normal, constant: -(normal[0] * mx + normal[1] * my + normal[2] * mz) };
}

/**
 * Fracture a world-space mesh into fragments using a **Voronoi decomposition**:
 * each seed's cell is the mesh clipped by the bisecting plane against every
 * other seed (keeping the half-space nearer that seed). Cells are capped so each
 * fragment is a closed solid. Seeds come from explicit points, a normalized
 * pattern, or a deterministic RNG (runtime generation).
 *
 * Returns fewer than two fragments when the mesh does not meaningfully divide;
 * the caller (core) then leaves the object intact. Fragment count is bounded by
 * `MAX_SEEDS` to cap geometry/memory cost (ADR 0009).
 */
export function fractureMesh(
  worldMesh: Mesh,
  options: FractureOptions = {},
): FractureFragment[] {
  const seeds = resolveSeeds(worldMesh, options);
  if (seeds.length < 2) {
    return [];
  }
  const cap = options.cap ?? true;
  const separationSpeed = options.separationSpeed ?? 1;
  const origin = options.origin ?? centroidOf(worldMesh);
  const fragments: FractureFragment[] = [];

  for (let i = 0; i < seeds.length; i++) {
    let cell: Mesh | null = cloneMesh(worldMesh);
    for (let j = 0; j < seeds.length && cell; j++) {
      if (i === j) {
        continue;
      }
      const plane = bisector(seeds[i]!, seeds[j]!);
      if (!plane) {
        continue;
      }
      // Normal points toward seed j, so the half-space nearer seed i is `back`.
      cell = splitMeshByPlane(cell, plane, { cap }).back;
    }
    if (!cell || isEmpty(cell)) {
      continue;
    }
    const centroid = centroidOf(cell);
    const dx = centroid[0] - origin[0];
    const dy = centroid[1] - origin[1];
    const dz = centroid[2] - origin[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    fragments.push({
      mesh: cell,
      centroid,
      impulse: [
        (dx / len) * separationSpeed,
        (dy / len) * separationSpeed,
        (dz / len) * separationSpeed,
      ],
    });
  }
  return fragments;
}
