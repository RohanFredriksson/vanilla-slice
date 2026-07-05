import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyMat4 } from '@vanilla-slice/math';

type Vec3T = ReturnType<typeof Vec3.create>;

/** A world-space ray with an origin and a (unit) direction. */
export interface Ray {
  origin: Vec3T;
  direction: Vec3T;
}

/** Create a ray (defaults to the origin pointing down -Z). */
export function createRay(): Ray {
  return { origin: [0, 0, 0], direction: [0, 0, -1] };
}

/** Point along the ray at parameter `t`: `origin + direction * t`. */
export function rayAt(ray: Ray, t: number, out: Vec3T): Vec3T {
  return Vec3.scaleAndAdd(out, ray.origin, ray.direction, t);
}

/**
 * Convert pixel coordinates to normalized device coordinates in `[-1, 1]`. The
 * Y axis is flipped so that screen-down maps to NDC-down.
 */
export function screenToNdc(
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number] {
  return [(x / width) * 2 - 1, -((y / height) * 2 - 1)];
}

/**
 * Build a world-space ray from a point in normalized device coordinates and the
 * inverse view-projection matrix. Unprojects the near and far clip points and
 * returns the ray between them. Pure math — no camera or DOM dependency.
 */
export function rayFromNdc(
  out: Ray,
  ndcX: number,
  ndcY: number,
  invViewProjection: ReadonlyMat4,
): Ray {
  const near: Vec3T = [ndcX, ndcY, -1];
  const far: Vec3T = [ndcX, ndcY, 1];
  Vec3.transformMat4(out.origin, near, invViewProjection);
  Vec3.transformMat4(far, far, invViewProjection);
  Vec3.subtract(out.direction, far, out.origin);
  Vec3.normalize(out.direction, out.direction);
  return out;
}

/** Convenience: build a ray directly from pixel coordinates. */
export function rayFromScreen(
  out: Ray,
  x: number,
  y: number,
  width: number,
  height: number,
  invViewProjection: ReadonlyMat4,
): Ray {
  const [ndcX, ndcY] = screenToNdc(x, y, width, height);
  return rayFromNdc(out, ndcX, ndcY, invViewProjection);
}
