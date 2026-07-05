import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import { isStatic } from './body';
import type { RigidBody } from './body';

type Vec3T = ReturnType<typeof Vec3.create>;

/** A narrow-phase contact between two shapes. */
export interface Contact {
  /** Unit contact normal pointing from `a` toward `b`. */
  normal: Vec3T;
  /** Penetration depth (positive when overlapping). */
  depth: number;
}

/**
 * Detect contact between two spheres. Returns `null` when they do not overlap.
 * The contact normal points from `a` toward `b`.
 */
export function sphereSphereContact(
  centerA: ReadonlyVec3,
  radiusA: number,
  centerB: ReadonlyVec3,
  radiusB: number,
): Contact | null {
  const dx = centerB[0] - centerA[0];
  const dy = centerB[1] - centerA[1];
  const dz = centerB[2] - centerA[2];
  const distSq = dx * dx + dy * dy + dz * dz;
  const radiusSum = radiusA + radiusB;
  if (distSq >= radiusSum * radiusSum) {
    return null;
  }

  const dist = Math.sqrt(distSq);
  const normal: Vec3T =
    dist > 0 ? [dx / dist, dy / dist, dz / dist] : [0, 1, 0];
  return { normal, depth: radiusSum - dist };
}

/**
 * Resolve a dynamic body against a static half-space `dot(normal, p) >= offset`.
 * Pushes the body out of penetration and reflects the inbound normal velocity
 * with the given `restitution` (0 = no bounce, 1 = perfectly elastic).
 *
 * The body's `radius` is treated as an offset from its center to the surface.
 * Returns `true` when a collision was resolved.
 */
export function resolveHalfSpace(
  body: RigidBody,
  normal: ReadonlyVec3,
  offset: number,
  restitution = 0,
): boolean {
  if (isStatic(body)) {
    return false;
  }

  const distance =
    Vec3.dot(normal, body.position) - offset - body.radius;
  if (distance >= 0) {
    return false;
  }

  // Push the body out along the normal so it rests on the surface.
  Vec3.scaleAndAdd(body.position, body.position, normal, -distance);

  // Reflect the velocity component moving into the surface.
  const normalVelocity = Vec3.dot(body.velocity, normal);
  if (normalVelocity < 0) {
    Vec3.scaleAndAdd(
      body.velocity,
      body.velocity,
      normal,
      -(1 + restitution) * normalVelocity,
    );
  }
  return true;
}
