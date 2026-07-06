import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyVec3 } from '@vanilla-slice/math';
import { getVertex, vertexCount } from './mesh';
import type { Mesh } from './mesh';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
type Vec3T = ReturnType<typeof Vec3.create>;

/** A triangular face of a convex hull, wound CCW as seen from outside. */
export interface HullFace {
  /** Triangle vertex indices into {@link ConvexHull.vertices}. */
  indices: [number, number, number];
  /** Outward-pointing unit normal. */
  normal: Vec3T;
}

/**
 * A (convex) polygon face of a hull: coplanar triangles merged into a single
 * CCW vertex loop. Useful for contact-manifold clipping and flat-shaded render.
 */
export interface HullPolygon {
  /** Vertex indices into {@link ConvexHull.vertices}, ordered around the face. */
  indices: number[];
  /** Outward-pointing unit normal. */
  normal: Vec3T;
}

/**
 * A convex hull as plain data: unique vertex positions plus triangular faces
 * with outward normals. Kept dependency-free (only arrays/numbers) so other
 * packages can consume it structurally without importing `@vanilla-slice/geometry`
 * (mirrors the `Aabb`/spatial arrangement).
 */
export interface ConvexHull {
  /** Unique hull vertex positions, flat `[x, y, z, x, y, z, ...]`. */
  vertices: number[];
  /** Triangular faces with outward-pointing unit normals. */
  faces: HullFace[];
  /** Coplanar triangles merged into convex polygon faces (outward normals). */
  polygons: HullPolygon[];
}

/** Internal working face: indices into the source point array + outward normal. */
interface WorkFace {
  a: number;
  b: number;
  c: number;
  normal: Vec3T;
}

const DEFAULT_EPSILON = 1e-6;

/** Deduplicate mesh vertices onto an epsilon grid to stabilise the hull build. */
function extractPoints(mesh: Mesh, epsilon: number): Vec3T[] {
  const map = new Map<string, Vec3T>();
  const count = vertexCount(mesh);
  const inv = 1 / epsilon;
  const v: Vec3T = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    getVertex(mesh, i, v);
    const key = `${Math.round(v[0] * inv)}|${Math.round(v[1] * inv)}|${Math.round(
      v[2] * inv,
    )}`;
    if (!map.has(key)) {
      map.set(key, [v[0], v[1], v[2]]);
    }
  }
  return [...map.values()];
}

function squaredDistance(a: ReadonlyVec3, b: ReadonlyVec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/** Squared distance from point `p` to the line through `a` and `b`. */
function squaredDistanceToLine(
  p: ReadonlyVec3,
  a: ReadonlyVec3,
  b: ReadonlyVec3,
): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const apz = p[2] - a[2];
  const cx = apy * abz - apz * aby;
  const cy = apz * abx - apx * abz;
  const cz = apx * aby - apy * abx;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq === 0) {
    return apx * apx + apy * apy + apz * apz;
  }
  return (cx * cx + cy * cy + cz * cz) / abLenSq;
}

/** A hull with no faces (fewer than 4 points, or all collinear/coplanar). */
function degenerateHull(points: Vec3T[]): ConvexHull {
  const vertices: number[] = [];
  for (const p of points) {
    vertices.push(p[0], p[1], p[2]);
  }
  return { vertices, faces: [], polygons: [] };
}

/** Build an outward-oriented face `(a, b, c)` using an interior reference point. */
function makeFace(
  points: Vec3T[],
  a: number,
  b: number,
  c: number,
  interior: ReadonlyVec3,
): WorkFace {
  const pa = points[a]!;
  const pb = points[b]!;
  const pc = points[c]!;
  let nx = (pb[1] - pa[1]) * (pc[2] - pa[2]) - (pb[2] - pa[2]) * (pc[1] - pa[1]);
  let ny = (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]);
  let nz = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
  // Flip winding so the normal points away from the hull interior.
  const cx = (pa[0] + pb[0] + pc[0]) / 3 - interior[0];
  const cy = (pa[1] + pb[1] + pc[1]) / 3 - interior[1];
  const cz = (pa[2] + pb[2] + pc[2]) / 3 - interior[2];
  if (nx * cx + ny * cy + nz * cz < 0) {
    const t = b;
    b = c;
    c = t;
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return { a, b, c, normal: [nx / len, ny / len, nz / len] };
}

/** Signed distance of point `p` in front of `face` (positive = outside). */
function faceDistance(points: Vec3T[], face: WorkFace, p: ReadonlyVec3): number {
  const pa = points[face.a]!;
  return (
    face.normal[0] * (p[0] - pa[0]) +
    face.normal[1] * (p[1] - pa[1]) +
    face.normal[2] * (p[2] - pa[2])
  );
}

