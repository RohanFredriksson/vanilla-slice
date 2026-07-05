import { Vec3, Quat } from '@slice/math';
import { integrateBody, resolveHalfSpace, isOutOfBounds } from '@slice/physics';
import { insert } from '@slice/spatial';
import { sphereAabb } from './mesh-util';
import type { SimWorld, RenderItem, EntityId } from './types';

/**
 * PhysicsSystem — advance every body by one fixed step: apply gravity/forces via
 * integration, then resolve the optional ground half-space.
 */
export function stepPhysics(world: SimWorld, dt: number): void {
  const { gravity, ground } = world.config;
  for (const body of world.bodies.values()) {
    integrateBody(body, gravity, dt);
    if (ground) {
      resolveHalfSpace(body, ground.normal, ground.offset, ground.restitution ?? 0);
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
