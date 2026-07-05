import { approxEqual } from './common';
import type { ReadonlyVec3, ReadonlyMat4, ReadonlyQuat, Vec3 } from './types';

/** Create a new zero vector. */
export function create(): Vec3 {
  return [0, 0, 0];
}

/** Create a vector from explicit components. */
export function fromValues(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

/** Return a copy of `a`. */
export function clone(a: ReadonlyVec3): Vec3 {
  return [a[0], a[1], a[2]];
}

/** Copy `a` into `out`. */
export function copy(out: Vec3, a: ReadonlyVec3): Vec3 {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

/** Set the components of `out`. */
export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** `out = a + b` */
export function add(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

/** `out = a - b` */
export function subtract(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

/** Component-wise `out = a * b`. */
export function multiply(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
}

/** `out = a * scalar` */
export function scale(out: Vec3, a: ReadonlyVec3, scalar: number): Vec3 {
  out[0] = a[0] * scalar;
  out[1] = a[1] * scalar;
  out[2] = a[2] * scalar;
  return out;
}

/** `out = a + b * scalar` (useful for physics integration). */
export function scaleAndAdd(
  out: Vec3,
  a: ReadonlyVec3,
  b: ReadonlyVec3,
  scalar: number,
): Vec3 {
  out[0] = a[0] + b[0] * scalar;
  out[1] = a[1] + b[1] * scalar;
  out[2] = a[2] + b[2] * scalar;
  return out;
}

/** `out = -a` */
export function negate(out: Vec3, a: ReadonlyVec3): Vec3 {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  return out;
}

/** Dot product. */
export function dot(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** `out = a × b` (cross product). Safe when `out` aliases `a` or `b`. */
export function cross(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

/** Euclidean length. */
export function length(a: ReadonlyVec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** Squared length (avoids the square root). */
export function squaredLength(a: ReadonlyVec3): number {
  return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
}

/** Distance between `a` and `b`. */
export function distance(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Squared distance between `a` and `b`. */
export function squaredDistance(a: ReadonlyVec3, b: ReadonlyVec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Normalize `a` into `out`. A zero-length vector is left as the zero vector.
 */
export function normalize(out: Vec3, a: ReadonlyVec3): Vec3 {
  const len = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  if (len > 0) {
    const inv = 1 / Math.sqrt(len);
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
    out[2] = a[2] * inv;
  } else {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
}

/** Linear interpolation `out = a + (b - a) * t`. */
export function lerp(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3, t: number): Vec3 {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/** Component-wise minimum. */
export function min(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  out[0] = Math.min(a[0], b[0]);
  out[1] = Math.min(a[1], b[1]);
  out[2] = Math.min(a[2], b[2]);
  return out;
}

/** Component-wise maximum. */
export function max(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  out[0] = Math.max(a[0], b[0]);
  out[1] = Math.max(a[1], b[1]);
  out[2] = Math.max(a[2], b[2]);
  return out;
}

/**
 * Transform `a` by column-major 4x4 matrix `m`, dividing by the resulting w
 * component (treats `a` as a point).
 */
export function transformMat4(out: Vec3, a: ReadonlyVec3, m: ReadonlyMat4): Vec3 {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}

/** Rotate `a` by quaternion `q`. */
export function transformQuat(out: Vec3, a: ReadonlyVec3, q: ReadonlyQuat): Vec3 {
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  const x = a[0];
  const y = a[1];
  const z = a[2];
  // uv = q.xyz × a
  let uvx = qy * z - qz * y;
  let uvy = qz * x - qx * z;
  let uvz = qx * y - qy * x;
  // uuv = q.xyz × uv
  let uuvx = qy * uvz - qz * uvy;
  let uuvy = qz * uvx - qx * uvz;
  let uuvz = qx * uvy - qy * uvx;
  const w2 = qw * 2;
  uvx *= w2;
  uvy *= w2;
  uvz *= w2;
  uuvx *= 2;
  uuvy *= 2;
  uuvz *= 2;
  out[0] = x + uvx + uuvx;
  out[1] = y + uvy + uuvy;
  out[2] = z + uvz + uuvz;
  return out;
}

/** Approximate equality using {@link approxEqual} per component. */
export function equals(a: ReadonlyVec3, b: ReadonlyVec3): boolean {
  return (
    approxEqual(a[0], b[0]) && approxEqual(a[1], b[1]) && approxEqual(a[2], b[2])
  );
}

/** Bitwise-exact equality. */
export function exactEquals(a: ReadonlyVec3, b: ReadonlyVec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
