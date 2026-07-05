import { Mat4 } from '@slice/math';
import { cloneMesh, transformMesh, computeVolume } from '@slice/geometry';
import { getMass } from '@slice/physics';
import {
  querySliceCandidates,
  sliceIntersectsSphere,
  sliceMesh,
} from '@slice/slicing';
import type { SliceVolume } from '@slice/slicing';
import { recenterMesh, boundingRadius } from './mesh-util';
import type { SimWorld, SliceOutcome, Vec3T } from './types';

/** Options for a slice operation. */
export interface SliceWorldOptions {
  /** Overrides the world's default fragment separation speed. */
  separationSpeed?: number;
}

const IDENTITY_SCALE: Vec3T = [1, 1, 1];

/**
 * SliceSystem — the full slice pipeline for a bounded volume:
 * broad-phase query → narrow filter → world-space mesh split → fragment spawn
 * with separation impulses. The original sliced entity is removed and replaced
 * by its fragments. Core applies the impulses slicing computed (ownership rules).
 */
export function sliceWorld(
  world: SimWorld,
  volume: SliceVolume,
  options: SliceWorldOptions = {},
): SliceOutcome {
  const separationSpeed =
    options.separationSpeed ?? world.config.sliceSeparationSpeed;
  const removed: SliceOutcome['removed'] = [];
  const created: SliceOutcome['created'] = [];

  const xform = Mat4.create();
  const candidates = querySliceCandidates(world.spatial, volume);

  for (const id of candidates) {
    const sliceable = world.sliceables.get(id);
    const body = world.bodies.get(id);
    if (!sliceable || !sliceable.enabled || !body) {
      continue;
    }
    if (!sliceIntersectsSphere(volume, body.position, body.radius)) {
      continue;
    }

    // Transform the local mesh into world space for the cut.
    const worldMesh = cloneMesh(sliceable.mesh);
    Mat4.fromRotationTranslationScale(
      xform,
      body.orientation,
      body.position,
      IDENTITY_SCALE,
    );
    transformMesh(worldMesh, xform);

    const fragments = sliceMesh(worldMesh, volume, { separationSpeed });
    if (fragments.length < 2) {
      // The plane did not actually divide this mesh; leave it intact.
      continue;
    }

    // Capture parent state before despawning.
    const parentVelocity: Vec3T = [
      body.velocity[0],
      body.velocity[1],
      body.velocity[2],
    ];
    const parentAngular: Vec3T = [
      body.angularVelocity[0],
      body.angularVelocity[1],
      body.angularVelocity[2],
    ];
    const parentMass = getMass(body);
    const parentVolume = Math.abs(computeVolume(worldMesh));
    const meshRef = world.renderables.get(id)?.meshRef;
    const name = world.metadata.get(id)?.name;
    const tags = [...(world.metadata.get(id)?.tags ?? [])];

    world.despawn(id);
    removed.push(id);

    for (const fragment of fragments) {
      // Bake world orientation into the recentered local mesh; the new body
      // uses identity orientation with its centroid as position.
      const localMesh = recenterMesh(fragment.mesh, fragment.centroid);
      const fragmentVolume = Math.abs(computeVolume(fragment.mesh));
      const mass =
        Number.isFinite(parentMass) && parentVolume > 0
          ? Math.max(parentMass * (fragmentVolume / parentVolume), 1e-3)
          : 1;

      const velocity: Vec3T = [
        parentVelocity[0] + fragment.impulse[0],
        parentVelocity[1] + fragment.impulse[1],
        parentVelocity[2] + fragment.impulse[2],
      ];

      const newId = world.spawn({
        geometry: localMesh,
        position: [
          fragment.centroid[0],
          fragment.centroid[1],
          fragment.centroid[2],
        ],
        velocity,
        angularVelocity: parentAngular,
        mass,
        radius: boundingRadius(localMesh),
        ...(meshRef !== undefined ? { meshRef } : {}),
        ...(name !== undefined ? { name } : {}),
        tags,
      });
      created.push(newId);
    }
  }

  return { removed, created };
}
