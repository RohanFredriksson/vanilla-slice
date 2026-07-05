import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';

type Vec3T = ReturnType<typeof Vec3.create>;

/** Axis-aligned bounding box. */
export interface Aabb {
  min: Vec3T;
  max: Vec3T;
}

/** Create an AABB from explicit min/max corners (cloned). */
export function createAabb(min: ReadonlyVec3, max: ReadonlyVec3): Aabb {
  return { min: Vec3.clone(min), max: Vec3.clone(max) };
}

/** Create an AABB from a center point and half-extents. */
export function aabbFromCenterHalfExtents(
  center: ReadonlyVec3,
  halfExtents: ReadonlyVec3,
): Aabb {
  return {
    min: [
      center[0] - halfExtents[0],
      center[1] - halfExtents[1],
      center[2] - halfExtents[2],
    ],
    max: [
      center[0] + halfExtents[0],
      center[1] + halfExtents[1],
      center[2] + halfExtents[2],
    ],
  };
}

/** Whether two AABBs overlap (touching counts as overlapping). */
export function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}

/** Whether an AABB contains a point (inclusive of the boundary). */
export function aabbContainsPoint(a: Aabb, point: ReadonlyVec3): boolean {
  return (
    point[0] >= a.min[0] &&
    point[0] <= a.max[0] &&
    point[1] >= a.min[1] &&
    point[1] <= a.max[1] &&
    point[2] >= a.min[2] &&
    point[2] <= a.max[2]
  );
}

/** Grow `out` in place to include `point`. */
export function aabbExpandByPoint(out: Aabb, point: ReadonlyVec3): Aabb {
  out.min[0] = Math.min(out.min[0], point[0]);
  out.min[1] = Math.min(out.min[1], point[1]);
  out.min[2] = Math.min(out.min[2], point[2]);
  out.max[0] = Math.max(out.max[0], point[0]);
  out.max[1] = Math.max(out.max[1], point[1]);
  out.max[2] = Math.max(out.max[2], point[2]);
  return out;
}
