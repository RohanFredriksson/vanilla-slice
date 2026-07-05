import { Vec3, Quat } from '@vanilla-slice/math';
import type { ReadonlyVec3, ReadonlyQuat } from '@vanilla-slice/math';
import type { Contact } from './collision';

type Vec3T = ReturnType<typeof Vec3.create>;
type QuatT = ReturnType<typeof Quat.create>;

/**
 * A convex collider as plain data: local-space vertex positions in a flat
 * `[x, y, z, ...]` array. Structurally compatible with
 * `@vanilla-slice/geometry`'s `ConvexHull`, so a hull can be passed directly
 * without importing geometry (physics depends only on math).
 */
export interface ConvexShape {
  vertices: number[];
  /**
   * Optional convex polygon faces (CCW loops with outward normals). When
   * present, contact-manifold generation clips faces for stable multi-point
   * resting contact; structurally compatible with `ConvexHull.polygons`.
   */
  polygons?: Array<{ indices: number[]; normal: readonly number[] }>;
}

/** A single point of a contact manifold. */
export interface ManifoldPoint {
  /** World-space contact position. */
  point: Vec3T;
  /** Penetration depth along the manifold normal (>= 0). */
  penetration: number;
}

/**
 * A contact manifold between two convex shapes: a shared normal (from `a` toward
 * `b`) and up to a few contact points for stable resting contact.
 */
export interface ContactManifold {
  normal: Vec3T;
  points: ManifoldPoint[];
}

const GJK_MAX_ITERATIONS = 32;
const EPA_MAX_ITERATIONS = 64;
const EPA_TOLERANCE = 1e-6;

// --- small vector helpers (allocate; correctness over micro-optimisation) ----

function sub(a: ReadonlyVec3, b: ReadonlyVec3): Vec3T {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function neg(a: ReadonlyVec3): Vec3T {
  return [-a[0], -a[1], -a[2]];
}
function dot(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: ReadonlyVec3, b: ReadonlyVec3): Vec3T {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function setDir(dir: Vec3T, value: ReadonlyVec3): void {
  dir[0] = value[0];
  dir[1] = value[1];
  dir[2] = value[2];
}

function isNearZero(v: ReadonlyVec3): boolean {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2] < 1e-12;
}

/** Any vector perpendicular to `v` (stable for near-axis-aligned inputs). */
function perpendicular(v: ReadonlyVec3): Vec3T {
  const ax = Math.abs(v[0]);
  const ay = Math.abs(v[1]);
  const az = Math.abs(v[2]);
  const axis: Vec3T = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
  return cross(v, axis);
}

const _localDir: Vec3T = [0, 0, 0];
const _invRot: QuatT = [0, 0, 0, 1];
const _worldVertex: Vec3T = [0, 0, 0];

/**
 * World-space support: the vertex of `shape` (placed at `position`/`orientation`)
 * farthest along world-space `direction`. Writes into and returns `out`.
 */
export function convexSupport(
  shape: ConvexShape,
  position: ReadonlyVec3,
  orientation: ReadonlyQuat,
  direction: ReadonlyVec3,
  out: Vec3T = [0, 0, 0],
): Vec3T {
  // Rotate the search direction into the shape's local frame.
  Quat.conjugate(_invRot, orientation);
  Vec3.transformQuat(_localDir, direction, _invRot);

  const { vertices } = shape;
  let bestIndex = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const d =
      vertices[i]! * _localDir[0] +
      vertices[i + 1]! * _localDir[1] +
      vertices[i + 2]! * _localDir[2];
    if (d > bestDot) {
      bestDot = d;
      bestIndex = i;
    }
  }

  _worldVertex[0] = vertices[bestIndex]!;
  _worldVertex[1] = vertices[bestIndex + 1]!;
  _worldVertex[2] = vertices[bestIndex + 2]!;
  Vec3.transformQuat(out, _worldVertex, orientation);
  out[0] += position[0];
  out[1] += position[1];
  out[2] += position[2];
  return out;
}

