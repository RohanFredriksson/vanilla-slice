import type { ReadonlyVec3 } from '@vanilla-slice/math';

/** Identifier for an entity tracked by the spatial structure. */
export type EntityId = number;

/**
 * Axis-aligned bounding box. Structurally compatible with `@vanilla-slice/physics`'s
 * `Aabb`, so bodies' bounds can be passed to spatial queries without a
 * package dependency.
 */
export interface Aabb {
  min: ReadonlyVec3;
  max: ReadonlyVec3;
}

/**
 * Uniform spatial hash grid for broad-phase queries. Entities are bucketed into
 * fixed-size cells so that region/neighbor lookups touch only nearby cells
 * instead of scanning every entity (see ARCHITECTURE.md, performance goals).
 *
 * Queries are broad-phase: they return candidate ids whose cells overlap the
 * query. Narrow-phase filtering is the caller's responsibility.
 */
export interface SpatialHash {
  readonly cellSize: number;
  /** Cell key -> set of entity ids occupying that cell. */
  readonly cells: Map<string, Set<EntityId>>;
  /** Entity id -> the cell keys it currently occupies. */
  readonly entityCells: Map<EntityId, string[]>;
}

/** Create an empty spatial hash with the given (positive) cell size. */
export function createSpatialHash(cellSize: number): SpatialHash {
  if (cellSize <= 0) {
    throw new Error('Spatial hash cell size must be positive.');
  }
  return { cellSize, cells: new Map(), entityCells: new Map() };
}

/** Number of tracked entities. */
export function size(hash: SpatialHash): number {
  return hash.entityCells.size;
}

/** Whether an entity is currently tracked. */
export function has(hash: SpatialHash, id: EntityId): boolean {
  return hash.entityCells.has(id);
}

/** Remove every entity from the grid. */
export function clear(hash: SpatialHash): void {
  hash.cells.clear();
  hash.entityCells.clear();
}

function cellCoord(value: number, cellSize: number): number {
  return Math.floor(value / cellSize);
}

function cellKey(cx: number, cy: number, cz: number): string {
  return `${cx}|${cy}|${cz}`;
}

/**
 * Insert or update an entity by its bounding box (upsert). Existing placement is
 * replaced, so this is safe to call every frame as bodies move.
 */
export function insert(hash: SpatialHash, id: EntityId, aabb: Aabb): void {
  if (hash.entityCells.has(id)) {
    remove(hash, id);
  }

  const { cellSize } = hash;
  const minX = cellCoord(aabb.min[0], cellSize);
  const minY = cellCoord(aabb.min[1], cellSize);
  const minZ = cellCoord(aabb.min[2], cellSize);
  const maxX = cellCoord(aabb.max[0], cellSize);
  const maxY = cellCoord(aabb.max[1], cellSize);
  const maxZ = cellCoord(aabb.max[2], cellSize);

  const keys: string[] = [];
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = cellKey(cx, cy, cz);
        let bucket = hash.cells.get(key);
        if (!bucket) {
          bucket = new Set();
          hash.cells.set(key, bucket);
        }
        bucket.add(id);
        keys.push(key);
      }
    }
  }
  hash.entityCells.set(id, keys);
}

/** Alias of {@link insert}; upserts an entity's placement. */
export function update(hash: SpatialHash, id: EntityId, aabb: Aabb): void {
  insert(hash, id, aabb);
}

/** Remove an entity from the grid. No-op if it is not tracked. */
export function remove(hash: SpatialHash, id: EntityId): void {
  const keys = hash.entityCells.get(id);
  if (!keys) {
    return;
  }
  for (const key of keys) {
    const bucket = hash.cells.get(key);
    if (bucket) {
      bucket.delete(id);
      if (bucket.size === 0) {
        hash.cells.delete(key);
      }
    }
  }
  hash.entityCells.delete(id);
}

function collectRange(
  hash: SpatialHash,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  out: Set<EntityId>,
): void {
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = hash.cells.get(cellKey(cx, cy, cz));
        if (bucket) {
          for (const id of bucket) {
            out.add(id);
          }
        }
      }
    }
  }
}

