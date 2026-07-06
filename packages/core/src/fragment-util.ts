import { Mat4 } from '@vanilla-slice/math';
import { cloneMesh, transformMesh, computeVolume } from '@vanilla-slice/geometry';
import type { Mesh } from '@vanilla-slice/geometry';
import { getMass } from '@vanilla-slice/physics';
import type { ConvexShape } from '@vanilla-slice/physics';
import { recenterMesh, boundingRadius } from './mesh-util';
import type { SimWorld, SliceOutcome, Vec3T, EntityId } from './types';

const IDENTITY_SCALE: Vec3T = [1, 1, 1];

/**
 * Transform an entity's local source mesh into world space, ready for a cut or
 * fracture. Returns `null` when the entity has no enabled sliceable mesh/body.
 */
export function toWorldMesh(world: SimWorld, id: EntityId): Mesh | null {
  const sliceable = world.sliceables.get(id);
  const body = world.bodies.get(id);
  if (!sliceable || !sliceable.enabled || !body) {
    return null;
  }
  const worldMesh = cloneMesh(sliceable.mesh);
  const xform = Mat4.create();
  Mat4.fromRotationTranslationScale(
    xform,
    body.orientation,
    body.position,
    IDENTITY_SCALE,
  );
  transformMesh(worldMesh, xform);
  return worldMesh;
}

/** A world-space fragment ready to become a body (produced by slice/fracture). */
export interface SpawnableFragment {
  mesh: Mesh;
  centroid: Vec3T;
  impulse: Vec3T;
  /**
   * Convex collider in centroid-local space. Fragments are already convex, so
   * slice/fracture precompute this; passing it lets `spawn` skip recomputing a
   * convex hull (ROADMAP Phase 10.1).
   */
  hull?: ConvexShape;
}

/**
 * Replace `id` with `fragments`: distribute the parent's mass by volume, add each
 * fragment's separation impulse to the parent velocity, inherit render handle,
 * material, name, and tags, despawn the parent, then spawn the pieces. Shared by
 * the slice and fracture interactions — core owns entity lifecycle and applies
 * the impulses geometry computed (ownership rules, ADR 0009). A single fragment
 * is treated as "not divided": the object is left intact.
 */
export function replaceWithFragments(
  world: SimWorld,
  id: EntityId,
  worldMesh: Mesh,
  fragments: readonly SpawnableFragment[],
): SliceOutcome {
  const removed: EntityId[] = [];
  const created: EntityId[] = [];
  const body = world.bodies.get(id);
  if (!body || fragments.length < 2) {
    return { removed, created };
  }

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
  const material = world.materialRefs.get(id)?.materialId;

  world.despawn(id);
  removed.push(id);

  for (const fragment of fragments) {
    // Bake world orientation into the recentered local mesh; the new body uses
    // identity orientation with its centroid as position.
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
      ...(fragment.hull ? { collider: fragment.hull } : {}),
      ...(meshRef !== undefined ? { meshRef } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(material !== undefined ? { material } : {}),
      tags,
    });
    created.push(newId);
  }

  return { removed, created };
}
