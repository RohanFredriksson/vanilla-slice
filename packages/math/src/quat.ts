import { approxEqual } from './common';
import type { Quat, ReadonlyQuat, ReadonlyVec3 } from './types';

/** Create a new identity quaternion `[0, 0, 0, 1]`. */
export function create(): Quat {
  return [0, 0, 0, 1];
}

/** Set `out` to the identity quaternion. */
export function identity(out: Quat): Quat {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
}

/** Return a copy of `a`. */
export function clone(a: ReadonlyQuat): Quat {
  return [a[0], a[1], a[2], a[3]];
}

/** Copy `a` into `out`. */
export function copy(out: Quat, a: ReadonlyQuat): Quat {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}

/**
 * Set `out` to the rotation of `rad` radians about `axis`. `axis` is assumed to
 * be normalized.
 */
export function setAxisAngle(out: Quat, axis: ReadonlyVec3, rad: number): Quat {
  const half = rad * 0.5;
  const s = Math.sin(half);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(half);
  return out;
}

/** `out = a * b` (Hamilton product; applies rotation `b` then `a`). */
export function multiply(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat): Quat {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

/** Dot product. */
export function dot(a: ReadonlyQuat, b: ReadonlyQuat): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/** Euclidean length. */
export function length(a: ReadonlyQuat): number {
  return Math.hypot(a[0], a[1], a[2], a[3]);
}

/** Normalize `a` into `out`. A zero-length quaternion stays zero. */
export function normalize(out: Quat, a: ReadonlyQuat): Quat {
  const len = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3];
  if (len > 0) {
    const inv = 1 / Math.sqrt(len);
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
    out[2] = a[2] * inv;
    out[3] = a[3] * inv;
  } else {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }
  return out;
}

/** Conjugate of `a` (inverse for unit quaternions). */
export function conjugate(out: Quat, a: ReadonlyQuat): Quat {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}

/** Spherical linear interpolation between unit quaternions `a` and `b`. */
export function slerp(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat, t: number): Quat {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];

  let cosom = ax * bx + ay * by + az * bz + aw * bw;
  // Take the shorter arc.
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  let scale0: number;
  let scale1: number;
  if (1 - cosom > 1e-6) {
    const omega = Math.acos(cosom);
    const sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    // Nearly identical: fall back to linear interpolation.
    scale0 = 1 - t;
    scale1 = t;
  }

  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}

/** Approximate equality using {@link approxEqual} per component. */
export function equals(a: ReadonlyQuat, b: ReadonlyQuat): boolean {
  return (
    approxEqual(a[0], b[0]) &&
    approxEqual(a[1], b[1]) &&
    approxEqual(a[2], b[2]) &&
    approxEqual(a[3], b[3])
  );
}
