import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import { isStatic, applyAngularImpulse } from './body';
import type { RigidBody } from './body';
import type { ConvexShape } from './convex';

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

/** Vertices within this distance of the surface count as ground contacts. */
const CONTACT_EPSILON = 0.05;
/**
 * Timestep estimate used to scale the tipping angular impulse. The tip strength
 * is a tunable (`tipFactor`), so an exact `dt` is not needed here.
 */
const TIP_DT_ESTIMATE = 1 / 60;

/**
 * Resolve a dynamic body against a static half-space `dot(normal, p) >= offset`.
 * Pushes the body out of penetration and reflects the inbound normal velocity
 * with the given `restitution` (0 = no bounce, 1 = perfectly elastic).
 *
 * The body's `radius` is treated as an offset from its center to the surface.
 *
 * When a `collider` is supplied, the body's actual convex hull is used to detect
 * the ground-contact footprint (support polygon). If the centre of mass projects
 * outside that footprint, a destabilising angular impulse (scaled by
 * `tipFactor`) is applied so tall/unbalanced pieces topple over the nearest
 * support edge instead of standing forever. Set `tipFactor` to `0` to disable.
 * Falls back to the sphere-based correction when the collider is absent or the
 * contact set has fewer than three vertices.
 *
 * Returns `true` when a collision was resolved.
 */
export function resolveHalfSpace(
  body: RigidBody,
  normal: ReadonlyVec3,
  offset: number,
  restitution = 0,
  collider?: ConvexShape,
  tipFactor = 12,
): boolean {
  if (isStatic(body)) {
    return false;
  }

  const distance = Vec3.dot(normal, body.position) - offset - body.radius;
  let resolved = false;
  if (distance < 0) {
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
    resolved = true;
  }

  if (collider && tipFactor !== 0 && applyTippingTorque(body, normal, offset, collider, tipFactor)) {
    resolved = true;
  }

  return resolved;
}

const _tipVertex: Vec3T = [0, 0, 0];
const _tipAxis: Vec3T = [0, 0, 0];
const _tipOut: Vec3T = [0, 0, 0];

/**
 * Apply a destabilising angular impulse when the body's centre of mass projects
 * outside its ground-contact support polygon. Returns `true` when an impulse was
 * applied, `false` when the body is stable or the contact set is too small to
 * form a support polygon (caller then relies on the sphere correction).
 */
function applyTippingTorque(
  body: RigidBody,
  normal: ReadonlyVec3,
  offset: number,
  collider: ConvexShape,
  tipFactor: number,
): boolean {
  // Build the contact set: collider vertices at/under the surface, projected to
  // the ground plane's 2D basis (u, v) with the COM as the origin.
  const basis = groundBasis(normal);
  const comU = Vec3.dot(body.position, basis.u);
  const comV = Vec3.dot(body.position, basis.v);

  const contactU: number[] = [];
  const contactV: number[] = [];
  const { vertices } = collider;
  for (let i = 0; i < vertices.length; i += 3) {
    _tipVertex[0] = vertices[i]!;
    _tipVertex[1] = vertices[i + 1]!;
    _tipVertex[2] = vertices[i + 2]!;
    Vec3.transformQuat(_tipVertex, _tipVertex, body.orientation);
    _tipVertex[0] += body.position[0];
    _tipVertex[1] += body.position[1];
    _tipVertex[2] += body.position[2];
    if (Vec3.dot(normal, _tipVertex) - offset <= CONTACT_EPSILON) {
      contactU.push(Vec3.dot(_tipVertex, basis.u));
      contactV.push(Vec3.dot(_tipVertex, basis.v));
    }
  }

  if (contactU.length < 3) {
    return false;
  }

  const hull = convexHull2D(contactU, contactV);
  if (hull.length < 3) {
    return false;
  }

  if (pointInConvexPolygon(hull, comU, comV)) {
    return false;
  }

  // COM overhangs: find the nearest boundary point and the outward direction.
  const near = nearestBoundaryPoint(hull, comU, comV);
  if (near.dist <= 1e-6) {
    return false;
  }
  const outU = (comU - near.u) / near.dist;
  const outV = (comV - near.v) / near.dist;

  // World-space overhang direction, then tip axis = normal × overhang.
  _tipOut[0] = outU * basis.u[0] + outV * basis.v[0];
  _tipOut[1] = outU * basis.u[1] + outV * basis.v[1];
  _tipOut[2] = outU * basis.u[2] + outV * basis.v[2];
  Vec3.cross(_tipAxis, normal, _tipOut);
  Vec3.normalize(_tipAxis, _tipAxis);

  const magnitude = near.dist * tipFactor * TIP_DT_ESTIMATE;
  _tipAxis[0] *= magnitude;
  _tipAxis[1] *= magnitude;
  _tipAxis[2] *= magnitude;
  applyAngularImpulse(body, _tipAxis);
  return true;
}

