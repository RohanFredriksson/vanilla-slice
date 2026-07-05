import { Vec3, Quat } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import {
  createPlane,
  fromNormalAndPoint,
  signedDistanceToPoint,
} from '@vanilla-slice/geometry';
import type { Plane } from '@vanilla-slice/geometry';
import { querySphere, querySegment, queryAll } from '@vanilla-slice/spatial';
import type { SpatialHash, EntityId } from '@vanilla-slice/spatial';

type Vec3T = ReturnType<typeof Vec3.create>;
type QuatT = ReturnType<typeof Quat.create>;
type ReadonlyQuatLike = readonly [number, number, number, number] | QuatT;

/**
 * The bounded region a slice acts within (ADR 0004 / amendment). A slice is
 * never an infinite plane — the plane is confined to one of these shapes:
 *
 * - `sphere`: a ball of `radius` around `center` (the default).
 * - `cylinder`: a ball of `radius` swept along `axis`; `halfLength` bounds it
 *   (omit for an axis unbounded except by the world bounds). Ideal for cutting
 *   objects at any depth along a camera ray.
 * - `box`: an (optionally oriented) box of `halfExtents` around `center`.
 * - `unbounded`: the whole world (still finite — the world's bounds).
 */
export type SliceRegion =
  | { kind: 'sphere'; center: Vec3T; radius: number }
  | { kind: 'cylinder'; center: Vec3T; axis: Vec3T; radius: number; halfLength?: number }
  | { kind: 'box'; center: Vec3T; halfExtents: Vec3T; orientation?: QuatT }
  | { kind: 'unbounded' };

/**
 * A bounded slice interaction volume: a cutting `plane` limited to a `region`.
 * A slice is never an infinite plane (see ADR 0004) — only objects within the
 * bounded region are affected.
 */
export interface SliceVolume {
  plane: Plane;
  region: SliceRegion;
}

/** An entity candidate described by its world-space bounding sphere. */
export interface SliceCandidate {
  id: EntityId;
  center: ReadonlyVec3;
  radius: number;
}

/** A spherical slice region. */
export function sphereRegion(center: ReadonlyVec3, radius: number): SliceRegion {
  return { kind: 'sphere', center: Vec3.clone(center), radius };
}

/**
 * A cylindrical slice region: `radius` around the line through `center` along
 * (unit) `axis`. Omit `halfLength` to leave the axis unbounded (bounded only by
 * the world at broad-phase time).
 */
export function cylinderRegion(
  center: ReadonlyVec3,
  axis: ReadonlyVec3,
  radius: number,
  halfLength?: number,
): SliceRegion {
  const unit: Vec3T = [0, 0, 0];
  Vec3.normalize(unit, axis);
  return halfLength === undefined
    ? { kind: 'cylinder', center: Vec3.clone(center), axis: unit, radius }
    : { kind: 'cylinder', center: Vec3.clone(center), axis: unit, radius, halfLength };
}

/** An (optionally oriented) box slice region. */
export function boxRegion(
  center: ReadonlyVec3,
  halfExtents: ReadonlyVec3,
  orientation?: ReadonlyQuatLike,
): SliceRegion {
  return orientation
    ? {
        kind: 'box',
        center: Vec3.clone(center),
        halfExtents: Vec3.clone(halfExtents),
        orientation: [orientation[0], orientation[1], orientation[2], orientation[3]],
      }
    : { kind: 'box', center: Vec3.clone(center), halfExtents: Vec3.clone(halfExtents) };
}

/** The unbounded region (the whole, still-finite, world). */
export function unboundedRegion(): SliceRegion {
  return { kind: 'unbounded' };
}

/** Create a slice volume from an explicit plane, center, and (sphere) radius. */
export function createSliceVolume(
  plane: Plane,
  center: ReadonlyVec3,
  radius: number,
): SliceVolume {
  return { plane, region: sphereRegion(center, radius) };
}

/** Create a slice volume from a plane and an arbitrary region. */
export function sliceVolume(plane: Plane, region: SliceRegion): SliceVolume {
  return { plane, region };
}

