import { Vec3, Quat } from '@vanilla-slice/math';
import type { ReadonlyVec3, ReadonlyQuat } from '@vanilla-slice/math';

type Vec3T = ReturnType<typeof Vec3.create>;
type QuatT = ReturnType<typeof Quat.create>;

/**
 * A rigid body with linear and angular state. Physics owns `position` and
 * `velocity` (and their angular counterparts); no rendering or framework state
 * lives here.
 *
 * A body with `invMass === 0` is static (immovable, unaffected by forces and
 * gravity).
 */
export interface RigidBody {
  position: Vec3T;
  velocity: Vec3T;
  orientation: QuatT;
  angularVelocity: Vec3T;
  /** Inverse mass; `0` means infinite mass (static). */
  invMass: number;
  /** Per-second linear velocity damping in `[0, 1]`. */
  linearDamping: number;
  /** Per-second angular velocity damping in `[0, 1]`. */
  angularDamping: number;
  /** Bounding-sphere radius, used for broad-phase and simple collision. */
  radius: number;
  /**
   * Inverse rotational inertia about the body's local principal axes. Angular
   * impulses are scaled by this (rotated into world space). A zero component
   * means that local axis cannot be spun by an impulse; `[0, 0, 0]` is
   * rotationally static (e.g. infinite-mass bodies).
   */
  invInertia: Vec3T;
  /** Accumulated force, applied then cleared on the next integration step. */
  force: Vec3T;
}

/** Options for {@link createBody}. All fields are optional. */
export interface BodyOptions {
  position?: ReadonlyVec3;
  velocity?: ReadonlyVec3;
  orientation?: ReadonlyQuat;
  angularVelocity?: ReadonlyVec3;
  /** Mass in kg. `<= 0` or non-finite makes the body static. Defaults to 1. */
  mass?: number;
  linearDamping?: number;
  angularDamping?: number;
  radius?: number;
  /**
   * Inverse principal moments of inertia (body-local). When omitted, a solid
   * sphere of the body's `radius` and `mass` is assumed. Static bodies ignore
   * this and use `[0, 0, 0]`.
   */
  invInertia?: ReadonlyVec3;
}

/** Convert a mass to an inverse mass (`0` for static bodies). */
export function massToInvMass(mass: number): number {
  return mass > 0 && Number.isFinite(mass) ? 1 / mass : 0;
}

/**
 * Inverse principal inertia of a solid sphere: `I = (2/5)·m·r²` per axis.
 * Returns `[0, 0, 0]` for static bodies or a non-positive radius.
 */
export function solidSphereInvInertia(mass: number, radius: number): Vec3T {
  const invMass = massToInvMass(mass);
  if (invMass === 0 || radius <= 0) {
    return [0, 0, 0];
  }
  const inv = (2.5 * invMass) / (radius * radius);
  return [inv, inv, inv];
}

/**
 * Inverse principal inertia of a solid box with the given full side lengths:
 * `I_axis = (1/12)·m·(b² + c²)`. Returns `[0, 0, 0]` for static bodies.
 */
export function boxInvInertia(
  mass: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): Vec3T {
  const invMass = massToInvMass(mass);
  if (invMass === 0) {
    return [0, 0, 0];
  }
  const x2 = sizeX * sizeX;
  const y2 = sizeY * sizeY;
  const z2 = sizeZ * sizeZ;
  return [
    y2 + z2 > 0 ? (12 * invMass) / (y2 + z2) : 0,
    x2 + z2 > 0 ? (12 * invMass) / (x2 + z2) : 0,
    x2 + y2 > 0 ? (12 * invMass) / (x2 + y2) : 0,
  ];
}

/** Create a rigid body from options, filling sensible defaults. */
export function createBody(options: BodyOptions = {}): RigidBody {
  const mass = options.mass ?? 1;
  const radius = options.radius ?? 0.5;
  return {
    position: options.position ? Vec3.clone(options.position) : Vec3.create(),
    velocity: options.velocity ? Vec3.clone(options.velocity) : Vec3.create(),
    orientation: options.orientation
      ? Quat.clone(options.orientation)
      : Quat.create(),
    angularVelocity: options.angularVelocity
      ? Vec3.clone(options.angularVelocity)
      : Vec3.create(),
    invMass: massToInvMass(mass),
    linearDamping: options.linearDamping ?? 0,
    angularDamping: options.angularDamping ?? 0,
    radius,
    invInertia: options.invInertia
      ? Vec3.clone(options.invInertia)
      : solidSphereInvInertia(mass, radius),
    force: Vec3.create(),
  };
}

/** Whether the body is static (infinite mass). */
export function isStatic(body: RigidBody): boolean {
  return body.invMass === 0;
}

/** Mass of the body (`Infinity` when static). */
export function getMass(body: RigidBody): number {
  return body.invMass === 0 ? Infinity : 1 / body.invMass;
}

/** Accumulate a force to be applied on the next integration step. */
export function applyForce(body: RigidBody, force: ReadonlyVec3): void {
  Vec3.add(body.force, body.force, force);
}

/** Apply an instantaneous impulse, changing velocity by `impulse * invMass`. */
export function applyImpulse(body: RigidBody, impulse: ReadonlyVec3): void {
  Vec3.scaleAndAdd(body.velocity, body.velocity, impulse, body.invMass);
}

const _localTorque: Vec3T = [0, 0, 0];
const _invOrientation: QuatT = [0, 0, 0, 1];
const _relTorque: Vec3T = [0, 0, 0];

/**
 * Multiply a world-space vector by the body's world-space inverse inertia
 * (`R · (J_local ⊙ (Rᵀ · v))`). Writes into and returns `out`. Static bodies
 * (zero `invInertia`) return the zero vector.
 */
export function worldInvInertiaMultiply(
  body: RigidBody,
  v: ReadonlyVec3,
  out: Vec3T = [0, 0, 0],
): Vec3T {
  Quat.conjugate(_invOrientation, body.orientation);
  Vec3.transformQuat(out, v, _invOrientation);
  out[0] *= body.invInertia[0];
  out[1] *= body.invInertia[1];
  out[2] *= body.invInertia[2];
  Vec3.transformQuat(out, out, body.orientation);
  return out;
}

/**
 * Apply an angular impulse (world-space torque impulse), changing angular
 * velocity by `worldInvInertia * angularImpulse`. The body-local inverse inertia
 * is rotated into world space via the current orientation.
 */
export function applyAngularImpulse(
  body: RigidBody,
  angularImpulse: ReadonlyVec3,
): void {
  worldInvInertiaMultiply(body, angularImpulse, _localTorque);
  body.angularVelocity[0] += _localTorque[0];
  body.angularVelocity[1] += _localTorque[1];
  body.angularVelocity[2] += _localTorque[2];
}

/**
 * Apply an impulse at a contact point offset `relativePoint` (world-space, from
 * the center of mass). Produces both linear response (`impulse * invMass`) and
 * angular response from the induced torque `relativePoint × impulse`.
 */
export function applyImpulseAtPoint(
  body: RigidBody,
  impulse: ReadonlyVec3,
  relativePoint: ReadonlyVec3,
): void {
  applyImpulse(body, impulse);
  Vec3.cross(_relTorque, relativePoint, impulse);
  applyAngularImpulse(body, _relTorque);
}

/** Clear the accumulated force. */
export function clearForces(body: RigidBody): void {
  Vec3.set(body.force, 0, 0, 0);
}
