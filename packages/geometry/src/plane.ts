import { Vec3, EPSILON } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
type Vec3T = ReturnType<typeof Vec3.create>;

/**
 * An infinite plane defined by `dot(normal, x) + constant = 0`.
 *
 * The `normal` is expected to be unit length so that {@link signedDistanceToPoint}
 * returns a true signed distance. Points with a positive signed distance lie on
 * the side the normal points toward ("front").
 */
export interface Plane {
  normal: Vec3T;
  constant: number;
}

/** Which side of a plane a point lies on. */
export enum Side {
  Back = -1,
  On = 0,
  Front = 1,
}

/** Create a plane (defaults to the XZ plane with normal +Y). */
export function createPlane(): Plane {
  return { normal: [0, 1, 0], constant: 0 };
}

/** Build a plane from a (unit) normal and a point lying on the plane. */
export function fromNormalAndPoint(
  out: Plane,
  normal: ReadonlyVec3,
  point: ReadonlyVec3,
): Plane {
  Vec3.normalize(out.normal, normal);
  out.constant = -Vec3.dot(out.normal, point);
  return out;
}

/** Build a plane from three non-collinear, counter-clockwise points. */
export function fromCoplanarPoints(
  out: Plane,
  a: ReadonlyVec3,
  b: ReadonlyVec3,
  c: ReadonlyVec3,
): Plane {
  const ab: Vec3T = [0, 0, 0];
  const ac: Vec3T = [0, 0, 0];
  Vec3.subtract(ab, b, a);
  Vec3.subtract(ac, c, a);
  Vec3.cross(out.normal, ab, ac);
  Vec3.normalize(out.normal, out.normal);
  out.constant = -Vec3.dot(out.normal, a);
  return out;
}

/** Normalize the plane so its normal is unit length. */
export function normalizePlane(out: Plane, plane: Plane): Plane {
  const len = Vec3.length(plane.normal);
  if (len > 0) {
    const inv = 1 / len;
    out.normal[0] = plane.normal[0] * inv;
    out.normal[1] = plane.normal[1] * inv;
    out.normal[2] = plane.normal[2] * inv;
    out.constant = plane.constant * inv;
  }
  return out;
}

/** Signed distance from `point` to the plane. */
export function signedDistanceToPoint(plane: Plane, point: ReadonlyVec3): number {
  return Vec3.dot(plane.normal, point) + plane.constant;
}

/** Classify `point` relative to the plane using `epsilon` as the on-plane band. */
export function classifyPoint(
  plane: Plane,
  point: ReadonlyVec3,
  epsilon: number = EPSILON,
): Side {
  const d = signedDistanceToPoint(plane, point);
  if (d > epsilon) return Side.Front;
  if (d < -epsilon) return Side.Back;
  return Side.On;
}
