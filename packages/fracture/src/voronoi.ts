import {
  splitMeshByPlane,
  computeBounds,
  vertexCount,
  getVertex,
  cloneMesh,
  isEmpty,
  hullFromConvexMesh,
  translateHull,
} from '@vanilla-slice/geometry';
import type { Mesh, Plane, SplitOptions } from '@vanilla-slice/geometry';
import { createRng } from './rng';
import type { FractureFragment, FractureOptions, Vec3T } from './types';

const DEFAULT_COUNT = 4;
/** Upper bound on seeds (fragment budget) — memory/perf guard (ADR 0009). */
const MAX_SEEDS = 64;

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(Math.max(x, 0), 1) : 0;
}

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
function resolveSeeds(
  worldMesh: Mesh,
  options: FractureOptions,
  origin: Vec3T,
): Vec3T[] {
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
  const spread = clamp01(options.propagation ?? 1);
  const seeds: Vec3T[] = [];
  for (let i = 0; i < count; i++) {
    const ux = min[0] + rng() * (max[0] - min[0]);
    const uy = min[1] + rng() * (max[1] - min[1]);
    const uz = min[2] + rng() * (max[2] - min[2]);
    // Low propagation clusters seeds near the fracture origin (localized shatter);
    // high propagation (→1) spreads them uniformly (the crack runs through the
    // whole body). `t` is the fraction from origin toward the uniform sample.
    const t = spread + (1 - spread) * rng() ** 3;
    seeds.push([
      origin[0] + (ux - origin[0]) * t,
      origin[1] + (uy - origin[1]) * t,
      origin[2] + (uz - origin[2]) * t,
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

/** Maximum distance from point `p` to any vertex of `mesh`. */
function maxVertexDistance(mesh: Mesh, p: Vec3T): number {
  const count = vertexCount(mesh);
  const v: Vec3T = [0, 0, 0];
  let maxSq = 0;
  for (let k = 0; k < count; k++) {
    getVertex(mesh, k, v);
    const dx = v[0] - p[0];
    const dy = v[1] - p[1];
    const dz = v[2] - p[2];
    const s = dx * dx + dy * dy + dz * dz;
    if (s > maxSq) {
      maxSq = s;
    }
  }
  return Math.sqrt(maxSq);
}

/**
 * Fracture a world-space mesh into fragments using a **Voronoi decomposition**:
 * each seed's cell is the mesh clipped by the bisecting plane against nearer
 * seeds (keeping the half-space nearer that seed). Cells are capped so each
 * fragment is a closed solid. Seeds come from explicit points, a normalized
 * pattern, or a deterministic RNG (runtime generation).
 *
 * **Neighbour-limited (exact):** for each cell the other seeds are visited in
 * order of increasing distance, and clipping stops once the nearest remaining
 * bisector can no longer reach the shrinking cell (`distance / 2 >= cell
 * radius`). A farther seed's bisector lies entirely outside the cell, so it
 * cannot bound it — skipping it yields the *same* result as clipping against
 * every seed while turning the O(n²) clip into ~O(n·k). This is an exact
 * optimisation, not an approximation (no fragment overlap).
 *
 * Returns fewer than two fragments when the mesh does not meaningfully divide;
 * the caller (core) then leaves the object intact. Fragment count is bounded by
 * `MAX_SEEDS` (ADR 0009).
 */
export function fractureMesh(
  worldMesh: Mesh,
  options: FractureOptions = {},
): FractureFragment[] {
  const origin = options.origin ?? centroidOf(worldMesh);
  const seeds = resolveSeeds(worldMesh, options, origin);
  if (seeds.length < 2) {
    return [];
  }
  const cap = options.cap ?? true;
  const separationSpeed = options.separationSpeed ?? 1;
  const splitOptions: SplitOptions = options.capToMaterialSpace
    ? { cap, capToMaterialSpace: options.capToMaterialSpace }
    : { cap };
  const fragments: FractureFragment[] = [];

  // Reused per cell: other seeds ordered by distance to the current seed.
  const order: Array<{ index: number; distance: number }> = [];

  for (let i = 0; i < seeds.length; i++) {
    const si = seeds[i]!;
    order.length = 0;
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) {
        continue;
      }
      const sj = seeds[j]!;
      const dx = sj[0] - si[0];
      const dy = sj[1] - si[1];
      const dz = sj[2] - si[2];
      order.push({ index: j, distance: Math.hypot(dx, dy, dz) });
    }
    order.sort((a, b) => a.distance - b.distance || a.index - b.index);

    let cell: Mesh | null = cloneMesh(worldMesh);
    let radius = maxVertexDistance(cell, si);
    for (const { index, distance } of order) {
      if (!cell) {
        break;
      }
      // The bisector to a seed at `distance` sits `distance / 2` from seed i.
      // Once that exceeds the cell's reach from seed i, this and every farther
      // (sorted) seed cannot cut the cell — it is final.
      if (distance * 0.5 >= radius) {
        break;
      }
      const plane = bisector(si, seeds[index]!);
      if (!plane) {
        continue;
      }
      // Normal points toward the other seed, so the half-space nearer seed i is
      // `back`.
      cell = splitMeshByPlane(cell, plane, splitOptions).back;
      if (cell) {
        radius = maxVertexDistance(cell, si);
      }
    }
    if (!cell || isEmpty(cell)) {
      continue;
    }
    const centroid = centroidOf(cell);
    const dx = centroid[0] - origin[0];
    const dy = centroid[1] - origin[1];
    const dz = centroid[2] - origin[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    // Fragments are convex, so build the collider with the fast hull and express
    // it in centroid-local space (the body spawns at `centroid`, identity rot).
    const hull = translateHull(hullFromConvexMesh(cell), [
      -centroid[0],
      -centroid[1],
      -centroid[2],
    ]);
    fragments.push({
      mesh: cell,
      centroid,
      hull,
      impulse: [
        (dx / len) * separationSpeed,
        (dy / len) * separationSpeed,
        (dz / len) * separationSpeed,
      ],
    });
  }
  return fragments;
}
