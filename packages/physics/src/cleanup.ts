import type { ReadonlyVec3 } from '@vanilla-slice/math';
import { aabbContainsPoint } from './aabb';
import type { Aabb } from './aabb';

/**
 * Whether a point lies outside the simulation bounds. Used by the cleanup system
 * to remove bodies that have fallen or flown out of the active region.
 */
export function isOutOfBounds(position: ReadonlyVec3, bounds: Aabb): boolean {
  return !aabbContainsPoint(bounds, position);
}
