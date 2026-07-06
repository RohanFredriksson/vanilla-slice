import type { Mesh, ConvexHull } from '@vanilla-slice/geometry';

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
export type Vec3T = [number, number, number];

/**
 * A piece produced by fracturing a mesh. `impulse` is the suggested radial
 * separation velocity (away from the fracture origin); the physics/core layer
 * applies it — fracture never touches physics state (ownership rules, ADR 0009).
 */
export interface FractureFragment {
  mesh: Mesh;
  centroid: Vec3T;
  impulse: Vec3T;
  /**
   * Convex hull of the piece in centroid-local space, ready to serve as the
   * collider for a body spawned at `centroid` with identity orientation — lets
   * the consumer skip recomputing a hull (fragments are already convex).
   */
  hull: ConvexHull;
}

/**
 * A reusable, precomputed set of fracture seed points in **normalized
 * mesh-local space** — each component in `[0, 1]`, mapped into the mesh's
 * axis-aligned bounds at fracture time.
 */
export interface FracturePattern {
  seeds: readonly Vec3T[];
}

/** Options for {@link fractureMesh}. */
export interface FractureOptions {
  /**
   * Explicit world-space seed points. Highest precedence; use to drive fracture
   * from a specific pattern or impact locus.
   */
  seeds?: readonly Vec3T[];
  /**
   * A normalized {@link FracturePattern} mapped into the mesh bounds. Used when
   * `seeds` is absent (optional precomputed fracture patterns).
   */
  pattern?: FracturePattern;
  /** Number of random seeds when neither `seeds` nor `pattern` is given. */
  count?: number;
  /** Deterministic RNG seed for random seed generation (ADR 0005 determinism). */
  seed?: number;
  /**
   * How far cracks propagate from the fracture origin, in `[0, 1]` (defaults to
   * `1`). `1` spreads random seeds uniformly across the mesh; lower values
   * cluster them near the `origin`, so damage is fine near the impact and coarse
   * elsewhere. Only affects randomly generated seeds (not explicit `seeds` or a
   * `pattern`).
   */
  propagation?: number;
  /** Point the fragments fly away from; defaults to the mesh centroid. */
  origin?: Vec3T;
  /** Radial separation speed applied to each fragment. */
  separationSpeed?: number;
  /** Cap cut cross-sections so fragments are closed solids (default `true`). */
  cap?: boolean;
}
