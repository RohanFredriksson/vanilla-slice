import { Vec3 } from '@vanilla-slice/math';
import {
  splitMeshByPlane,
  vertexCount,
  getVertex,
  hullFromConvexMesh,
  translateHull,
} from '@vanilla-slice/geometry';
import type { Mesh, ConvexHull } from '@vanilla-slice/geometry';
import type { SliceVolume } from './slice-volume';

type Vec3T = ReturnType<typeof Vec3.create>;

/**
 * A piece produced by slicing a mesh. `side` is `+1` for the piece on the plane
 * normal's side and `-1` for the opposite side. `impulse` is the suggested
 * separation velocity for the piece — the physics/core layer applies it
 * (slicing never touches physics state).
 */
export interface Fragment {
  mesh: Mesh;
  side: 1 | -1;
  impulse: Vec3T;
  centroid: Vec3T;
  /**
   * Convex hull of the piece in centroid-local space (i.e. relative to
   * `centroid`), ready to serve as the collider for the body spawned at
   * `centroid` with identity orientation.
   */
  hull: ConvexHull;
}

/** Options for {@link sliceMesh}. */
export interface SliceMeshOptions {
  /** Speed at which the two pieces separate along the plane normal. */
  separationSpeed?: number;
  /** Cap the exposed cross-section so pieces stay closed solids (default true). */
  cap?: boolean;
}

/** Average vertex position of a mesh. */
export function computeCentroid(mesh: Mesh): Vec3T {
  const centroid: Vec3T = [0, 0, 0];
  const count = vertexCount(mesh);
  if (count === 0) {
    return centroid;
  }
  const v: Vec3T = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    getVertex(mesh, i, v);
    centroid[0] += v[0];
    centroid[1] += v[1];
    centroid[2] += v[2];
  }
  centroid[0] /= count;
  centroid[1] /= count;
  centroid[2] /= count;
  return centroid;
}

/**
 * Slice a world-space mesh by a slice volume, producing fragments. The mesh's
 * positions must already be in the same (world) space as the volume's plane.
 *
 * Each fragment carries a separation impulse pushing it away from the cut plane
 * so the two halves fly apart; the caller applies these to physics bodies.
 */
export function sliceMesh(
  worldMesh: Mesh,
  volume: SliceVolume,
  options: SliceMeshOptions = {},
): Fragment[] {
  const separationSpeed = options.separationSpeed ?? 1;
  const cap = options.cap ?? true;

  const { front, back } = splitMeshByPlane(worldMesh, volume.plane, { cap });
  const normal = volume.plane.normal;
  const fragments: Fragment[] = [];

  if (front) {
    const centroid = computeCentroid(front);
    fragments.push({
      mesh: front,
      side: 1,
      impulse: [
        normal[0] * separationSpeed,
        normal[1] * separationSpeed,
        normal[2] * separationSpeed,
      ],
      centroid,
      hull: localHull(front, centroid),
    });
  }
  if (back) {
    const centroid = computeCentroid(back);
    fragments.push({
      mesh: back,
      side: -1,
      impulse: [
        -normal[0] * separationSpeed,
        -normal[1] * separationSpeed,
        -normal[2] * separationSpeed,
      ],
      centroid,
      hull: localHull(back, centroid),
    });
  }
  return fragments;
}

/** Convex hull of `mesh` expressed relative to `centroid` (centroid-local space). */
function localHull(mesh: Mesh, centroid: Vec3T): ConvexHull {
  // Slice pieces are convex, so use the cheap fast path (no Quickhull search).
  const hull = hullFromConvexMesh(mesh);
  return translateHull(hull, [-centroid[0], -centroid[1], -centroid[2]]);
}