interface Placement {
  shape: ConvexShape;
  position: ReadonlyVec3;
  orientation: ReadonlyQuat;
}

/** Support of the Minkowski difference `A ⊖ B` along `direction`. */
function minkowskiSupport(a: Placement, b: Placement, direction: ReadonlyVec3): Vec3T {
  const sa = convexSupport(a.shape, a.position, a.orientation, direction);
  const negDir: Vec3T = [-direction[0], -direction[1], -direction[2]];
  const sb = convexSupport(b.shape, b.position, b.orientation, negDir);
  return [sa[0] - sb[0], sa[1] - sb[1], sa[2] - sb[2]];
}

// --- GJK ---------------------------------------------------------------------

function handleLine(simplex: Vec3T[], dir: Vec3T): boolean {
  const a = simplex[0]!;
  const b = simplex[1]!;
  const ab = sub(b, a);
  const ao = neg(a);
  if (dot(ab, ao) > 0) {
    const perp = cross(cross(ab, ao), ab);
    // Origin lies on the line ab: search perpendicular to keep building volume.
    setDir(dir, isNearZero(perp) ? perpendicular(ab) : perp);
  } else {
    simplex.length = 1;
    setDir(dir, ao);
  }
  return false;
}

function handleTriangle(simplex: Vec3T[], dir: Vec3T): boolean {
  const a = simplex[0]!;
  const b = simplex[1]!;
  const c = simplex[2]!;
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ao = neg(a);
  const abc = cross(ab, ac);

  if (isNearZero(abc)) {
    // Collinear (degenerate) triangle: fall back to the line case on [a, b].
    simplex.length = 0;
    simplex.push(a, b);
    return handleLine(simplex, dir);
  }

  if (dot(cross(abc, ac), ao) > 0) {
    if (dot(ac, ao) > 0) {
      simplex.length = 0;
      simplex.push(a, c);
      setDir(dir, cross(cross(ac, ao), ac));
      return false;
    }
    simplex.length = 0;
    simplex.push(a, b);
    return handleLine(simplex, dir);
  }

  if (dot(cross(ab, abc), ao) > 0) {
    simplex.length = 0;
    simplex.push(a, b);
    return handleLine(simplex, dir);
  }

  if (dot(abc, ao) > 0) {
    setDir(dir, abc);
  } else {
    simplex.length = 0;
    simplex.push(a, c, b);
    setDir(dir, neg(abc));
  }
  return false;
}

function handleTetrahedron(simplex: Vec3T[], dir: Vec3T): boolean {
  const a = simplex[0]!;
  const b = simplex[1]!;
  const c = simplex[2]!;
  const d = simplex[3]!;
  const ao = neg(a);
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ad = sub(d, a);

  let abc = cross(ab, ac);
  if (dot(abc, ad) > 0) abc = neg(abc);
  let acd = cross(ac, ad);
  if (dot(acd, ab) > 0) acd = neg(acd);
  let adb = cross(ad, ab);
  if (dot(adb, ac) > 0) adb = neg(adb);

  if (dot(abc, ao) > 0) {
    simplex.length = 0;
    simplex.push(a, b, c);
    return handleTriangle(simplex, dir);
  }
  if (dot(acd, ao) > 0) {
    simplex.length = 0;
    simplex.push(a, c, d);
    return handleTriangle(simplex, dir);
  }
  if (dot(adb, ao) > 0) {
    simplex.length = 0;
    simplex.push(a, d, b);
    return handleTriangle(simplex, dir);
  }
  return true; // Origin enclosed by the tetrahedron.
}

function handleSimplex(simplex: Vec3T[], dir: Vec3T): boolean {
  if (simplex.length === 2) return handleLine(simplex, dir);
  if (simplex.length === 3) return handleTriangle(simplex, dir);
  return handleTetrahedron(simplex, dir);
}

/**
 * GJK boolean intersection test. Returns whether the shapes overlap and, when
 * they do, the terminating 4-point simplex (a tetrahedron enclosing the origin)
 * for EPA to expand.
 */
