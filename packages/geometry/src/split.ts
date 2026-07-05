import { Vec3, EPSILON } from '@vanilla-slice/math';
import { createMesh, getVertex } from './mesh';
import type { Mesh } from './mesh';
import { signedDistanceToPoint } from './plane';
import type { Plane } from './plane';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
type Vec3T = ReturnType<typeof Vec3.create>;

/** Options controlling a mesh split. */
export interface SplitOptions {
  /** Fill the cut cross-section with cap triangles so pieces stay closed. */
  cap?: boolean;
  /** On-plane tolerance band. */
  epsilon?: number;
}

/** Result of splitting a mesh by a plane. */
export interface SplitResult {
  /** Piece on the side the plane normal points toward, or `null` if empty. */
  front: Mesh | null;
  /** Piece on the opposite side, or `null` if empty. */
  back: Mesh | null;
}

/** Incrementally accumulates triangles into flat position/index arrays. */
class MeshBuilder {
  readonly positions: number[] = [];
  readonly indices: number[] = [];

  addTriangle(a: Vec3T, b: Vec3T, c: Vec3T): void {
    const base = this.positions.length / 3;
    this.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.indices.push(base, base + 1, base + 2);
  }

  /** Fan-triangulate a convex polygon (>= 3 vertices). */
  addFan(polygon: Vec3T[]): void {
    for (let i = 1; i < polygon.length - 1; i++) {
      this.addTriangle(polygon[0]!, polygon[i]!, polygon[i + 1]!);
    }
  }

  get isEmpty(): boolean {
    return this.indices.length === 0;
  }

  build(): Mesh {
    return createMesh(this.positions, this.indices);
  }
}

/**
 * Split `mesh` by `plane` into front/back pieces. Triangles straddling the plane
 * are clipped; the exposed cross-section is capped by default so each piece is a
 * closed solid.
 *
 * Cap generation assumes a single convex cross-section (sufficient for convex
 * primitives such as the slicing demo's fruit). Non-convex cross-sections may
 * cap imperfectly.
 */
export function splitMeshByPlane(
  mesh: Mesh,
  plane: Plane,
  options: SplitOptions = {},
): SplitResult {
  const cap = options.cap ?? true;
  const epsilon = options.epsilon ?? EPSILON;

  const front = new MeshBuilder();
  const back = new MeshBuilder();
  const cutPoints: Vec3T[] = [];

  const { indices } = mesh;
  for (let t = 0; t < indices.length; t += 3) {
    const v0: Vec3T = [0, 0, 0];
    const v1: Vec3T = [0, 0, 0];
    const v2: Vec3T = [0, 0, 0];
    getVertex(mesh, indices[t] ?? 0, v0);
    getVertex(mesh, indices[t + 1] ?? 0, v1);
    getVertex(mesh, indices[t + 2] ?? 0, v2);

    let d0 = signedDistanceToPoint(plane, v0);
    let d1 = signedDistanceToPoint(plane, v1);
    let d2 = signedDistanceToPoint(plane, v2);
    if (d0 > -epsilon && d0 < epsilon) d0 = 0;
    if (d1 > -epsilon && d1 < epsilon) d1 = 0;
    if (d2 > -epsilon && d2 < epsilon) d2 = 0;

    const hasFront = d0 > 0 || d1 > 0 || d2 > 0;
    const hasBack = d0 < 0 || d1 < 0 || d2 < 0;

    if (hasFront && !hasBack) {
      front.addTriangle(v0, v1, v2);
      continue;
    }
    if (hasBack && !hasFront) {
      back.addTriangle(v0, v1, v2);
      continue;
    }
    if (!hasFront && !hasBack) {
      // Triangle lies entirely on the plane; keep it on the front arbitrarily.
      front.addTriangle(v0, v1, v2);
      continue;
    }

    clipStraddlingTriangle(
      [v0, v1, v2],
      [d0, d1, d2],
      front,
      back,
      cutPoints,
    );
  }

  if (cap && cutPoints.length >= 3) {
    buildCap(cutPoints, plane, front, back, epsilon);
  }

  return {
    front: front.isEmpty ? null : front.build(),
    back: back.isEmpty ? null : back.build(),
  };
}

