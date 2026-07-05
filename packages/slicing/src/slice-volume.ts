import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import {
  createPlane,
  fromNormalAndPoint,
  signedDistanceToPoint,
} from '@vanilla-slice/geometry';
import type { Plane } from '@vanilla-slice/geometry';
import { querySphere } from '@vanilla-slice/spatial';
import type { SpatialHash, EntityId } from '@vanilla-slice/spatial';

type Vec3T = ReturnType<typeof Vec3.create>;

/**
 * A bounded slice interaction volume: a cutting `plane` limited to a spherical
 * region of `radius` around `center`. A slice is never an infinite plane
 * (see ADR 0004) — only objects within the bounded region are affected.
 */
export interface SliceVolume {
  plane: Plane;
  center: Vec3T;
  radius: number;
}

/** An entity candidate described by its world-space bounding sphere. */
export interface SliceCandidate {
  id: EntityId;
  center: ReadonlyVec3;
  radius: number;
}

/** Create a slice volume from an explicit plane, center, and radius. */
export function createSliceVolume(
  plane: Plane,
  center: ReadonlyVec3,
  radius: number,
): SliceVolume {
  return { plane, center: Vec3.clone(center), radius };
}

/**
 * Build a slice volume from a world-space swipe (`start` -> `end`) and the
 * camera `viewDirection`. The cutting plane is spanned by the swipe and view
 * directions; its normal is perpendicular to both. The bounded region is
 * centered at the swipe midpoint.
 */
export function sliceVolumeFromSwipe(
  start: ReadonlyVec3,
  end: ReadonlyVec3,
  viewDirection: ReadonlyVec3,
  radius?: number,
): SliceVolume {
  const swipe: Vec3T = [0, 0, 0];
  Vec3.subtract(swipe, end, start);

  const normal: Vec3T = [0, 0, 0];
  Vec3.cross(normal, swipe, viewDirection);
  Vec3.normalize(normal, normal);

  const plane = fromNormalAndPoint(createPlane(), normal, start);

  const center: Vec3T = [0, 0, 0];
  Vec3.lerp(center, start, end, 0.5);

  const bounded = radius ?? Vec3.distance(start, end) * 0.5;
  return { plane, center, radius: bounded };
}

/**
 * Whether a bounding sphere intersects the slice volume: it must cross the
 * cutting plane and lie within the bounded region.
 */
export function sliceIntersectsSphere(
  volume: SliceVolume,
  center: ReadonlyVec3,
  radius: number,
): boolean {
  // Must straddle (or touch) the cutting plane.
  if (Math.abs(signedDistanceToPoint(volume.plane, center)) > radius) {
    return false;
  }
  // Must be within the bounded region.
  return Vec3.distance(volume.center, center) <= volume.radius + radius;
}

/** Filter candidates to those whose bounding sphere intersects the volume. */
export function filterSliceCandidates(
  volume: SliceVolume,
  candidates: Iterable<SliceCandidate>,
): EntityId[] {
  const result: EntityId[] = [];
  for (const candidate of candidates) {
    if (sliceIntersectsSphere(volume, candidate.center, candidate.radius)) {
      result.push(candidate.id);
    }
  }
  return result;
}

/**
 * Broad-phase query of a spatial hash for entities in the slice's bounded
 * region. Returns candidate ids for subsequent narrow-phase filtering.
 */
export function querySliceCandidates(
  hash: SpatialHash,
  volume: SliceVolume,
): EntityId[] {
  return querySphere(hash, volume.center, volume.radius);
}