/** Candidate ids whose cells overlap the region. */
export function queryAabb(hash: SpatialHash, region: Aabb): EntityId[] {
  const { cellSize } = hash;
  const out = new Set<EntityId>();
  collectRange(
    hash,
    cellCoord(region.min[0], cellSize),
    cellCoord(region.min[1], cellSize),
    cellCoord(region.min[2], cellSize),
    cellCoord(region.max[0], cellSize),
    cellCoord(region.max[1], cellSize),
    cellCoord(region.max[2], cellSize),
    out,
  );
  return [...out];
}

/** Candidate ids in the cell containing `point`. */
export function queryPoint(hash: SpatialHash, point: ReadonlyVec3): EntityId[] {
  const { cellSize } = hash;
  const cx = cellCoord(point[0], cellSize);
  const cy = cellCoord(point[1], cellSize);
  const cz = cellCoord(point[2], cellSize);
  const bucket = hash.cells.get(cellKey(cx, cy, cz));
  return bucket ? [...bucket] : [];
}

/** Candidate ids whose cells overlap the sphere's bounding box. */
export function querySphere(
  hash: SpatialHash,
  center: ReadonlyVec3,
  radius: number,
): EntityId[] {
  const { cellSize } = hash;
  const out = new Set<EntityId>();
  collectRange(
    hash,
    cellCoord(center[0] - radius, cellSize),
    cellCoord(center[1] - radius, cellSize),
    cellCoord(center[2] - radius, cellSize),
    cellCoord(center[0] + radius, cellSize),
    cellCoord(center[1] + radius, cellSize),
    cellCoord(center[2] + radius, cellSize),
    out,
  );
  return [...out];
}

/**
 * Candidate ids whose cells overlap the bounding box of a segment expanded by
 * `radius`. Useful for broad-phase filtering of a slice volume before precise
 * plane tests in the slicing package.
 */
export function querySegment(
  hash: SpatialHash,
  a: ReadonlyVec3,
  b: ReadonlyVec3,
  radius = 0,
): EntityId[] {
  const { cellSize } = hash;
  const out = new Set<EntityId>();
  collectRange(
    hash,
    cellCoord(Math.min(a[0], b[0]) - radius, cellSize),
    cellCoord(Math.min(a[1], b[1]) - radius, cellSize),
    cellCoord(Math.min(a[2], b[2]) - radius, cellSize),
    cellCoord(Math.max(a[0], b[0]) + radius, cellSize),
    cellCoord(Math.max(a[1], b[1]) + radius, cellSize),
    cellCoord(Math.max(a[2], b[2]) + radius, cellSize),
    out,
  );
  return [...out];
}

/** Candidate ids sharing a cell with entity `id`, excluding `id` itself. */
export function queryEntity(hash: SpatialHash, id: EntityId): EntityId[] {
  const keys = hash.entityCells.get(id);
  if (!keys) {
    return [];
  }
  const out = new Set<EntityId>();
  for (const key of keys) {
    const bucket = hash.cells.get(key);
    if (bucket) {
      for (const other of bucket) {
        if (other !== id) {
          out.add(other);
        }
      }
    }
  }
  return [...out];
}

/**
 * All unique unordered candidate pairs that share at least one cell. Each pair
 * is returned as `[a, b]` with `a < b`. This is the broad-phase input to
 * narrow-phase collision detection, avoiding an O(n²) all-pairs scan.
 */
export function getPotentialPairs(hash: SpatialHash): Array<[EntityId, EntityId]> {
  const seen = new Set<string>();
  const pairs: Array<[EntityId, EntityId]> = [];
  for (const bucket of hash.cells.values()) {
    if (bucket.size < 2) {
      continue;
    }
    const ids = [...bucket];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        const key = `${lo}|${hi}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([lo, hi]);
        }
      }
    }
  }
  return pairs;
}

/** Every tracked entity id (used by unbounded queries). */
export function queryAll(hash: SpatialHash): EntityId[] {
  return [...hash.entityCells.keys()];
}
