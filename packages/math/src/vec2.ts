import { approxEqual } from './common';
import type { ReadonlyVec2, Vec2 } from './types';

/** Create a new zero vector. */
export function create(): Vec2 {
  return [0, 0];
}

/** Create a vector from explicit components. */
export function fromValues(x: number, y: number): Vec2 {
  return [x, y];
}

/** Return a copy of `a`. */
export function clone(a: ReadonlyVec2): Vec2 {
  return [a[0], a[1]];
}

/** Copy `a` into `out`. */
export function copy(out: Vec2, a: ReadonlyVec2): Vec2 {
  out[0] = a[0];
  out[1] = a[1];
  return out;
}

/** Set the components of `out`. */
export function set(out: Vec2, x: number, y: number): Vec2 {
  out[0] = x;
  out[1] = y;
  return out;
}

/** `out = a + b` */
export function add(out: Vec2, a: ReadonlyVec2, b: ReadonlyVec2): Vec2 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
}

/** `out = a - b` */
export function subtract(out: Vec2, a: ReadonlyVec2, b: ReadonlyVec2): Vec2 {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  return out;
}

/** `out = a * scalar` */
export function scale(out: Vec2, a: ReadonlyVec2, scalar: number): Vec2 {
  out[0] = a[0] * scalar;
  out[1] = a[1] * scalar;
  return out;
}

/** `out = a + b * scalar` */
export function scaleAndAdd(
  out: Vec2,
  a: ReadonlyVec2,
  b: ReadonlyVec2,
  scalar: number,
): Vec2 {
  out[0] = a[0] + b[0] * scalar;
  out[1] = a[1] + b[1] * scalar;
  return out;
}

/** Dot product. */
export function dot(a: ReadonlyVec2, b: ReadonlyVec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

/** 2D cross product (z-component of the 3D cross). */
export function cross(a: ReadonlyVec2, b: ReadonlyVec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

/** Euclidean length. */
export function length(a: ReadonlyVec2): number {
  return Math.hypot(a[0], a[1]);
}

/** Squared length (avoids the square root). */
export function squaredLength(a: ReadonlyVec2): number {
  return a[0] * a[0] + a[1] * a[1];
}

/** Distance between `a` and `b`. */
export function distance(a: ReadonlyVec2, b: ReadonlyVec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Squared distance between `a` and `b`. */
export function squaredDistance(a: ReadonlyVec2, b: ReadonlyVec2): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Normalize `a` into `out`. A zero-length vector stays zero. */
export function normalize(out: Vec2, a: ReadonlyVec2): Vec2 {
  const len = a[0] * a[0] + a[1] * a[1];
  if (len > 0) {
    const inv = 1 / Math.sqrt(len);
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
  } else {
    out[0] = 0;
    out[1] = 0;
  }
  return out;
}

/** Linear interpolation `out = a + (b - a) * t`. */
export function lerp(out: Vec2, a: ReadonlyVec2, b: ReadonlyVec2, t: number): Vec2 {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  return out;
}

/** Approximate equality using {@link approxEqual} per component. */
export function equals(a: ReadonlyVec2, b: ReadonlyVec2): boolean {
  return approxEqual(a[0], b[0]) && approxEqual(a[1], b[1]);
}

/** Bitwise-exact equality. */
export function exactEquals(a: ReadonlyVec2, b: ReadonlyVec2): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
