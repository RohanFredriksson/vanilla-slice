import {
  querySliceCandidates,
  sliceIntersectsSphere,
  sliceMesh,
} from '@vanilla-slice/slicing';
import type { SliceVolume } from '@vanilla-slice/slicing';
import type {
  InteractionContext,
  InteractionDecision,
  InteractionOutcome,
  InteractionProcessor,
} from '@vanilla-slice/interactions';
import { toWorldMesh, replaceWithFragments, entityModelInverse } from './fragment-util';
import { processInteractions } from './interaction-system';
import { fractureEntity, buildFractureOptions, BRITTLE_SLICE_CUTOFF } from './fracture-system';
import type { SimWorld, SliceOutcome, EntityId } from './types';

/** Options for a slice operation. */
export interface SliceWorldOptions {
  /** Overrides the world's default fragment separation speed. */
  separationSpeed?: number;
}

/** Payload carried by a `slice` interaction event. */
export interface SlicePayload {
  volume: SliceVolume;
  separationSpeed: number;
}

/**
 * Slice one entity by a bounded volume: transform its mesh to world space, split
 * it, and — when the cut actually divides the mesh — replace it with fragment
 * bodies carrying separation impulses (ADR 0009). Returns entities removed and
 * created.
 */
function sliceEntity(
  world: SimWorld,
  id: EntityId,
  volume: SliceVolume,
  separationSpeed: number,
): SliceOutcome {
  const worldMesh = toWorldMesh(world, id);
  if (!worldMesh) {
    return { removed: [], created: [] };
  }
  const capToMaterialSpace = entityModelInverse(world, id);
  const fragments = sliceMesh(worldMesh, volume, {
    separationSpeed,
    ...(capToMaterialSpace ? { capToMaterialSpace } : {}),
  });
  if (fragments.length < 2) {
    // The plane did not actually divide this mesh; leave it intact.
    return { removed: [], created: [] };
  }
  return replaceWithFragments(world, id, worldMesh, fragments);
}

/**
 * SliceProcessor — the slice interaction (ADR 0009). It applies to a sliceable
 * body whose bounding sphere meets the slice volume. Brittle materials
 * (`brittleness >= {@link BRITTLE_SLICE_CUTOFF}`) shatter via the fracture
 * pipeline instead of cutting cleanly — slice-driven fracturing, decided purely
 * from material data. `core` registers it with the world's interaction registry.
 */
export const sliceProcessor: InteractionProcessor<SimWorld> = {
  type: 'slice',
  evaluate(ctx: InteractionContext<SimWorld>): InteractionDecision {
    const { world, event } = ctx;
    const payload = event.payload as SlicePayload | undefined;
    const body = world.bodies.get(event.entity);
    const sliceable = world.sliceables.get(event.entity);
    if (!payload || !body || !sliceable || !sliceable.enabled) {
      return { applies: false };
    }
    return {
      applies: sliceIntersectsSphere(payload.volume, body.position, body.radius),
    };
  },
  apply(ctx: InteractionContext<SimWorld>): InteractionOutcome {
    const { world, event, material } = ctx;
    const payload = event.payload as SlicePayload;
    if (material.brittleness >= BRITTLE_SLICE_CUTOFF) {
      return fractureEntity(
        world,
        event.entity,
        buildFractureOptions(world, event.entity, material),
      );
    }
    return sliceEntity(
      world,
      event.entity,
      payload.volume,
      payload.separationSpeed,
    );
  },
};

/**
 * SliceSystem entry point — enqueue a `slice` interaction for every broad-phase
 * candidate of a bounded volume, then drain the interaction queue. Retained as
 * the stable public API; slicing now flows through the interaction framework
 * (ADR 0009), so this is a thin shim over {@link sliceProcessor}.
 */
export function sliceWorld(
  world: SimWorld,
  volume: SliceVolume,
  options: SliceWorldOptions = {},
): SliceOutcome {
  const separationSpeed =
    options.separationSpeed ?? world.config.sliceSeparationSpeed;
  for (const id of querySliceCandidates(world.spatial, volume)) {
    world.interactions.enqueue({
      type: 'slice',
      entity: id,
      payload: { volume, separationSpeed } satisfies SlicePayload,
    });
  }
  return processInteractions(world);
}

