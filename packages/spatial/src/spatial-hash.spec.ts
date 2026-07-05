import { describe, it, expect } from 'vitest';
import {
  createSpatialHash,
  insert,
  update,
  remove,
  clear,
  has,
  size,
  queryAabb,
  queryPoint,
  querySphere,
  querySegment,
  queryEntity,
  getPotentialPairs,
} from './spatial-hash';
import type { Aabb } from './spatial-hash';

/** Small helper to build an AABB centered at a point. */
function box(x: number, y: number, z: number, half = 0.4): Aabb {
  return {
    min: [x - half, y - half, z - half],
    max: [x + half, y + half, z + half],
  };
}

describe('SpatialHash', () => {
  it('rejects a non-positive cell size', () => {
    expect(() => createSpatialHash(0)).toThrow();
    expect(() => createSpatialHash(-1)).toThrow();
  });

  it('tracks inserted entities', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(0, 0, 0));
    insert(hash, 2, box(5, 0, 0));
    expect(size(hash)).toBe(2);
    expect(has(hash, 1)).toBe(true);
    expect(has(hash, 99)).toBe(false);
  });

  it('queries a region for candidates', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(0, 0, 0));
    insert(hash, 2, box(5, 0, 0));
    const near = queryAabb(hash, box(0, 0, 0, 0.5));
    expect(near).toContain(1);
    expect(near).not.toContain(2);
  });

  it('queries by point and sphere', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(0, 0, 0));
    insert(hash, 2, box(10, 10, 10));
    expect(queryPoint(hash, [0, 0, 0])).toContain(1);
    expect(querySphere(hash, [0, 0, 0], 1)).toContain(1);
    expect(querySphere(hash, [0, 0, 0], 1)).not.toContain(2);
  });

  it('queries along a segment expanded by radius', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(2, 0, 0));
    insert(hash, 2, box(0, 20, 0));
    const hits = querySegment(hash, [0, 0, 0], [4, 0, 0], 0.5);
    expect(hits).toContain(1);
    expect(hits).not.toContain(2);
  });

  it('upserts placement on update so stale cells are dropped', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(0, 0, 0));
    update(hash, 1, box(20, 0, 0));
    expect(queryAabb(hash, box(0, 0, 0, 0.5))).not.toContain(1);
    expect(queryAabb(hash, box(20, 0, 0, 0.5))).toContain(1);
    expect(size(hash)).toBe(1);
  });

  it('removes entities and prunes empty cells', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(0, 0, 0));
    remove(hash, 1);
    expect(has(hash, 1)).toBe(false);
    expect(queryPoint(hash, [0, 0, 0])).toEqual([]);
    expect(hash.cells.size).toBe(0);
  });

  it('finds neighbors sharing a cell', () => {
    const hash = createSpatialHash(2);
    insert(hash, 1, box(0, 0, 0));
    insert(hash, 2, box(0.5, 0, 0));
    insert(hash, 3, box(50, 0, 0));
    expect(queryEntity(hash, 1)).toContain(2);
    expect(queryEntity(hash, 1)).not.toContain(3);
    expect(queryEntity(hash, 1)).not.toContain(1);
  });

  it('generates unique unordered collision pairs', () => {
    const hash = createSpatialHash(2);
    insert(hash, 5, box(0, 0, 0));
    insert(hash, 2, box(0.5, 0, 0));
    insert(hash, 9, box(100, 0, 0));
    const pairs = getPotentialPairs(hash);
    expect(pairs).toEqual([[2, 5]]);
  });

  it('touches only nearby cells for a small query in a large grid', () => {
    const hash = createSpatialHash(1);
    for (let i = 0; i < 100; i++) {
      insert(hash, i, box(i * 5, 0, 0));
    }
    const candidates = queryAabb(hash, box(0, 0, 0, 0.5));
    // Broad-phase should return only the local entity, not all 100.
    expect(candidates.length).toBeLessThan(5);
    expect(candidates).toContain(0);
  });

  it('clears all entities', () => {
    const hash = createSpatialHash(1);
    insert(hash, 1, box(0, 0, 0));
    insert(hash, 2, box(1, 0, 0));
    clear(hash);
    expect(size(hash)).toBe(0);
    expect(hash.cells.size).toBe(0);
  });
});