/** Compact used vertices and emit the final {@link ConvexHull}. */
function finalize(points: Vec3T[], faces: WorkFace[]): ConvexHull {
  const remap = new Map<number, number>();
  const vertices: number[] = [];
  const remapIndex = (i: number): number => {
    let mapped = remap.get(i);
    if (mapped === undefined) {
      mapped = vertices.length / 3;
      const p = points[i]!;
      vertices.push(p[0], p[1], p[2]);
      remap.set(i, mapped);
    }
    return mapped;
  };
  const hullFaces: HullFace[] = faces.map((f) => ({
    indices: [remapIndex(f.a), remapIndex(f.b), remapIndex(f.c)],
    normal: f.normal,
  }));
  return { vertices, faces: hullFaces, polygons: mergePolygons(vertices, hullFaces) };
}

/** Merge coplanar triangles into convex polygon faces (CCW around the normal). */
function mergePolygons(vertices: number[], faces: HullFace[]): HullPolygon[] {
  const groups = new Map<string, { normal: Vec3T; verts: Set<number> }>();
  const q = 1e4; // plane-key quantisation
  for (const face of faces) {
    const n = face.normal;
    const va = face.indices[0] * 3;
    const offset = n[0] * vertices[va]! + n[1] * vertices[va + 1]! + n[2] * vertices[va + 2]!;
    const key = `${Math.round(n[0] * q)}|${Math.round(n[1] * q)}|${Math.round(
      n[2] * q,
    )}|${Math.round(offset * q)}`;
    let group = groups.get(key);
    if (!group) {
      group = { normal: n, verts: new Set() };
      groups.set(key, group);
    }
    for (const idx of face.indices) {
      group.verts.add(idx);
    }
  }

  const polygons: HullPolygon[] = [];
  for (const { normal, verts } of groups.values()) {
    const indices = [...verts];
    if (indices.length < 3) {
      continue;
    }
    // Centroid of the face.
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const i of indices) {
      cx += vertices[i * 3]!;
      cy += vertices[i * 3 + 1]!;
      cz += vertices[i * 3 + 2]!;
    }
    cx /= indices.length;
    cy /= indices.length;
    cz /= indices.length;
    // In-plane basis (u, v) with v = normal × u.
    const first = indices[0]!;
    let ux = vertices[first * 3]! - cx;
    let uy = vertices[first * 3 + 1]! - cy;
    let uz = vertices[first * 3 + 2]! - cz;
    const ulen = Math.hypot(ux, uy, uz) || 1;
    ux /= ulen;
    uy /= ulen;
    uz /= ulen;
    const vx = normal[1] * uz - normal[2] * uy;
    const vy = normal[2] * ux - normal[0] * uz;
    const vz = normal[0] * uy - normal[1] * ux;
    // Sort vertices by angle around the centroid (CCW w.r.t. the normal).
    const angle = (i: number): number => {
      const dx = vertices[i * 3]! - cx;
      const dy = vertices[i * 3 + 1]! - cy;
      const dz = vertices[i * 3 + 2]! - cz;
      return Math.atan2(dx * vx + dy * vy + dz * vz, dx * ux + dy * uy + dz * uz);
    };
    indices.sort((a, b) => angle(a) - angle(b));
    polygons.push({ indices, normal });
  }
  return polygons;
}

/**
 * Compute the convex hull of a set of points using the incremental (Quickhull-
 * style) algorithm. Interior points are discarded; the result contains only the
 * hull vertices and outward-facing triangular faces.
 *
 * Degenerate inputs (fewer than four points, or all points collinear/coplanar)
 * yield a hull with the (deduplicated) points and no faces.
 */
