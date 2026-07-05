import { Vec3, Quat } from '@vanilla-slice/math';
import {
  integrateBody,
  resolveHalfSpace,
  isOutOfBounds,
  convexConvexManifold,
  sphereSphereContact,
  resolveContact,
} from '@vanilla-slice/physics';
import type { RigidBody, ContactManifold } from '@vanilla-slice/physics';
import { insert, getPotentialPairs } from '@vanilla-slice/spatial';
import { sphereAabb } from './mesh-util';
import type { SimWorld, RenderItem, EntityId } from './types';

/**
 * PhysicsSystem — advance every body by one fixed step: apply gravity/forces via
 * integration, resolve the optional ground half-space, then (when enabled)
 * refresh the broad-phase and resolve body-vs-body collisions.
 */
export function stepPhysics(world: SimWorld, dt: number): void {
  const { gravity, ground } = world.config;
  for (const body of world.bodies.values()) {
    integrateBody(body, gravity, dt);
    if (ground) {
      resolveHalfSpace(body, ground.normal, ground.offset, ground.restitution ?? 0);
    }
  }
  if (world.config.collisions) {
    syncSpatial(world);
    resolveCollisions(world);
  }
}

/** Build a one-point manifold from a bounding-sphere contact, or `null`. */
function sphereManifold(a: RigidBody, b: RigidBody): ContactManifold | null {
  const contact = sphereSphereContact(a.position, a.radius, b.position, b.radius);
  if (!contact) {
    return null;
  }
  const { normal, depth } = contact;
  // Contact point midway through the overlap along the normal from a's surface.
  const offset = a.radius - depth * 0.5;
  const point: [number, number, number] = [
    a.position[0] + normal[0] * offset,
    a.position[1] + normal[1] * offset,
    a.position[2] + normal[2] * offset,
  ];
  return { normal, points: [{ point, penetration: depth }] };
}

/**
 * CollisionSystem — resolve body-vs-body contacts. Broad-phase candidate pairs
 * come from the spatial hash; narrow-phase uses convex hulls (GJK/EPA + face
 * clipping) when both bodies have a collider, falling back to bounding spheres.
 * Static/static and opted-out (`collides: false`) pairs are skipped.
 */
export function resolveCollisions(world: SimWorld): void {
  const options = {
    restitution: world.config.restitution,
    friction: world.config.friction,
  };
  for (const [idA, idB] of getPotentialPairs(world.spatial)) {
    if (world.nonCollidable.has(idA) || world.nonCollidable.has(idB)) {
      continue;
    }
    const a = world.bodies.get(idA);
    const b = world.bodies.get(idB);
    if (!a || !b || (a.invMass === 0 && b.invMass === 0)) {
      continue;
    }
    const shapeA = world.colliders.get(idA);
    const shapeB = world.colliders.get(idB);
    const manifold =
      shapeA && shapeB
        ? convexConvexManifold(
            shapeA,
            a.position,
            a.orientation,
            shapeB,
            b.position,
            b.orientation,
          )
        : sphereManifold(a, b);
    if (manifold) {
      resolveContact(a, b, manifold, options);
    }
  }
}

/**
 * SpatialSystem — refresh each body's placement in the broad-phase hash so slice
 * and neighbor queries reflect the current frame.
 */
export function syncSpatial(world: SimWorld): void {
  for (const [id, body] of world.bodies) {
    insert(world.spatial, id, sphereAabb(body.position, body.radius));
  }
}

/**
 * CleanupSystem — remove bodies that have left the simulation bounds (fallen or
 * flown away).
 */
export function runCleanup(world: SimWorld): EntityId[] {
  const removed: EntityId[] = [];
  for (const [id, body] of world.bodies) {
    if (isOutOfBounds(body.position, world.config.bounds)) {
      removed.push(id);
    }
  }
  for (const id of removed) {
    world.despawn(id);
  }
  return removed;
}

/**
 * RenderSystem — produce a read-only snapshot of renderable transforms for the
 * rendering adapter. Core never touches GPU/DOM state; the adapter reads this.
 */
export function getRenderState(world: SimWorld): RenderItem[] {
  const items: RenderItem[] = [];
  for (const [id, renderable] of world.renderables) {
    const body = world.bodies.get(id);
    if (!body) {
      continue;
    }
    items.push({
      id,
      meshRef: renderable.meshRef,
      position: Vec3.clone(body.position),
      orientation: Quat.clone(body.orientation),
      visible: renderable.visible,
    });
  }
  return items;
}
