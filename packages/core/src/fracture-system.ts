import { fractureMesh } from '@vanilla-slice/fracture';
import type { FractureOptions } from '@vanilla-slice/fracture';
import type {
  InteractionContext,
  InteractionDecision,
  InteractionOutcome,
  InteractionProcessor,
} from '@vanilla-slice/interactions';
import { toWorldMesh, replaceWithFragments } from './fragment-util';
import type { SimWorld, SliceOutcome, Vec3T, EntityId } from './types';

/** Brittleness at or above which a slice shatters (fractures) instead of cutting. */
export const BRITTLE_SLICE_CUTOFF = 0.5;
/** Fragment count for the most brittle materials (brittleness = 1). */
const MAX_BRITTLE_FRAGMENTS = 6;

/**
 * Fragment count derived from a material's brittleness in `[0, 1]`: more brittle
 * materials shatter into more pieces. Ranges from 2 (barely brittle) to
 * {@link MAX_BRITTLE_FRAGMENTS}.
 */
export function fractureCount(brittleness: number): number {
  const b = Number.isFinite(brittleness) ? Math.min(Math.max(brittleness, 0), 1) : 0;
  return 2 + Math.round(b * (MAX_BRITTLE_FRAGMENTS - 2));
}

/**
 * Fracture one entity into Voronoi fragments, replacing it. Mirrors the slice
 * pipeline's ownership: geometry (`fracture`) generates world-space fragments +
 * radial impulses; core distributes mass, applies impulses, and spawns bodies
 * (ADR 0009). Returns the entities removed and created.
 */
export function fractureEntity(
  world: SimWorld,
  id: EntityId,
  options: FractureOptions = {},
): SliceOutcome {
  const worldMesh = toWorldMesh(world, id);
  if (!worldMesh) {
    return { removed: [], created: [] };
  }
  const fragments = fractureMesh(worldMesh, options);
  if (fragments.length < 2) {
    return { removed: [], created: [] };
  }
  return replaceWithFragments(world, id, worldMesh, fragments);
}

/**
 * FractureProcessor — the fracture interaction (ADR 0009). Registered for
 * `impact` events (enqueued by the collision system when impact energy exceeds a
 * material's toughness threshold). The fracture origin is the contact point when
 * available, so pieces fly outward from the impact. Fragment count scales with
 * brittleness; the RNG is seeded by entity id for deterministic results.
 */
export const fractureProcessor: InteractionProcessor<SimWorld> = {
  type: 'impact',
  evaluate(ctx: InteractionContext<SimWorld>): InteractionDecision {
    const { world, event } = ctx;
    const body = world.bodies.get(event.entity);
    const sliceable = world.sliceables.get(event.entity);
    return { applies: !!body && !!sliceable && sliceable.enabled };
  },
  apply(ctx: InteractionContext<SimWorld>): InteractionOutcome {
    const { world, event, material } = ctx;
    const origin = ctx.event.contact?.points[0]?.point as Vec3T | undefined;
    return fractureEntity(world, event.entity, {
      count: fractureCount(material.brittleness),
      separationSpeed: world.config.sliceSeparationSpeed,
      seed: event.entity as number,
      ...(origin ? { origin } : {}),
    });
  },
};
