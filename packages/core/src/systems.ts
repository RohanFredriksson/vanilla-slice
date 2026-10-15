import { Vec3, Quat } from '@vanilla-slice/math';
import {
  integrateBody,
  resolveHalfSpace,
  isOutOfBounds,
  convexConvexManifold,
  sphereSphereContact,
  resolveContact,
  getMass,
} from '@vanilla-slice/physics';
import type { RigidBody, ContactManifold } from '@vanilla-slice/physics';
import { insert, remove as spatialRemove, getPotentialPairs } from '@vanilla-slice/spatial';
import { exceedsFractureThreshold } from '@vanilla-slice/interactions';
import { sphereAabb } from './mesh-util';
import type { SimWorld, RenderItem, EntityId, Vec3T, GroundConfig } from './types';
import type { ConvexShape } from '@vanilla-slice/physics';

/**
 * Bodies smaller than this bounding radius never fracture on a ground impact.
 * Keeps small shards from shattering endlessly into dust on every bounce.
 */
const MIN_GROUND_FRACTURE_RADIUS = 0.35;

/**
 * How many times a piece may be re-shattered by automatic impact fractures.
 * Sliced/spawned bodies are generation 0; each impact-fracture produces
 * generation+1 fragments. Capping this prevents a runaway cascade — smaller
 * fragments have a lower `toughness × size` threshold, so without a bound a
 * single hard landing would shatter forever.
 */
const MAX_IMPACT_FRACTURE_GENERATIONS = 2;

/**
 * Minimum brittleness for a material to shatter on a hard impact. Materials
 * below this are ductile/tough and deform or slide rather than cracking — they
 * never fracture on collision regardless of energy. Stone (0.4), glass (0.9),
 * etc. sit above this threshold; the default material (0) stays unbreakable.
 */
const MIN_BRITTLENESS_FOR_IMPACT = 0.05;

/**
 * Whether a body is still eligible to be shattered by an automatic impact
 * (ground or body-vs-body): it must carry a fracturable, brittle-enough material
 * and sit below the generation cap. Bounds the cascade regardless of energy or
 * piece size.
 */
function canImpactFracture(world: SimWorld, id: EntityId): boolean {
  const ref = world.materialRefs.get(id);
  if (!ref) {
    return false;
  }
  const material = world.materials.get(ref.materialId);
  if (material.brittleness < MIN_BRITTLENESS_FOR_IMPACT) {
    return false;
  }
  const generation = world.metadata.get(id)?.fractureGeneration ?? 0;
  return generation < MAX_IMPACT_FRACTURE_GENERATIONS;
}

/**
 * Whether a body is in its shrink-dissolve phase (Phase 12.1). Dissolving
 * bodies have crossed the culling threshold and are shrinking out of
 * existence: they no longer participate in collision, spatial, slicing,
 * fracture, or bounds cleanup, but keep integrating under physics.
 */
function isDissolving(world: SimWorld, id: EntityId): boolean {
  return world.metadata.get(id)?.dissolving === true;
}

/**
 * PhysicsSystem — advance every body by one fixed step: apply gravity/forces via
 * integration, resolve the optional ground half-space, then (when enabled)
 * refresh the broad-phase and resolve body-vs-body collisions.
 */
export function stepPhysics(world: SimWorld, dt: number): void {
  const { gravity, ground } = world.config;
  for (const [id, body] of world.bodies.entries()) {
    integrateBody(body, gravity, dt);
    if (ground) {
      // Track the inbound normal speed of fracturable bodies so a hard landing
      // can be turned into an impact fracture (the ground is a half-space, not a
      // body, so the body-vs-body impact path never sees it).
      const track =
        world.materialRefs.has(id) &&
        world.sliceables.get(id)?.enabled === true &&
        !isDissolving(world, id);
      const vnBefore = track ? Vec3.dot(ground.normal, body.velocity) : 0;
      const resolved = resolveHalfSpace(
        body,
        ground.normal,
        ground.offset,
        ground.restitution ?? 0,
        world.colliders.get(id),
        world.config.tipFactor,
      );
      // Only check for fracture when resolveHalfSpace actually found ground
      // contact (resolved === true). Without this guard, tryGroundFracture is
      // called every frame the body is falling (vnBefore < 0), and after enough
      // frames the accumulated speed exceeds the threshold — causing fracture
      // while the body is still in mid-air.
      if (track && vnBefore < 0 && resolved) {
        tryGroundFracture(world, id, body, ground, -vnBefore);
      }
    }
  }
  if (world.config.collisions) {
    syncSpatial(world);
    resolveCollisions(world);
  }
}

/**
 * Enqueue an `impact` interaction when a fracturable body strikes the ground
 * hard enough to exceed its material's fracture threshold. `impactSpeed` is the
 * inbound speed along the ground normal (measured before the half-space solve
 * absorbed it); the kinetic energy `½·m·v²` is tested against `toughness × size`,
 * exactly like body-vs-body impacts. Pieces below {@link MIN_GROUND_FRACTURE_RADIUS}
 * are ignored so shards don't cascade into dust.
 */