/** Options for {@link sliceVolumeFromSwipe}. */
export interface SwipeVolumeOptions {
  /**
   * Extend the region into a cylinder along the view direction so objects at
   * any depth along the swipe are sliceable. Default `false` (sphere region).
   */
  extendAlongView?: boolean;
  /** Optional half-length bounding the cylinder along the view axis. */
  halfLength?: number;
}

/**
 * Build a slice volume from a world-space swipe (`start` -> `end`) and the
 * camera `viewDirection`. The cutting plane is spanned by the swipe and view
 * directions; its normal is perpendicular to both. The bounded region is
 * centered at the swipe midpoint — a sphere by default, or a view-aligned
 * cylinder when `options.extendAlongView` is set.
 */
export function sliceVolumeFromSwipe(
  start: ReadonlyVec3,
  end: ReadonlyVec3,
  viewDirection: ReadonlyVec3,
  radius?: number,
  options: SwipeVolumeOptions = {},
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
  const region = options.extendAlongView
    ? cylinderRegion(center, viewDirection, bounded, options.halfLength)
    : sphereRegion(center, bounded);
  return { plane, region };
}

const _rel: Vec3T = [0, 0, 0];
const _invRot: QuatT = [0, 0, 0, 1];

/**
 * Whether a bounding sphere (`center`, `radius`) lies within a slice region.
 * The region's shape determines how distance is measured; `unbounded` always
 * contains the sphere.
 */
export function regionContains(
  region: SliceRegion,
  center: ReadonlyVec3,
  radius: number,
): boolean {
  switch (region.kind) {
    case 'sphere':
      return Vec3.distance(region.center, center) <= region.radius + radius;
    case 'cylinder': {
      Vec3.subtract(_rel, center, region.center);
      const along = Vec3.dot(_rel, region.axis);
      if (
        region.halfLength !== undefined &&
        Math.abs(along) > region.halfLength + radius
      ) {
        return false;
      }
      const perpSq = Math.max(0, Vec3.squaredLength(_rel) - along * along);
      return Math.sqrt(perpSq) <= region.radius + radius;
    }
    case 'box': {
      Vec3.subtract(_rel, center, region.center);
      if (region.orientation) {
        Quat.conjugate(_invRot, region.orientation);
        Vec3.transformQuat(_rel, _rel, _invRot);
      }
      return (
        Math.abs(_rel[0]) <= region.halfExtents[0] + radius &&
        Math.abs(_rel[1]) <= region.halfExtents[1] + radius &&
        Math.abs(_rel[2]) <= region.halfExtents[2] + radius
      );
    }
    case 'unbounded':
      return true;
  }
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
  return regionContains(volume.region, center, radius);
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
 * region. The query shape matches the region so broad- and narrow-phase never
 * disagree: `sphere` → `querySphere`, `box` → circumscribed-sphere query, a
 * finite `cylinder` → `querySegment`.
 *
 * A cylinder with an unbounded axis (and the `unbounded` region) returns every
 * entity via `queryAll` and lets the narrow-phase prune by perpendicular
 * distance. There is no axial pruning to do, and this avoids sweeping a huge,
 * mostly-empty cell range for a long tube (which is O(length / cellSize)).
 */
export function querySliceCandidates(
  hash: SpatialHash,
  volume: SliceVolume,
): EntityId[] {
  const region = volume.region;
  switch (region.kind) {
    case 'sphere':
      return querySphere(hash, region.center, region.radius);
    case 'cylinder': {
      if (region.halfLength === undefined) {
        return queryAll(hash);
      }
      const half = region.halfLength;
      const a: Vec3T = [
        region.center[0] - region.axis[0] * half,
        region.center[1] - region.axis[1] * half,
        region.center[2] - region.axis[2] * half,
      ];
      const b: Vec3T = [
        region.center[0] + region.axis[0] * half,
        region.center[1] + region.axis[1] * half,
        region.center[2] + region.axis[2] * half,
      ];
      return querySegment(hash, a, b, region.radius);
    }
    case 'box': {
      // Circumscribed-sphere broad-phase (orientation-independent, conservative).
      const bounding = Math.hypot(
        region.halfExtents[0],
        region.halfExtents[1],
        region.halfExtents[2],
      );
      return querySphere(hash, region.center, bounding);
    }
    case 'unbounded':
      return queryAll(hash);
  }
}