export function convexHullFromPoints(
  points: readonly ReadonlyVec3[],
  epsilon = DEFAULT_EPSILON,
): ConvexHull {
  const pts: Vec3T[] = points.map((p) => [p[0], p[1], p[2]]);
  if (pts.length < 4) {
    return degenerateHull(pts);
  }

  // 1. Two extreme points: an axis extreme, then the farthest point from it.
  let i0 = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i]![0] < pts[i0]![0]) {
      i0 = i;
    }
  }
  let i1 = -1;
  let best = epsilon * epsilon;
  for (let i = 0; i < pts.length; i++) {
    if (i === i0) {
      continue;
    }
    const d = squaredDistance(pts[i]!, pts[i0]!);
    if (d > best) {
      best = d;
      i1 = i;
    }
  }
  if (i1 < 0) {
    return degenerateHull(pts);
  }

  // 2. Farthest point from the line i0-i1.
  let i2 = -1;
  best = epsilon * epsilon;
  for (let i = 0; i < pts.length; i++) {
    if (i === i0 || i === i1) {
      continue;
    }
    const d = squaredDistanceToLine(pts[i]!, pts[i0]!, pts[i1]!);
    if (d > best) {
      best = d;
      i2 = i;
    }
  }
  if (i2 < 0) {
    return degenerateHull(pts);
  }

  // 3. Farthest point from the plane through i0, i1, i2.
  const tmp = makeFace(pts, i0, i1, i2, pts[i0]!);
  let i3 = -1;
  best = epsilon;
  for (let i = 0; i < pts.length; i++) {
    if (i === i0 || i === i1 || i === i2) {
      continue;
    }
    const d = Math.abs(faceDistance(pts, tmp, pts[i]!));
    if (d > best) {
      best = d;
      i3 = i;
    }
  }
  if (i3 < 0) {
    return degenerateHull(pts);
  }

  // 4. Seed a tetrahedron with outward-facing normals.
  const interior: Vec3T = [
    (pts[i0]![0] + pts[i1]![0] + pts[i2]![0] + pts[i3]![0]) / 4,
    (pts[i0]![1] + pts[i1]![1] + pts[i2]![1] + pts[i3]![1]) / 4,
    (pts[i0]![2] + pts[i1]![2] + pts[i2]![2] + pts[i3]![2]) / 4,
  ];
  let faces: WorkFace[] = [
    makeFace(pts, i0, i1, i2, interior),
    makeFace(pts, i0, i1, i3, interior),
    makeFace(pts, i0, i2, i3, interior),
    makeFace(pts, i1, i2, i3, interior),
  ];

  const inSimplex = new Set([i0, i1, i2, i3]);

  // 5. Incrementally add each remaining point outside the current hull.
  for (let p = 0; p < pts.length; p++) {
    if (inSimplex.has(p)) {
      continue;
    }
    const point = pts[p]!;
    const visible: WorkFace[] = [];
    const kept: WorkFace[] = [];
    for (const face of faces) {
      if (faceDistance(pts, face, point) > epsilon) {
        visible.push(face);
      } else {
        kept.push(face);
      }
    }
    if (visible.length === 0) {
      continue; // Inside the hull.
    }

    // Horizon = directed edges of visible faces whose reverse is not shared.
    const edges = new Map<string, [number, number]>();
    for (const face of visible) {
      const tri: Array<[number, number]> = [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ];
      for (const [a, b] of tri) {
        const reverse = `${b}|${a}`;
        if (edges.has(reverse)) {
          edges.delete(reverse);
        } else {
          edges.set(`${a}|${b}`, [a, b]);
        }
      }
    }

    faces = kept;
    for (const [a, b] of edges.values()) {
      faces.push(makeFace(pts, a, b, p, interior));
    }
  }

  return finalize(pts, faces);
}

/**
 * Compute the convex hull of a mesh's vertices. See {@link convexHullFromPoints}.
 * The mesh's triangle `indices` are ignored; only vertex positions matter.
 */
export function computeConvexHull(mesh: Mesh, epsilon = DEFAULT_EPSILON): ConvexHull {
  return convexHullFromPoints(extractPoints(mesh, epsilon), epsilon);
}

/**
 * Build a {@link ConvexHull} directly from a mesh that is **already convex** and
 * closed (e.g. a slice or fracture fragment), skipping the Quickhull search: the
 * mesh's surface triangles are taken as the hull faces (re-oriented outward using
 * the centroid as an interior reference) and coplanar ones merged into polygons.
 *
 * Much cheaper than {@link computeConvexHull} when convexity is guaranteed — no
 * incremental visibility search — so it is the fast path for runtime-generated
 * fragments. **Do not** use it on concave meshes: the result would not be a
 * valid convex hull.
 */
export function hullFromConvexMesh(mesh: Mesh, epsilon = DEFAULT_EPSILON): ConvexHull {
  const inv = 1 / epsilon;
  const { positions, indices } = mesh;
  const points: Vec3T[] = [];
  const lookup = new Map<string, number>();
  const idxOf = (vertexIndex: number): number => {
    const base = vertexIndex * 3;
    const x = positions[base] ?? 0;
    const y = positions[base + 1] ?? 0;
    const z = positions[base + 2] ?? 0;
    const key = `${Math.round(x * inv)}|${Math.round(y * inv)}|${Math.round(z * inv)}`;
    let i = lookup.get(key);
    if (i === undefined) {
      i = points.length;
      points.push([x, y, z]);
      lookup.set(key, i);
    }
    return i;
  };

  const tris: Array<[number, number, number]> = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = idxOf(indices[t] ?? 0);
    const b = idxOf(indices[t + 1] ?? 0);
    const c = idxOf(indices[t + 2] ?? 0);
    if (a !== b && b !== c && a !== c) {
      tris.push([a, b, c]);
    }
  }
  if (points.length < 4) {
    return degenerateHull(points);
  }

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of points) {
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  const interior: Vec3T = [cx / points.length, cy / points.length, cz / points.length];

  const seen = new Set<string>();
  const faces: WorkFace[] = [];
  for (const [a, b, c] of tris) {
    const sorted = [a, b, c].sort((x, y) => x - y);
    const key = `${sorted[0]}|${sorted[1]}|${sorted[2]}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    faces.push(makeFace(points, a, b, c, interior));
  }
  return finalize(points, faces);
}

/** Translate every hull vertex in place by `offset`. Returns the same hull. */
export function translateHull(hull: ConvexHull, offset: ReadonlyVec3): ConvexHull {
  const { vertices } = hull;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] = vertices[i]! + offset[0];
    vertices[i + 1] = vertices[i + 1]! + offset[1];
    vertices[i + 2] = vertices[i + 2]! + offset[2];
  }
  return hull;
}