/** Clip a straddling triangle into front/back polygons and record cut points. */
function clipStraddlingTriangle(
  verts: [Vec3T, Vec3T, Vec3T],
  dists: [number, number, number],
  front: MeshBuilder,
  back: MeshBuilder,
  cutPoints: Vec3T[],
): void {
  const frontPoly: Vec3T[] = [];
  const backPoly: Vec3T[] = [];

  for (let i = 0; i < 3; i++) {
    const cur = verts[i]!;
    const cd = dists[i]!;
    const j = (i + 1) % 3;
    const nxt = verts[j]!;
    const nd = dists[j]!;

    if (cd >= 0) frontPoly.push(cur);
    if (cd <= 0) backPoly.push(cur);
    if (cd === 0) cutPoints.push([cur[0], cur[1], cur[2]]);

    const crosses = (cd > 0 && nd < 0) || (cd < 0 && nd > 0);
    if (crosses) {
      const s = cd / (cd - nd);
      const ip: Vec3T = [0, 0, 0];
      Vec3.lerp(ip, cur, nxt, s);
      frontPoly.push(ip);
      backPoly.push([ip[0], ip[1], ip[2]]);
      cutPoints.push([ip[0], ip[1], ip[2]]);
    }
  }

  if (frontPoly.length >= 3) front.addFan(frontPoly);
  if (backPoly.length >= 3) back.addFan(backPoly);
}

/**
 * Triangulate the cut cross-section as a fan around its centroid, ordered by
 * angle within the plane. The front cap faces `-normal`; the back cap faces
 * `+normal`.
 */
function buildCap(
  cutPoints: Vec3T[],
  plane: Plane,
  front: MeshBuilder,
  back: MeshBuilder,
  epsilon: number,
): void {
  const points = dedupePoints(cutPoints, epsilon);
  if (points.length < 3) return;

  // Centroid of the boundary points.
  const centroid: Vec3T = [0, 0, 0];
  for (const p of points) {
    centroid[0] += p[0];
    centroid[1] += p[1];
    centroid[2] += p[2];
  }
  centroid[0] /= points.length;
  centroid[1] /= points.length;
  centroid[2] /= points.length;

  // Orthonormal basis (u, v) on the plane with cross(u, v) === normal.
  const n = plane.normal;
  const helper: Vec3T =
    Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u: Vec3T = [0, 0, 0];
  const v: Vec3T = [0, 0, 0];
  Vec3.cross(u, helper, n);
  Vec3.normalize(u, u);
  Vec3.cross(v, n, u);

  // Sort boundary points counter-clockwise (viewed from +normal).
  const rel: Vec3T = [0, 0, 0];
  const withAngle = points.map((p) => {
    Vec3.subtract(rel, p, centroid);
    return { p, angle: Math.atan2(Vec3.dot(rel, v), Vec3.dot(rel, u)) };
  });
  withAngle.sort((a, b) => a.angle - b.angle);
  const ordered = withAngle.map((entry) => entry.p);

  for (let i = 0; i < ordered.length; i++) {
    const p1 = ordered[i]!;
    const p2 = ordered[(i + 1) % ordered.length]!;
    // Back piece cap faces +normal; front piece cap faces -normal (reversed).
    back.addTriangle(centroid, p1, p2);
    front.addTriangle(centroid, p2, p1);
  }
}

/** Remove points that coincide within `epsilon`. */
function dedupePoints(points: Vec3T[], epsilon: number): Vec3T[] {
  const kept: Vec3T[] = [];
  const epsSq = epsilon * epsilon;
  for (const p of points) {
    let duplicate = false;
    for (const k of kept) {
      if (Vec3.squaredDistance(p, k) <= epsSq) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) kept.push(p);
  }
  return kept;
}
