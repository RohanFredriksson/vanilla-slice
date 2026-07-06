import type { Material } from '@vanilla-slice/materials';
import type { SimWorld, SliceOutcome, EntityId } from './types';

/**
 * Resolve an entity's material from its `MaterialRef`, falling back to the
 * library's default material when the entity carries none (ADR 0009).
 */
export function resolveMaterial(world: SimWorld, id: EntityId): Material {
  const ref = world.materialRefs.get(id);
  return ref ? world.materials.get(ref.materialId) : world.materials.defaultMaterial;
}

/**
 * InteractionSystem — drain the per-step interaction queue and dispatch each
 * event through the registry (ADR 0009). Runs after the physics solve so that
 * geometry mutation (spawning fragments, despawning parents) never happens
 * inside the collision loop. Events are drained in a deterministic order;
 * returns the entities removed and created across all processed interactions.
 */
export function processInteractions(world: SimWorld): SliceOutcome {
  const removed: EntityId[] = [];
  const created: EntityId[] = [];
  for (const event of world.interactions.drain()) {
    const material = resolveMaterial(world, event.entity);
    const outcome = world.interactionRegistry.process(world, event, material);
    if (outcome) {
      for (const id of outcome.removed) {
        removed.push(id);
      }
      for (const id of outcome.created) {
        created.push(id);
      }
    }
  }
  return { removed, created };
}
