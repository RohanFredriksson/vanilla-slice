import { Vec2, Vec3, EPSILON } from '@vanilla-slice/math';
import type { ReadonlyMat4 } from '@vanilla-slice/math';
import { createMesh, getVertex, getUv, getTex3 } from './mesh';
import type { Mesh } from './mesh';
import { signedDistanceToPoint } from './plane';
import type { Plane } from './plane';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
type Vec3T = ReturnType<typeof Vec3.create>;
/** Mutable 2-component vector (matches `@vanilla-slice/math`'s `Vec2`). */
type Vec2T = ReturnType<typeof Vec2.create>;

/** Default material slot for newly-exposed interior (cap) faces (ADR 0010). */
const INTERIOR_GROUP = 1;

/**
 * A vertex flowing through the split, carrying optional attributes alongside its
 * position. `uv`/`tex3` are present only when the source mesh supplies them.
 */
interface Vtx {
  p: Vec3T;
  uv?: Vec2T;
  tex3?: Vec3T;
}

/** Options controlling a mesh split. */
export interface SplitOptions {
  /** Fill the cut cross-section with cap triangles so pieces stay closed. */
  cap?: boolean;
  /** On-plane tolerance band. */
  epsilon?: number;
  /** Material slot assigned to cap (interior) faces. Defaults to 1. */
  capGroup?: number;
  /** Texel scale for the cap's planar fallback UVs. Defaults to 1. */
  capUvScale?: number;
  /**
   * Maps a world-space cap point into the source model's rest-pose (`tex3`)
   * space — typically the body's inverse model matrix. When omitted, cap `tex3`
   * falls back to the world position. Only consulted when the source mesh
   * carries `tex3` (ADR 0010).
   */
  capToMaterialSpace?: ReadonlyMat4;
}

/** Result of splitting a mesh by a plane. */
export interface SplitResult {
  /** Piece on the side the plane normal points toward, or `null` if empty. */
  front: Mesh | null;
  /** Piece on the opposite side, or `null` if empty. */
  back: Mesh | null;
}

/** Incrementally accumulates triangles into flat position/index/attribute arrays. */
class MeshBuilder {
  readonly positions: number[] = [];
  readonly indices: number[] = [];
  readonly groups: number[] = [];
  readonly uvs?: number[];
  readonly tex3?: number[];
  private nonZeroGroup = false;

  constructor(
    emitUv: boolean,
    emitTex3: boolean,
    private readonly sourceHadGroups: boolean,
  ) {
    if (emitUv) this.uvs = [];
    if (emitTex3) this.tex3 = [];
  }

  addTriangle(a: Vtx, b: Vtx, c: Vtx, group: number): void {
    const base = this.positions.length / 3;
    this.pushVertex(a);
    this.pushVertex(b);
    this.pushVertex(c);
    this.indices.push(base, base + 1, base + 2);
    this.groups.push(group);
    if (group !== 0) this.nonZeroGroup = true;
  }

  /** Fan-triangulate a convex polygon (>= 3 vertices). */
  addFan(polygon: Vtx[], group: number): void {
    for (let i = 1; i < polygon.length - 1; i++) {
      this.addTriangle(polygon[0]!, polygon[i]!, polygon[i + 1]!, group);
    }
  }

  private pushVertex(v: Vtx): void {
    this.positions.push(v.p[0], v.p[1], v.p[2]);
    if (this.uvs) {
      this.uvs.push(v.uv?.[0] ?? 0, v.uv?.[1] ?? 0);
    }
    if (this.tex3) {
      const t = v.tex3 ?? v.p;
      this.tex3.push(t[0], t[1], t[2]);
    }
  }

  get isEmpty(): boolean {
    return this.indices.length === 0;
  }

  build(): Mesh {
    // Emit groups when the source had them or the cut introduced an interior
    // slot; otherwise keep the mesh positions-only for a neutral, minimal shape.
    const emitGroups = this.sourceHadGroups || this.nonZeroGroup;
    return createMesh(this.positions, this.indices, {
      uvs: this.uvs,
      tex3: this.tex3,
      groups: emitGroups ? this.groups : undefined,
    });
  }
}

