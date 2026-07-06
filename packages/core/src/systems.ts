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
import { exceedsFractureThreshold } from '@vanilla-slice/interactions';
import { sphereAabb } from './mesh-util';
import type { SimWorld, RenderItem, EntityId } from './types';
import type { ConvexShape } from '@vanilla-slice/physics';

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
 * A body's effective restitution/friction: its material's value when it carries
 * a `MaterialRef`, else the world default. Materialless pairs therefore reduce
 * to the world config exactly as before (behaviour-neutral — ADR 0009).
 */
function bodyRestitution(world: SimWorld, id: EntityId): number {
  const ref = world.materialRefs.get(id);
  return ref ? world.materials.get(ref.materialId).restitution : world.config.restitution;
}

function bodyFriction(world: SimWorld, id: EntityId): number {
  const ref = world.materialRefs.get(id);
  return ref ? world.materials.get(ref.materialId).friction : world.config.friction;
}

/** Kinetic energy of approach for a colliding pair (reduced-mass estimate). */
function pairImpactEnergy(a: RigidBody, b: RigidBody): number {
  const invSum = a.invMass + b.invMass;
  if (invSum === 0) {
    return 0;
  }
  const dx = a.velocity[0] - b.velocity[0];
  const dy = a.velocity[1] - b.velocity[1];
  const dz = a.velocity[2] - b.velocity[2];
  return (0.5 * (dx * dx + dy * dy + dz * dz)) / invSum;
}

/**
 * Enqueue an `impact` interaction for a body when the collision energy exceeds
 * its material's fracture threshold (`toughness × size`). Materialless bodies
 * resolve to the unbreakable default and never qualify, so this stays
 * behaviour-neutral until a fracture processor is registered (ADR 0009).
 */
function enqueueImpact(
  world: SimWorld,
  id: EntityId,
  other: EntityId,
  body: RigidBody,
  energy: number,
  contact: ContactManifold,
): void {
  const ref = world.materialRefs.get(id);
  if (!ref) {
    return;
  }
  const material = world.materials.get(ref.materialId);
  if (exceedsFractureThreshold(material, energy, body.radius)) {
    world.interactions.enqueue({ type: 'impact', entity: id, other, energy, contact });
  }
}

/**
 * CollisionSystem — resolve body-vs-body contacts. Broad-phase candidate pairs
 * come from the spatial hash; narrow-phase uses convex hulls (GJK/EPA + face
 * clipping) when both bodies have a collider, falling back to bounding spheres.
 * Bodies with a compound (decomposed) collider test each of their hulls.
 * Static/static and opted-out (`collides: false`) pairs are skipped.
 *
 * Contact restitution/friction are combined from the two bodies' materials
 * (max restitution, geometric-mean friction), falling back to world defaults.
 */
export function resolveCollisions(world: SimWorld): void {
  for (const [idA, idB] of getPotentialPairs(world.spatial)) {
    if (world.nonCollidable.has(idA) || world.nonCollidable.has(idB)) {
      continue;
    }
    const a = world.bodies.get(idA);
    const b = world.bodies.get(idB);
    if (!a || !b || (a.invMass === 0 && b.invMass === 0)) {
      continue;
    }

    const options = {
      restitution: Math.max(bodyRestitution(world, idA), bodyRestitution(world, idB)),
      friction: Math.sqrt(bodyFriction(world, idA) * bodyFriction(world, idB)),
    };

    // Impact energy for material-driven fracture, only when a body can fracture.
    const canFracture =
      world.materialRefs.has(idA) || world.materialRefs.has(idB);
    const impactEnergy = canFracture ? pairImpactEnergy(a, b) : 0;
    let impactQueued = false;

    const compoundA = world.compoundColliders.get(idA);
    const compoundB = world.compoundColliders.get(idB);
    if (compoundA || compoundB) {
      // Compound path: test every hull pair (only allocates for concave bodies).
      const single = (id: EntityId): ConvexShape[] | undefined => {
        const shape = world.colliders.get(id);
        return shape ? [shape] : undefined;
      };
      const hullsA = compoundA ?? single(idA);
      const hullsB = compoundB ?? single(idB);
      if (hullsA && hullsB) {
        for (const hullA of hullsA) {
          for (const hullB of hullsB) {
            const manifold = convexConvexManifold(
              hullA,
              a.position,
              a.orientation,
              hullB,
              b.position,
              b.orientation,
            );
            if (manifold) {
              if (canFracture && !impactQueued) {
                enqueueImpact(world, idA, idB, a, impactEnergy, manifold);
                enqueueImpact(world, idB, idA, b, impactEnergy, manifold);
                impactQueued = true;
              }
              resolveContact(a, b, manifold, options);
            }
          }
        }
      }
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
      if (canFracture && !impactQueued) {
        enqueueImpact(world, idA, idB, a, impactEnergy, manifold);
        enqueueImpact(world, idB, idA, b, impactEnergy, manifold);
        impactQueued = true;
      }
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
