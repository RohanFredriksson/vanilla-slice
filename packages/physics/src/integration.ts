import { Vec3, Quat } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import { clearForces, isStatic } from './body';
import type { RigidBody } from './body';

type Vec3T = ReturnType<typeof Vec3.create>;
type QuatT = ReturnType<typeof Quat.create>;

/**
 * Advance a single body by `dt` seconds using semi-implicit (symplectic) Euler
 * integration: velocity is updated first, then position, which is stable for
 * real-time simulation.
 *
 * Gravity is applied as a mass-independent acceleration and only affects dynamic
 * bodies. The body's accumulated force is consumed and cleared.
 */
export function integrateBody(
  body: RigidBody,
  gravity: ReadonlyVec3,
  dt: number,
): void {
  if (!isStatic(body)) {
    // v += (gravity + force * invMass) * dt
    body.velocity[0] += (gravity[0] + body.force[0] * body.invMass) * dt;
    body.velocity[1] += (gravity[1] + body.force[1] * body.invMass) * dt;
    body.velocity[2] += (gravity[2] + body.force[2] * body.invMass) * dt;

    const linearRetain = Math.max(0, 1 - body.linearDamping * dt);
    body.velocity[0] *= linearRetain;
    body.velocity[1] *= linearRetain;
    body.velocity[2] *= linearRetain;

    const angularRetain = Math.max(0, 1 - body.angularDamping * dt);
    body.angularVelocity[0] *= angularRetain;
    body.angularVelocity[1] *= angularRetain;
    body.angularVelocity[2] *= angularRetain;
  }

  // Integrate position.
  Vec3.scaleAndAdd(body.position, body.position, body.velocity, dt);

  // Integrate orientation: q += 0.5 * dt * (omega ⊗ q), then renormalize.
  integrateOrientation(body.orientation, body.angularVelocity, dt);

  clearForces(body);
}

const _omega: QuatT = [0, 0, 0, 0];
const _spin: QuatT = [0, 0, 0, 0];

/** Integrate a unit orientation quaternion by an angular velocity over `dt`. */
function integrateOrientation(
  orientation: QuatT,
  angularVelocity: Vec3T,
  dt: number,
): void {
  if (
    angularVelocity[0] === 0 &&
    angularVelocity[1] === 0 &&
    angularVelocity[2] === 0
  ) {
    return;
  }
  _omega[0] = angularVelocity[0];
  _omega[1] = angularVelocity[1];
  _omega[2] = angularVelocity[2];
  _omega[3] = 0;
  // spin = omega ⊗ orientation
  Quat.multiply(_spin, _omega, orientation);
  const half = 0.5 * dt;
  orientation[0] += _spin[0] * half;
  orientation[1] += _spin[1] * half;
  orientation[2] += _spin[2] * half;
  orientation[3] += _spin[3] * half;
  Quat.normalize(orientation, orientation);
}

/** Integrate every body in the collection by `dt`. */
export function integrateBodies(
  bodies: Iterable<RigidBody>,
  gravity: ReadonlyVec3,
  dt: number,
): void {
  for (const body of bodies) {
    integrateBody(body, gravity, dt);
  }
}