/** Read source vertex `index` into a {@link Vtx}, pulling attributes when enabled. */
function readVtx(
  mesh: Mesh,
  index: number,
  emitUv: boolean,
  emitTex3: boolean,
): Vtx {
  const p: Vec3T = [0, 0, 0];
  getVertex(mesh, index, p);
  const vtx: Vtx = { p };
  if (emitUv) {
    const uv: Vec2T = [0, 0];
    getUv(mesh, index, uv);
    vtx.uv = uv;
  }
  if (emitTex3) {
    const t: Vec3T = [0, 0, 0];
    getTex3(mesh, index, t);
    vtx.tex3 = t;
  }
  return vtx;
}

/** Linearly interpolate two vertices (position + present attributes) at `s`. */
function interpolate(cur: Vtx, nxt: Vtx, s: number): Vtx {
  const p: Vec3T = [0, 0, 0];
  Vec3.lerp(p, cur.p, nxt.p, s);
  const vtx: Vtx = { p };
  if (cur.uv && nxt.uv) {
    vtx.uv = [
      cur.uv[0] + (nxt.uv[0] - cur.uv[0]) * s,
      cur.uv[1] + (nxt.uv[1] - cur.uv[1]) * s,
    ];
  }
  if (cur.tex3 && nxt.tex3) {
    const t: Vec3T = [0, 0, 0];
    Vec3.lerp(t, cur.tex3, nxt.tex3, s);
    vtx.tex3 = t;
  }
  return vtx;
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
  const capGroup = options.capGroup ?? INTERIOR_GROUP;
  const emitUv = mesh.uvs !== undefined;
  const emitTex3 = mesh.tex3 !== undefined;
  const sourceHadGroups = mesh.groups !== undefined;

  const front = new MeshBuilder(emitUv, emitTex3, sourceHadGroups);
  const back = new MeshBuilder(emitUv, emitTex3, sourceHadGroups);
  const cutPoints: Vec3T[] = [];

  const { indices } = mesh;
  for (let t = 0; t < indices.length; t += 3) {
    const v0 = readVtx(mesh, indices[t] ?? 0, emitUv, emitTex3);
    const v1 = readVtx(mesh, indices[t + 1] ?? 0, emitUv, emitTex3);
    const v2 = readVtx(mesh, indices[t + 2] ?? 0, emitUv, emitTex3);
    const group = mesh.groups?.[t / 3] ?? 0;

    let d0 = signedDistanceToPoint(plane, v0.p);
    let d1 = signedDistanceToPoint(plane, v1.p);
    let d2 = signedDistanceToPoint(plane, v2.p);
    if (d0 > -epsilon && d0 < epsilon) d0 = 0;
    if (d1 > -epsilon && d1 < epsilon) d1 = 0;
    if (d2 > -epsilon && d2 < epsilon) d2 = 0;

    const hasFront = d0 > 0 || d1 > 0 || d2 > 0;
    const hasBack = d0 < 0 || d1 < 0 || d2 < 0;

    if (hasFront && !hasBack) {
      front.addTriangle(v0, v1, v2, group);
      continue;
    }
    if (hasBack && !hasFront) {
      back.addTriangle(v0, v1, v2, group);
      continue;
    }
    if (!hasFront && !hasBack) {
      // Triangle lies entirely on the plane; keep it on the front arbitrarily.
      front.addTriangle(v0, v1, v2, group);
      continue;
    }

    clipStraddlingTriangle(
      [v0, v1, v2],
      [d0, d1, d2],
      group,
      front,
      back,
      cutPoints,
    );
  }

  if (cap && cutPoints.length >= 3) {
    buildCap(cutPoints, plane, front, back, epsilon, capGroup, options);
  }

  return {
    front: front.isEmpty ? null : front.build(),
    back: back.isEmpty ? null : back.build(),
  };
}