function tryGroundFracture(
  world: SimWorld,
  id: EntityId,
  body: RigidBody,
  ground: GroundConfig,
  impactSpeed: number,
): void {
  if (body.radius < MIN_GROUND_FRACTURE_RADIUS) {
    return;
  }
  if (!canImpactFracture(world, id)) {
    return;
  }
  const mass = getMass(body);
  if (!Number.isFinite(mass)) {
    return; // static body
  }
  const ref = world.materialRefs.get(id)!; // guaranteed by canImpactFracture
  const material = world.materials.get(ref.materialId);
  const energy = 0.5 * mass * impactSpeed * impactSpeed;
  if (!exceedsFractureThreshold(material, energy, body.radius)) {
    return;
  }
  // Contact point: the body centre projected onto the ground plane.
  const dist = Vec3.dot(ground.normal, body.position) - ground.offset;
  const contact: ContactManifold = {
    normal: [ground.normal[0], ground.normal[1], ground.normal[2]],
    points: [
      {
        point: [
          body.position[0] - ground.normal[0] * dist,
          body.position[1] - ground.normal[1] * dist,
          body.position[2] - ground.normal[2] * dist,
        ],
        penetration: 0,
      },
    ],
  };
  world.interactions.enqueue({ type: 'impact', entity: id, energy, contact });
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
  if (!canImpactFracture(world, id)) {
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
                const impactEnergy = pairImpactEnergy(a, b);
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
        const impactEnergy = pairImpactEnergy(a, b);
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
    // Dissolving bodies were removed from the hash when they started shrinking;
    // re-inserting them would let them be sliced/collided with again.
    if (isDissolving(world, id)) {
      continue;
    }
    insert(world.spatial, id, sphereAabb(body.position, body.radius));
  }
}

/**
 * CleanupSystem — remove bodies that have left the simulation bounds (fallen or
 * flown away). Dissolving bodies are exempt so their shrink animation always
 * completes (Phase 12.1).
 */
export function runCleanup(world: SimWorld): EntityId[] {
  const removed: EntityId[] = [];
  for (const [id, body] of world.bodies) {
    if (isDissolving(world, id)) {
      continue;
    }
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
 * SmallFragmentCullingSystem — despawn tiny fragments once they have existed
 * for a configured delay (Phase 12). Enabled only when the world configures
 * `smallBodyCulling`; a body whose recorded `volume` is below `minVolume` and
 * whose age reaches `delaySeconds` is removed, so repeated slices cannot grind
 * the scene into hundreds of near-zero-volume bodies. Age accumulates for every
 * eligible body regardless of current size, so a piece that shrinks on a later
 * cut is already counted as aged. Static bodies, `cullable: false` bodies, and
 * bodies without a recorded volume are exempt. Per-frame cost is one
 * accumulation + one comparison per body — no allocations.
 *
 * When `shrinkSeconds > 0` (default 0.3), a body that crosses the threshold is
 * first marked `dissolving` instead of being despawned: it is removed from the
 * broad phase (no collisions, slices, or fractures) and its render scale eases
 * to zero over `shrinkSeconds`; the despawn fires when the age reaches
 * `delaySeconds + shrinkSeconds`. With `shrinkSeconds: 0` the original instant
 * despawn behaviour is preserved (Phase 12.1).
 */
export function cullSmallBodies(world: SimWorld, frameDelta: number): EntityId[] {
  const culling = world.config.smallBodyCulling;
  if (!culling) {
    return [];
  }
  const removed: EntityId[] = [];
  for (const [id, body] of world.bodies) {
    const meta = world.metadata.get(id);
    if (!meta || meta.cullable === false || meta.volume === undefined) {
      continue;
    }
    if (culling.skipStatic && body.invMass === 0) {
      continue;
    }
    const age = (meta.ageSeconds ?? 0) + frameDelta;
    meta.ageSeconds = age;
    if (meta.dissolving) {
      if (age >= culling.delaySeconds + culling.shrinkSeconds) {
        removed.push(id);
      }
      continue;
    }
    if (age >= culling.delaySeconds && meta.volume < culling.minVolume) {
      meta.dissolving = true;
      // Leave the broad phase so nothing can slice, hit, or re-collide with the
      // shrinking piece; the render state still emits it until despawn.
      spatialRemove(world.spatial, id);
      if (age >= culling.delaySeconds + culling.shrinkSeconds) {
        removed.push(id);
      }
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
    const materialId = world.materialRefs.get(id)?.materialId;
    items.push({
      id,
      meshRef: renderable.meshRef,
      position: Vec3.clone(body.position),
      orientation: Quat.clone(body.orientation),
      visible: renderable.visible,
      scale: dissolveScale(world, id),
      ...(materialId !== undefined ? { materialId } : {}),
    });
  }
  return items;
}

/**
 * The uniform render scale for an entity: `[1,1,1]` normally; a dissolving
 * body eases it from `1` → `0` across `smallBodyCulling.shrinkSeconds`
 * (Phase 12.1). Derived from the age timer so no second clock is needed.
 */
function dissolveScale(world: SimWorld, id: EntityId): Vec3T {
  const culling = world.config.smallBodyCulling;
  const meta = world.metadata.get(id);
  if (!culling || !meta?.dissolving || culling.shrinkSeconds <= 0) {
    return [1, 1, 1];
  }
  const progress = ((meta.ageSeconds ?? 0) - culling.delaySeconds) / culling.shrinkSeconds;
  const s = Math.max(0, Math.min(1, 1 - progress));
  return [s, s, s];
}