function gjkIntersect(a: Placement, b: Placement): { hit: boolean; simplex: Vec3T[] } {
  const dir: Vec3T = sub(b.position, a.position);
  if (dir[0] === 0 && dir[1] === 0 && dir[2] === 0) {
    dir[0] = 1;
  }
  const simplex: Vec3T[] = [minkowskiSupport(a, b, dir)];
  setDir(dir, neg(simplex[0]!));

  for (let i = 0; i < GJK_MAX_ITERATIONS; i++) {
    if (isNearZero(dir)) {
      // Degenerate search direction: nudge to keep exploring.
      dir[0] = 1;
      dir[1] = 0;
      dir[2] = 0;
    }
    const point = minkowskiSupport(a, b, dir);
    if (dot(point, dir) < 0) {
      return { hit: false, simplex };
    }
    simplex.unshift(point);
    if (handleSimplex(simplex, dir)) {
      return { hit: true, simplex };
    }
  }
  return { hit: false, simplex };
}

// --- EPA ---------------------------------------------------------------------

interface EpaFace {
  a: number;
  b: number;
  c: number;
  normal: Vec3T;
  distance: number;
}

/** Build an EPA face with an outward normal (pointing away from the origin). */
function epaFace(verts: Vec3T[], a: number, b: number, c: number): EpaFace {
  const va = verts[a]!;
  const vb = verts[b]!;
  const vc = verts[c]!;
  let normal = cross(sub(vb, va), sub(vc, va));
  const len = Math.hypot(normal[0], normal[1], normal[2]);
  if (len < 1e-12) {
    // Degenerate (zero-area) face: never selectable as closest.
    return { a, b, c, normal: [0, 0, 0], distance: Infinity };
  }
  normal = [normal[0] / len, normal[1] / len, normal[2] / len];
  let distance = dot(normal, va);
  if (distance < 0) {
    normal = neg(normal);
    distance = -distance;
    const t = b;
    b = c;
    c = t;
  }
  return { a, b, c, normal, distance };
}

/**
 * Expanding Polytope Algorithm: given a GJK tetrahedron enclosing the origin,
 * find the penetration normal and depth. The returned normal points from `a`
 * toward `b`, matching {@link Contact}'s convention.
 */
function epa(a: Placement, b: Placement, simplex: Vec3T[]): Contact {
  const verts: Vec3T[] = simplex.map((p) => [p[0], p[1], p[2]]);
  let faces: EpaFace[] = [
    epaFace(verts, 0, 1, 2),
    epaFace(verts, 0, 2, 3),
    epaFace(verts, 0, 3, 1),
    epaFace(verts, 1, 3, 2),
  ];

  let closest = faces[0]!;
  for (let iter = 0; iter < EPA_MAX_ITERATIONS; iter++) {
    closest = faces[0]!;
    for (const face of faces) {
      if (face.distance < closest.distance) {
        closest = face;
      }
    }

    const point = minkowskiSupport(a, b, closest.normal);
    const reach = dot(point, closest.normal);
    if (reach - closest.distance < EPA_TOLERANCE) {
      break;
    }

    const pi = verts.length;
    verts.push(point);

    // Remove faces the new point can "see" and re-triangulate the horizon.
    const edges = new Map<string, [number, number]>();
    const kept: EpaFace[] = [];
    for (const face of faces) {
      const va = verts[face.a]!;
      const visible =
        face.normal[0] * (point[0] - va[0]) +
          face.normal[1] * (point[1] - va[1]) +
          face.normal[2] * (point[2] - va[2]) >
        1e-9;
      if (!visible) {
        kept.push(face);
        continue;
      }
      const tri: Array<[number, number]> = [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ];
      for (const [ea, eb] of tri) {
        const reverse = `${eb}|${ea}`;
        if (edges.has(reverse)) {
          edges.delete(reverse);
        } else {
          edges.set(`${ea}|${eb}`, [ea, eb]);
        }
      }
    }

    faces = kept;
    for (const [ea, eb] of edges.values()) {
      faces.push(epaFace(verts, ea, eb, pi));
    }
  }

  return { normal: [closest.normal[0], closest.normal[1], closest.normal[2]], depth: closest.distance };
}

