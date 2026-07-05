/** Default tolerance used for approximate floating-point comparisons. */
export const EPSILON = 1e-6;

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** Clamp `value` into the inclusive range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between `a` and `b` by factor `t`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function toRadians(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

export function toDegrees(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * Relative + absolute approximate equality for scalars. Two values are equal
 * when their difference is within `epsilon` scaled by their magnitude.
 */
export function approxEqual(a: number, b: number, epsilon: number = EPSILON): boolean {
  return Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(a), Math.abs(b));
}
