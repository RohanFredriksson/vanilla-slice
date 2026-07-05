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
}

/** Convert a mass to an inverse mass (`0` for static bodies). */
export function massToInvMass(mass: number): number {
  return mass > 0 && Number.isFinite(mass) ? 1 / mass : 0;
}

/** Create a rigid body from options, filling sensible defaults. */
export function createBody(options: BodyOptions = {}): RigidBody {
  return {
    position: options.position ? Vec3.clone(options.position) : Vec3.create(),
    velocity: options.velocity ? Vec3.clone(options.velocity) : Vec3.create(),
    orientation: options.orientation
      ? Quat.clone(options.orientation)
      : Quat.create(),
    angularVelocity: options.angularVelocity
      ? Vec3.clone(options.angularVelocity)
      : Vec3.create(),
    invMass: massToInvMass(options.mass ?? 1),
    linearDamping: options.linearDamping ?? 0,
    angularDamping: options.angularDamping ?? 0,
    radius: options.radius ?? 0.5,
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

/** Clear the accumulated force. */
export function clearForces(body: RigidBody): void {
  Vec3.set(body.force, 0, 0, 0);
}