/**
 * Narrow-phase contact between two convex shapes via GJK + EPA. Returns `null`
 * when they do not overlap. The contact normal points from `a` toward `b` and
 * `depth` is the penetration depth (positive when overlapping), matching
 * {@link sphereSphereContact}.
 */
export function convexConvexContact(
  shapeA: ConvexShape,
  positionA: ReadonlyVec3,
  orientationA: ReadonlyQuat,
  shapeB: ConvexShape,
  positionB: ReadonlyVec3,
  orientationB: ReadonlyQuat,
): Contact | null {
  const a: Placement = { shape: shapeA, position: positionA, orientation: orientationA };
  const b: Placement = { shape: shapeB, position: positionB, orientation: orientationB };
  const { hit, simplex } = gjkIntersect(a, b);
  if (!hit || simplex.length < 4) {
    return null;
  }
  return epa(a, b, simplex);
}

// --- contact manifold (reference/incident face clipping) ---------------------

type Polygon = { indices: number[]; normal: readonly number[] };

/** Transform all of a shape's local vertices into world space. */
function worldVertices(place: Placement): Vec3T[] {
  const { vertices } = place.shape;
  const out: Vec3T[] = [];
  const tmp: Vec3T = [0, 0, 0];
  for (let i = 0; i < vertices.length; i += 3) {
    tmp[0] = vertices[i]!;
    tmp[1] = vertices[i + 1]!;
    tmp[2] = vertices[i + 2]!;
    const w: Vec3T = [0, 0, 0];
    Vec3.transformQuat(w, tmp, place.orientation);
    out.push([
      w[0] + place.position[0],
      w[1] + place.position[1],
      w[2] + place.position[2],
    ]);
  }
  return out;
}

/** World-space outward normal of a polygon face. */
function worldNormal(place: Placement, polygon: Polygon): Vec3T {
  const n: Vec3T = [polygon.normal[0]!, polygon.normal[1]!, polygon.normal[2]!];
  const out: Vec3T = [0, 0, 0];
  Vec3.transformQuat(out, n, place.orientation);
  return out;
}

/** The polygon whose world normal is most parallel to `axis`, and that dot. */
function bestFace(
  place: Placement,
  verts: Vec3T[],
  axis: ReadonlyVec3,
): { polygon: Polygon; normal: Vec3T; loop: Vec3T[]; best: number } | null {
  const polygons = place.shape.polygons;
  if (!polygons || polygons.length === 0) {
    return null;
  }
  let bestPoly: Polygon | null = null;
  let bestNormal: Vec3T = [0, 0, 0];
  let best = -Infinity;
  for (const polygon of polygons) {
    const normal = worldNormal(place, polygon);
    const d = dot(normal, axis);
    if (d > best) {
      best = d;
      bestPoly = polygon;
      bestNormal = normal;
    }
  }
  if (!bestPoly) {
    return null;
  }
  const loop = bestPoly.indices.map((i) => verts[i]!);
  return { polygon: bestPoly, normal: bestNormal, loop, best };
}

/** Clip a polygon against the half-space where `dot(n, x - p0) >= 0`. */
function clipToPlane(poly: Vec3T[], p0: ReadonlyVec3, n: ReadonlyVec3): Vec3T[] {
  const out: Vec3T[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const next = poly[(i + 1) % poly.length]!;
    const dc = n[0] * (cur[0] - p0[0]) + n[1] * (cur[1] - p0[1]) + n[2] * (cur[2] - p0[2]);
    const dn =
      n[0] * (next[0] - p0[0]) + n[1] * (next[1] - p0[1]) + n[2] * (next[2] - p0[2]);
    const curIn = dc >= 0;
    const nextIn = dn >= 0;
    if (curIn) {
      out.push(cur);
    }
    if (curIn !== nextIn) {
      const t = dc / (dc - dn);
      out.push([
        cur[0] + t * (next[0] - cur[0]),
        cur[1] + t * (next[1] - cur[1]),
        cur[2] + t * (next[2] - cur[2]),
      ]);
    }
  }
  return out;
}

