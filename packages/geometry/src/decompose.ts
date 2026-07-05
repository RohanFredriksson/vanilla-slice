import { Vec3 } from '@vanilla-slice/math';
import {
  getVertex,
  triangleCount,
  vertexCount,
  computeBounds,
} from './mesh';
import type { Mesh } from './mesh';
import { createPlane, fromNormalAndPoint } from './plane';
import { splitMeshByPlane } from './split';
import { computeConvexHull } from './hull';
import type { ConvexHull } from './hull';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
type Vec3T = ReturnType<typeof Vec3.create>;

/** The largest extent of a mesh's axis-aligned bounds (its characteristic size). */
function characteristicSize(mesh: Mesh): number {
  const { min, max } = computeBounds(mesh);
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-9);
}

/**
 * Whether every face of `mesh` is a supporting plane of the whole mesh (i.e. the
 * mesh is convex). Assumes outward-facing, consistently-wound triangles (as
 * produced by the primitives and the mesh splitter). `relTolerance` is scaled by
 * the mesh size, so a small bulge is allowed before a mesh is deemed concave.
 */
export function isMeshConvex(mesh: Mesh, relTolerance = 1e-3): boolean {
  const tolerance = relTolerance * characteristicSize(mesh);
  const tris = triangleCount(mesh);
  const verts = vertexCount(mesh);
  const a: Vec3T = [0, 0, 0];
  const b: Vec3T = [0, 0, 0];
  const c: Vec3T = [0, 0, 0];
  const v: Vec3T = [0, 0, 0];
  const normal: Vec3T = [0, 0, 0];

  for (let t = 0; t < tris; t++) {
    getVertex(mesh, mesh.indices[t * 3]!, a);
    getVertex(mesh, mesh.indices[t * 3 + 1]!, b);
    getVertex(mesh, mesh.indices[t * 3 + 2]!, c);
    normal[0] = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    normal[1] = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    normal[2] = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(normal[0], normal[1], normal[2]);
    if (len < 1e-12) {
      continue; // Degenerate triangle.
    }
    normal[0] /= len;
    normal[1] /= len;
    normal[2] /= len;
    for (let i = 0; i < verts; i++) {
      getVertex(mesh, i, v);
      const d =
        normal[0] * (v[0] - a[0]) +
        normal[1] * (v[1] - a[1]) +
        normal[2] * (v[2] - a[2]);
      if (d > tolerance) {
        return false; // A vertex sits in front of this face: concave.
      }
    }
  }
  return true;
}

/** Options for {@link approximateConvexDecomposition}. */
export interface DecompositionOptions {
  /** Relative concavity tolerance before a piece is split further. Default 1e-3. */
  concavity?: number;
  /** Maximum recursion depth. Default 8. */
  maxDepth?: number;
  /** Maximum number of hull pieces to emit. Default 32. */
  maxHulls?: number;
  /** Stop splitting pieces at or below this triangle count. Default 4. */
  minTriangles?: number;
}

interface WorkItem {
  mesh: Mesh;
  depth: number;
}

/**
 * Find a cutting plane that separates the most prominent concavity: the face
 * whose plane a vertex sits farthest in front of. The plane uses that face's
 * normal, positioned midway between the face and the offending vertex so the cut
 * passes through the concave region. Returns `null` when the mesh is convex.
 */
function findCutPlane(mesh: Mesh, tolerance: number): ReturnType<typeof createPlane> | null {
  const tris = triangleCount(mesh);
  const verts = vertexCount(mesh);
  const a: Vec3T = [0, 0, 0];
  const b: Vec3T = [0, 0, 0];
  const c: Vec3T = [0, 0, 0];
  const v: Vec3T = [0, 0, 0];
  const normal: Vec3T = [0, 0, 0];

  let best = tolerance;
  let bestNormal: Vec3T | null = null;
  let bestFaceOffset = 0;
  let bestVertexOffset = 0;

  for (let t = 0; t < tris; t++) {
    getVertex(mesh, mesh.indices[t * 3]!, a);
    getVertex(mesh, mesh.indices[t * 3 + 1]!, b);
    getVertex(mesh, mesh.indices[t * 3 + 2]!, c);
    normal[0] = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    normal[1] = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    normal[2] = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(normal[0], normal[1], normal[2]);
    if (len < 1e-12) {
      continue;
    }
    const nx = normal[0] / len;
    const ny = normal[1] / len;
    const nz = normal[2] / len;
    const faceOffset = nx * a[0] + ny * a[1] + nz * a[2];
    for (let i = 0; i < verts; i++) {
      getVertex(mesh, i, v);
      const vertexOffset = nx * v[0] + ny * v[1] + nz * v[2];
      const d = vertexOffset - faceOffset;
      if (d > best) {
        best = d;
        bestNormal = [nx, ny, nz];
        bestFaceOffset = faceOffset;
        bestVertexOffset = vertexOffset;
      }
    }
  }

  if (!bestNormal) {
    return null;
  }
  // Midway between the face and the deepest offending vertex.
  const offset = 0.5 * (bestFaceOffset + bestVertexOffset);
  const point: Vec3T = [
    bestNormal[0] * offset,
    bestNormal[1] * offset,
    bestNormal[2] * offset,
  ];
  return fromNormalAndPoint(createPlane(), bestNormal, point);
}

/**
 * Approximate convex decomposition: split a (possibly concave) mesh into a small
 * set of convex hulls whose union approximates the shape. Convex meshes return a
 * single hull, so this is safe (and cheap) to call on any mesh.
 *
 * The algorithm recursively cuts the mesh by the plane of its most prominent
 * concavity until each piece is convex (within tolerance) or the depth/hull/size
 * limits are reached. It is a pragmatic heuristic, not an optimal decomposition.
 */
export function approximateConvexDecomposition(
  mesh: Mesh,
  options: DecompositionOptions = {},
): ConvexHull[] {
  const concavity = options.concavity ?? 1e-3;
  const maxDepth = options.maxDepth ?? 8;
  const maxHulls = options.maxHulls ?? 32;
  const minTriangles = options.minTriangles ?? 4;

  const result: ConvexHull[] = [];
  const stack: WorkItem[] = [{ mesh, depth: 0 }];

  while (stack.length > 0) {
    const item = stack.pop()!;
    const piece = item.mesh;

    const remaining = maxHulls - result.length - stack.length;
    if (
      remaining <= 1 ||
      item.depth >= maxDepth ||
      triangleCount(piece) <= minTriangles ||
      isMeshConvex(piece, concavity)
    ) {
      result.push(computeConvexHull(piece));
      continue;
    }

    const tolerance = concavity * characteristicSize(piece);
    const plane = findCutPlane(piece, tolerance);
    if (!plane) {
      result.push(computeConvexHull(piece));
      continue;
    }

    const { front, back } = splitMeshByPlane(piece, plane, { cap: true });
    if (
      !front ||
      !back ||
      triangleCount(front) === 0 ||
      triangleCount(back) === 0
    ) {
      // No useful split (plane missed the geometry cleanly): keep as one hull.
      result.push(computeConvexHull(piece));
      continue;
    }

    stack.push({ mesh: front, depth: item.depth + 1 });
    stack.push({ mesh: back, depth: item.depth + 1 });
  }

  return result;
}
