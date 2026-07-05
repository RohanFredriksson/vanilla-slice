import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import {
  applyImpulseAtPoint,
  worldInvInertiaMultiply,
  isStatic,
} from './body';
import type { RigidBody } from './body';
import type { ContactManifold } from './convex';

type Vec3T = ReturnType<typeof Vec3.create>;

// --- local vector helpers ----------------------------------------------------

function sub(a: ReadonlyVec3, b: ReadonlyVec3): Vec3T {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: ReadonlyVec3, b: ReadonlyVec3): Vec3T {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function scale(a: ReadonlyVec3, s: number): Vec3T {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function neg(a: ReadonlyVec3): Vec3T {
  return [-a[0], -a[1], -a[2]];
}

/** Options controlling {@link resolveContact}. */
export interface ContactSolverOptions {
  /** Bounciness in `[0, 1]` (0 = inelastic). Default 0. */
  restitution?: number;
  /** Coulomb friction coefficient (>= 0). Default 0.5. */
  friction?: number;
  /** Sequential-impulse velocity iterations. Default 4. */
  velocityIterations?: number;
  /** Baumgarte positional-correction fraction in `[0, 1]`. Default 0.2. */
  positionCorrection?: number;
  /** Penetration allowed before positional correction kicks in. Default 0.01. */
  penetrationSlop?: number;
}

interface ContactRow {
  rA: Vec3T;
  rB: Vec3T;
  penetration: number;
}

/** Velocity of body `body` at the world point offset `r` from its center. */
function pointVelocity(body: RigidBody, r: ReadonlyVec3): Vec3T {
  const av = cross(body.angularVelocity, r);
  return [
    body.velocity[0] + av[0],
    body.velocity[1] + av[1],
    body.velocity[2] + av[2],
  ];
}

/** Effective inverse mass along unit axis `axis` at contact offset `r`. */
function axisInvMass(body: RigidBody, r: ReadonlyVec3, axis: ReadonlyVec3): number {
  const rxa = cross(r, axis);
  const i = worldInvInertiaMultiply(body, rxa);
  return body.invMass + dot(rxa, i);
}

/**
 * Resolve a contact manifold between two rigid bodies with a sequential-impulse
 * solver: a non-penetration normal impulse plus a clamped Coulomb friction
 * impulse per contact point (both weighted by `invMass`/`invInertia`, so static
 * bodies absorb nothing), then a linear positional correction to remove residual
 * penetration.
 *
 * The manifold `normal` must point from `a` toward `b` (as produced by
 * {@link convexConvexManifold}). No-op when both bodies are static.
 */
export function resolveContact(
  a: RigidBody,
  b: RigidBody,
  manifold: ContactManifold,
  options: ContactSolverOptions = {},
): void {
  const invMassSum = a.invMass + b.invMass;
  if (invMassSum === 0 || manifold.points.length === 0) {
    return; // Both static, or nothing to resolve.
  }

  const restitution = options.restitution ?? 0;
  const friction = options.friction ?? 0.5;
  const iterations = options.velocityIterations ?? 4;
  const correction = options.positionCorrection ?? 0.2;
  const slop = options.penetrationSlop ?? 0.01;
  const n = manifold.normal;

  const rows: ContactRow[] = manifold.points.map((p) => ({
    rA: sub(p.point, a.position),
    rB: sub(p.point, b.position),
    penetration: p.penetration,
  }));

  for (let iter = 0; iter < iterations; iter++) {
    for (const row of rows) {
      // --- normal impulse ---
      const vRel = sub(pointVelocity(b, row.rB), pointVelocity(a, row.rA));
      const vn = dot(vRel, n);
      const kn = axisInvMass(a, row.rA, n) + axisInvMass(b, row.rB, n);
      let jn = kn > 0 ? (-(1 + restitution) * vn) / kn : 0;
      if (jn < 0) {
        jn = 0; // Contacts only push apart, never pull together.
      }
      if (jn > 0) {
        const p = scale(n, jn);
        applyImpulseAtPoint(a, neg(p), row.rA);
        applyImpulseAtPoint(b, p, row.rB);
      }

      // --- friction impulse (clamped to the Coulomb cone) ---
      const vRel2 = sub(pointVelocity(b, row.rB), pointVelocity(a, row.rA));
      const vt = sub(vRel2, scale(n, dot(vRel2, n)));
      const vtLen = Math.hypot(vt[0], vt[1], vt[2]);
      if (vtLen > 1e-8 && jn > 0) {
        const t = scale(vt, 1 / vtLen);
        const kt = axisInvMass(a, row.rA, t) + axisInvMass(b, row.rB, t);
        let jt = kt > 0 ? -dot(vRel2, t) / kt : 0;
        const maxFriction = friction * jn;
        if (jt > maxFriction) jt = maxFriction;
        else if (jt < -maxFriction) jt = -maxFriction;
        const p = scale(t, jt);
        applyImpulseAtPoint(a, neg(p), row.rA);
        applyImpulseAtPoint(b, p, row.rB);
      }
    }
  }

  // --- positional correction (linear Baumgarte, deepest point) ---
  let maxPenetration = 0;
  for (const row of rows) {
    if (row.penetration > maxPenetration) {
      maxPenetration = row.penetration;
    }
  }
  const depth = Math.max(maxPenetration - slop, 0);
  if (depth > 0) {
    const push = (depth * correction) / invMassSum;
    if (!isStatic(a)) {
      Vec3.scaleAndAdd(a.position, a.position, n, -push * a.invMass);
    }
    if (!isStatic(b)) {
      Vec3.scaleAndAdd(b.position, b.position, n, push * b.invMass);
    }
  }
}