function polygonCentroid(poly: Vec3T[]): Vec3T {
  const c: Vec3T = [0, 0, 0];
  for (const p of poly) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  const inv = poly.length > 0 ? 1 / poly.length : 0;
  return [c[0] * inv, c[1] * inv, c[2] * inv];
}

/**
 * Build a contact manifold between two convex shapes. Runs GJK + EPA for the
 * separation normal, then clips the incident face against the reference face to
 * produce up to four stable contact points. Falls back to a single point when
 * polygon faces are unavailable. Returns `null` when the shapes do not overlap.
 *
 * The manifold `normal` points from `a` toward `b`, matching {@link Contact}.
 */
export function convexConvexManifold(
  shapeA: ConvexShape,
  positionA: ReadonlyVec3,
  orientationA: ReadonlyQuat,
  shapeB: ConvexShape,
  positionB: ReadonlyVec3,
  orientationB: ReadonlyQuat,
): ContactManifold | null {
  const a: Placement = { shape: shapeA, position: positionA, orientation: orientationA };
  const b: Placement = { shape: shapeB, position: positionB, orientation: orientationB };
  const { hit, simplex } = gjkIntersect(a, b);
  if (!hit || simplex.length < 4) {
    return null;
  }
  const contact = epa(a, b, simplex);
  const normal = contact.normal; // from a toward b

  const vertsA = worldVertices(a);
  const vertsB = worldVertices(b);

  // Reference face: the face (on A along +normal, or B along -normal) most
  // aligned with the separation axis.
  const negNormal: Vec3T = [-normal[0], -normal[1], -normal[2]];
  const faceA = bestFace(a, vertsA, normal);
  const faceB = bestFace(b, vertsB, negNormal);

  if (!faceA || !faceB) {
    // No polygon data: single approximate contact point on A's boundary.
    const support = convexSupport(shapeA, positionA, orientationA, normal);
    return { normal, points: [{ point: support, penetration: contact.depth }] };
  }

  // Reference is the more anti-aligned (flatter) face against the axis.
  const referenceIsA = faceA.best >= faceB.best;
  const reference = referenceIsA ? faceA : faceB;
  const incident = referenceIsA ? faceB : faceA;
  const refNormal = reference.normal;

  // Clip the incident polygon against each side plane of the reference face.
  let clipped = incident.loop;
  const centroid = polygonCentroid(reference.loop);
  const ref = reference.loop;
  for (let i = 0; i < ref.length && clipped.length > 0; i++) {
    const p0 = ref[i]!;
    const p1 = ref[(i + 1) % ref.length]!;
    const edge: Vec3T = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    let sideNormal = cross(edge, refNormal);
    // Orient the side plane so the reference centroid is inside.
    if (dot(sideNormal, sub(centroid, p0)) < 0) {
      sideNormal = neg(sideNormal);
    }
    clipped = clipToPlane(clipped, p0, sideNormal);
  }

  // Keep points at or below the reference face; penetration is the depth below.
  const refPoint = ref[0]!;
  const points: ManifoldPoint[] = [];
  for (const p of clipped) {
    const sep =
      refNormal[0] * (p[0] - refPoint[0]) +
      refNormal[1] * (p[1] - refPoint[1]) +
      refNormal[2] * (p[2] - refPoint[2]);
    if (sep <= 1e-6) {
      points.push({ point: p, penetration: -sep });
    }
  }

  if (points.length === 0) {
    // Edge/degenerate contact: fall back to the EPA result at the deepest vertex.
    const support = convexSupport(shapeA, positionA, orientationA, normal);
    return { normal, points: [{ point: support, penetration: contact.depth }] };
  }

  // Keep at most the four deepest points for a stable, cheap manifold.
  if (points.length > 4) {
    points.sort((x, y) => y.penetration - x.penetration);
    points.length = 4;
  }

  return { normal, points };
}
