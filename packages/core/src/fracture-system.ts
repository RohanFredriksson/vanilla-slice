import { fractureMesh } from '@vanilla-slice/fracture';
import type { FractureOptions } from '@vanilla-slice/fracture';
import { fractureFragmentCount } from '@vanilla-slice/materials';
import type { Material } from '@vanilla-slice/materials';
import type {
  InteractionContext,
  InteractionDecision,
  InteractionOutcome,
  InteractionProcessor,
} from '@vanilla-slice/interactions';
import { toWorldMesh, replaceWithFragments, entityModelInverse } from './fragment-util';
import type { SimWorld, SliceOutcome, Vec3T, EntityId } from './types';

/** Brittleness at or above which a slice shatters (fractures) instead of cutting. */
export const BRITTLE_SLICE_CUTOFF = 0.5;

/** Optional impact context used to size and place a fracture. */
export interface FractureImpact {
  /** Impact energy; amplifies fragment count via the material's propagation. */
  energy?: number;
  /** World-space fracture origin (e.g. the contact point). */
  origin?: Vec3T;
}

/**
 * Build fracture options for an entity from its material and (optional) impact
 * data: fragment count comes from `fractureFragmentCount` (brittleness, energy,
 * and propagation), the crack spreads per the material's
 * `fracturePropagationFactor`, and the RNG is seeded by entity id for
 * deterministic results (ADR 0009).
 */
export function buildFractureOptions(
  world: SimWorld,
  id: EntityId,
  material: Material,
  impact: FractureImpact = {},
): FractureOptions {
  const size = world.bodies.get(id)?.radius ?? 1;
  return {
    count: fractureFragmentCount(material, size, impact.energy),
    propagation: material.fracturePropagationFactor,
    separationSpeed: world.config.sliceSeparationSpeed,
    seed: id as number,
    ...(impact.origin ? { origin: impact.origin } : {}),
  };
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
  const capToMaterialSpace = entityModelInverse(world, id);
  const fragments = fractureMesh(
    worldMesh,
    capToMaterialSpace ? { ...options, capToMaterialSpace } : options,
  );
  if (fragments.length < 2) {
    return { removed: [], created: [] };
  }
  return replaceWithFragments(world, id, worldMesh, fragments);
}

/**
 * FractureProcessor — the fracture interaction (ADR 0009). Registered for
 * `impact` events (enqueued by the collision system when impact energy exceeds a
 * material's toughness threshold). The fracture origin is the contact point when
 * available, so pieces fly outward from the impact; impact energy and the
 * material's propagation factor scale the fragment count.
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
    const origin = event.contact?.points[0]?.point as Vec3T | undefined;
    return fractureEntity(
      world,
      event.entity,
      buildFractureOptions(world, event.entity, material, {
        ...(event.energy !== undefined ? { energy: event.energy } : {}),
        ...(origin ? { origin } : {}),
      }),
    );
  },
};