/** An orthonormal 2D basis (u, v) spanning the plane with the given normal. */
function groundBasis(normal: ReadonlyVec3): { u: Vec3T; v: Vec3T } {
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  const helper: Vec3T = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
  const u: Vec3T = [0, 0, 0];
  Vec3.cross(u, normal, helper);
  Vec3.normalize(u, u);
  const v: Vec3T = [0, 0, 0];
  Vec3.cross(v, normal, u);
  Vec3.normalize(v, v);
  return { u, v };
}

/**
 * 2D convex hull (counter-clockwise) of the points `(us[i], vs[i])` via Andrew's
 * monotone chain. Returns the hull as flat `[u0, v0, u1, v1, ...]`.
 */
function convexHull2D(us: number[], vs: number[]): number[] {
  const n = us.length;
  const order = us.map((_, i) => i).sort((a, b) => us[a]! - us[b]! || vs[a]! - vs[b]!);
  const cross = (oi: number, ai: number, bi: number): number =>
    (us[ai]! - us[oi]!) * (vs[bi]! - vs[oi]!) - (vs[ai]! - vs[oi]!) * (us[bi]! - us[oi]!);

  const lower: number[] = [];
  for (const idx of order) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, idx) <= 0) {
      lower.pop();
    }
    lower.push(idx);
  }
  const upper: number[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const idx = order[k]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, idx) <= 0) {
      upper.pop();
    }
    upper.push(idx);
  }
  lower.pop();
  upper.pop();
  const hull: number[] = [];
  for (const idx of lower) {
    hull.push(us[idx]!, vs[idx]!);
  }
  for (const idx of upper) {
    hull.push(us[idx]!, vs[idx]!);
  }
  return hull;
}

/** Whether `(pu, pv)` lies inside (or on) the CCW convex polygon `hull`. */
function pointInConvexPolygon(hull: number[], pu: number, pv: number): boolean {
  const count = hull.length / 2;
  for (let i = 0; i < count; i++) {
    const au = hull[i * 2]!;
    const av = hull[i * 2 + 1]!;
    const bu = hull[((i + 1) % count) * 2]!;
    const bv = hull[((i + 1) % count) * 2 + 1]!;
    const cross = (bu - au) * (pv - av) - (bv - av) * (pu - au);
    if (cross < -1e-9) {
      return false;
    }
  }
  return true;
}

/** Nearest point on a convex polygon's boundary to `(pu, pv)`. */
function nearestBoundaryPoint(
  hull: number[],
  pu: number,
  pv: number,
): { u: number; v: number; dist: number } {
  const count = hull.length / 2;
  let bestU = hull[0]!;
  let bestV = hull[1]!;
  let bestDistSq = Infinity;
  for (let i = 0; i < count; i++) {
    const au = hull[i * 2]!;
    const av = hull[i * 2 + 1]!;
    const bu = hull[((i + 1) % count) * 2]!;
    const bv = hull[((i + 1) % count) * 2 + 1]!;
    const eu = bu - au;
    const ev = bv - av;
    const lenSq = eu * eu + ev * ev;
    let t = lenSq > 0 ? ((pu - au) * eu + (pv - av) * ev) / lenSq : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cu = au + eu * t;
    const cv = av + ev * t;
    const du = pu - cu;
    const dv = pv - cv;
    const distSq = du * du + dv * dv;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestU = cu;
      bestV = cv;
    }
  }
  return { u: bestU, v: bestV, dist: Math.sqrt(bestDistSq) };
}