/** Clip a straddling triangle into front/back polygons and record cut points. */
function clipStraddlingTriangle(
  verts: [Vtx, Vtx, Vtx],
  dists: [number, number, number],
  group: number,
  front: MeshBuilder,
  back: MeshBuilder,
  cutPoints: Vec3T[],
): void {
  const frontPoly: Vtx[] = [];
  const backPoly: Vtx[] = [];

  for (let i = 0; i < 3; i++) {
    const cur = verts[i]!;
    const cd = dists[i]!;
    const j = (i + 1) % 3;
    const nxt = verts[j]!;
    const nd = dists[j]!;

    if (cd >= 0) frontPoly.push(cur);
    if (cd <= 0) backPoly.push(cur);
    if (cd === 0) cutPoints.push([cur.p[0], cur.p[1], cur.p[2]]);

    const crosses = (cd > 0 && nd < 0) || (cd < 0 && nd > 0);
    if (crosses) {
      const s = cd / (cd - nd);
      const ip = interpolate(cur, nxt, s);
      frontPoly.push(ip);
      backPoly.push(ip);
      cutPoints.push([ip.p[0], ip.p[1], ip.p[2]]);
    }
  }

  if (frontPoly.length >= 3) front.addFan(frontPoly, group);
  if (backPoly.length >= 3) back.addFan(backPoly, group);
}

/**
 * Triangulate the cut cross-section as a fan around its centroid, ordered by
 * angle within the plane. The front cap faces `-normal`; the back cap faces
 * `+normal`. Cap vertices receive interior attributes (ADR 0010): planar UVs
 * projected onto the plane basis, and a rest-pose `tex3` obtained by mapping the
 * world cap point through `capToMaterialSpace` (identity/world when omitted).
 */
function buildCap(
  cutPoints: Vec3T[],
  plane: Plane,
  front: MeshBuilder,
  back: MeshBuilder,
  epsilon: number,
  capGroup: number,
  options: SplitOptions,
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
  const bu: Vec3T = [0, 0, 0];
  const bv: Vec3T = [0, 0, 0];
  Vec3.cross(bu, helper, n);
  Vec3.normalize(bu, bu);
  Vec3.cross(bv, n, bu);

  // Sort boundary points counter-clockwise (viewed from +normal).
  const rel: Vec3T = [0, 0, 0];
  const withAngle = points.map((p) => {
    Vec3.subtract(rel, p, centroid);
    return { p, angle: Math.atan2(Vec3.dot(rel, bv), Vec3.dot(rel, bu)) };
  });
  withAngle.sort((a, b) => a.angle - b.angle);
  const ordered = withAngle.map((entry) => entry.p);

  const uvScale = options.capUvScale ?? 1;
  const toMaterial = options.capToMaterialSpace;

  // Build an attributed cap vertex: planar UV about the centroid, and a
  // rest-pose tex3 (world point mapped to material space, or the world point).
  const capVertex = (p: Vec3T): Vtx => {
    Vec3.subtract(rel, p, centroid);
    const uv: Vec2T = [
      Vec3.dot(rel, bu) * uvScale + 0.5,
      Vec3.dot(rel, bv) * uvScale + 0.5,
    ];
    const tex3: Vec3T = [p[0], p[1], p[2]];
    if (toMaterial) {
      Vec3.transformMat4(tex3, tex3, toMaterial);
    }
    return { p: [p[0], p[1], p[2]], uv, tex3 };
  };

  const centroidVtx = capVertex(centroid);
  const orderedVtx = ordered.map(capVertex);

  for (let i = 0; i < orderedVtx.length; i++) {
    const p1 = orderedVtx[i]!;
    const p2 = orderedVtx[(i + 1) % orderedVtx.length]!;
    // Back piece cap faces +normal; front piece cap faces -normal (reversed).
    back.addTriangle(centroidVtx, p1, p2, capGroup);
    front.addTriangle(centroidVtx, p2, p1, capGroup);
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
