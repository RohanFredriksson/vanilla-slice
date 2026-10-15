import type { RigidBody, Aabb, ConvexShape } from '@vanilla-slice/physics';
import type { SpatialHash, EntityId } from '@vanilla-slice/spatial';
import type { Mesh } from '@vanilla-slice/geometry';
import type { Material, MaterialId, MaterialLibrary } from '@vanilla-slice/materials';
import type { InteractionQueue, InteractionRegistry } from '@vanilla-slice/interactions';

export type { EntityId };

/** Mutable 3-component vector (matches `@vanilla-slice/math`'s `Vec3`). */
export type Vec3T = [number, number, number];
/** Mutable quaternion (matches `@vanilla-slice/math`'s `Quat`). */
export type QuatT = [number, number, number, number];

/** Renderable component: an opaque handle the render adapter maps to a mesh. */
export interface Renderable {
  meshRef: string | number;
  visible: boolean;
}

/** Sliceable component: the local-space source mesh and an enable flag. */
export interface Sliceable {
  mesh: Mesh;
  enabled: boolean;
}

/** Metadata component: tags and an optional human-readable name. */
export interface Metadata {
  tags: Set<string>;
  name?: string;
  /**
   * How many automatic impact-fractures this body is descended from. Original
   * (spawned or sliced) bodies are generation `0`; each impact-fracture stamps
   * its fragments one generation higher. The collision/ground systems cap this
   * so a hard landing can shatter a piece a bounded number of times instead of
   * cascading into dust.
   */
  fractureGeneration?: number;
  /**
   * Volume of the body's geometry in world units³, computed once at spawn
   * (fragments pass their already-known volume through). Read by the optional
   * small-fragment culling (Phase 12); absent for bodies without geometry.
   */
  volume?: number;
  /**
   * Accumulated seconds since spawn, advanced by the culling pass. Only
   * tracked while the world configures `smallBodyCulling` (Phase 12).
   */
  ageSeconds?: number;
  /**
   * Set to `false` to exempt this body from small-fragment culling. Defaults
   * to `true`; only stored when opted out (Phase 12).
   */
  cullable?: boolean;
  /**
   * Set when the body has crossed the small-fragment culling threshold and is
   * shrinking out of existence. A dissolving body stops participating in
   * collision, spatial, slicing, fracture, and bounds cleanup, but keeps
   * integrating under physics; it is despawned when its age reaches
   * `delaySeconds + shrinkSeconds` (Phase 12.1).
   */
  dissolving?: boolean;
}

/**
 * MaterialRef component: the id of a {@link Material} registered in the world's
 * `MaterialLibrary`. Behaviour (slice/fracture/collision) is derived from the
 * referenced material's data, never from object-type knowledge (ADR 0009).
 */
export interface MaterialRef {
  materialId: MaterialId;
}

/** A static half-space `dot(normal, p) >= offset` used for simple collision. */
export interface GroundConfig {
  normal: Vec3T;
  offset: number;
  restitution?: number;
}

/** Options accepted by {@link createWorld}. */
export interface WorldConfig {
  gravity?: Vec3T;
  fixedTimestep?: number;
  maxSubSteps?: number;
  /** Spatial-hash cell size for broad-phase queries. */
  cellSize?: number;
  /** Bodies whose position leaves these bounds are removed by cleanup. */
  bounds?: Aabb;
  /** Optional ground half-space for simple collision. */
  ground?: GroundConfig;
  /** Materials to register in the world's library up front (ADR 0009). */
  materials?: readonly Material[];
  /** Default separation speed applied to slice fragments. */
  sliceSeparationSpeed?: number;
  /** Enable body-vs-body collision resolution. Defaults to `true`. */
  collisions?: boolean;
  /** Default restitution (bounciness) for contacts in `[0, 1]`. Defaults to 0. */
  restitution?: number;
  /** Default Coulomb friction coefficient for contacts. Defaults to 0.5. */
  friction?: number;
  /**
   * Approximate-convex-decompose colliders by default so concave meshes collide
   * as compounds of convex hulls. Defaults to `false` (single hull per body).
   */
  decomposeColliders?: boolean;
  /** Angular impulse scale for tipping unstable bodies. 0 disables it. Default 12. */
  tipFactor?: number;
  /**
   * Optional cleanup of tiny fragments: bodies whose volume falls below
   * `minVolume` (world units³) and have existed for at least `delaySeconds`
   * are despawned by the cleanup pass. Absent = disabled (no behaviour
   * change). Repeated slices grind a body into near-zero-volume slivers —
   * each one a full body — so this keeps body counts bounded; small pieces
   * visibly dissolve shortly after being cut (Phase 12).
   */
  smallBodyCulling?: {
    /** Volume threshold in world units³; bodies below this are cull candidates. */
    minVolume: number;
    /** Seconds a body must exist before it may be culled. */
    delaySeconds: number;
    /** Skip static bodies (`mass: 0`). Defaults to `true`. */
    skipStatic?: boolean;
    /**
     * Seconds a culled body visibly shrinks (render scale 1 → 0) before it is
     * despawned, instead of popping out of existence. Defaults to `0.3`;
     * `0` despawns instantly (Phase 12.1).
     */
    shrinkSeconds?: number;
  };
}

/** Fully-resolved configuration with all defaults applied. */
export interface ResolvedConfig {
  gravity: Vec3T;
  fixedTimestep: number;
  maxSubSteps: number;
  cellSize: number;
  bounds: Aabb;
  ground?: GroundConfig;
  sliceSeparationSpeed: number;
  collisions: boolean;
  restitution: number;
  friction: number;
  decomposeColliders: boolean;
  tipFactor: number;
  /** Resolved small-fragment culling settings; absent = feature disabled. */
  smallBodyCulling?: {
    minVolume: number;
    delaySeconds: number;
    skipStatic: boolean;
    shrinkSeconds: number;
  };
}

/** Options for spawning an entity. */
export interface SpawnOptions {
  position?: Vec3T;
  velocity?: Vec3T;
  orientation?: QuatT;
  angularVelocity?: Vec3T;
  /** Mass in kg; `<= 0` or non-finite makes the body static. Defaults to 1. */
  mass?: number;
  /** Bounding radius; defaults to the geometry's radius or 0.5. */
  radius?: number;
  linearDamping?: number;
  angularDamping?: number;
  /** Local-space source mesh; presence adds a {@link Sliceable} component. */
  geometry?: Mesh;
  /**
   * Set to `false` to make the body non-sliceable (and non-fracturable): it
   * keeps its mesh and collider but slice/fracture interactions skip it — useful
   * for ground, walls, and other fixtures. Defaults to `true`. Ignored when no
   * `geometry` is given.
   */
  sliceable?: boolean;
  /** Render handle; presence adds a {@link Renderable} component. */
  meshRef?: string | number;
  /**
   * Id of a {@link Material} registered in the world's library. Presence adds a
   * {@link MaterialRef} component and, when `mass` is omitted and `geometry` is
   * present, derives the body's mass from the material's density and the mesh
   * volume. Unknown ids resolve to the library's default material.
   */
  material?: MaterialId;
  tags?: string[];
  name?: string;
  /**
   * Convex collider used for body-vs-body collision. Defaults to the convex
   * hull of `geometry` when present. Bodies without one fall back to their
   * bounding sphere (`radius`).
   */
  collider?: ConvexShape;
  /** Set to `false` to exclude this body from collision. Defaults to `true`. */
  collides?: boolean;
  /**
   * Approximate-convex-decompose this body's `geometry` into a compound of
   * convex hulls for accurate concave collision. Defaults to the world's
   * `decomposeColliders`. Ignored when `collider` is given.
   */
  decompose?: boolean;
  /**
   * Volume override (world units³) used by small-fragment culling. Defaults
   * to the geometry's computed volume. Slicing passes each fragment's known
   * volume so it is not recomputed (Phase 12).
   */
  volume?: number;
  /**
   * Set to `false` to exempt this body from small-fragment culling. Defaults
   * to `true`. Ignored unless the world configures `smallBodyCulling`.
   */
  cullable?: boolean;
}

/** A snapshot of one renderable entity's transform for the render adapter. */
export interface RenderItem {
  id: EntityId;
  meshRef: string | number;
  position: Vec3T;
  orientation: QuatT;
  visible: boolean;
  /**
   * Uniform render scale. `[1,1,1]` normally; a culled body in its shrink
   * phase eases this from `1` → `0` over `smallBodyCulling.shrinkSeconds`, so
   * pieces visibly dissolve instead of popping (Phase 12.1).
   */
  scale: Vec3T;
  /**
   * The entity's material id, when it has a {@link MaterialRef}. Surfaced as
   * neutral data so the render adapter can pick a per-material appearance (e.g.
   * an interior/cut-surface texture); the engine still owns no looks (ADR 0010).
   */
  materialId?: MaterialId;
}

/** The result of a slice: which entities were removed and created. */
export interface SliceOutcome {
  removed: EntityId[];
  created: EntityId[];
}

/**
 * The mutable simulation state that systems operate on. The `World` class
 * implements this; systems are plain functions that read and write components
 * through it (composition over inheritance — ADR 0003).
 */
export interface SimWorld {
  readonly config: ResolvedConfig;
  readonly bodies: Map<EntityId, RigidBody>;
  readonly sliceables: Map<EntityId, Sliceable>;
  readonly renderables: Map<EntityId, Renderable>;
  readonly metadata: Map<EntityId, Metadata>;
  readonly spatial: SpatialHash;
  /** Convex colliders keyed by entity, for body-vs-body collision. */
  readonly colliders: Map<EntityId, ConvexShape>;
  /** Compound (multi-hull) colliders for decomposed concave bodies. */
  readonly compoundColliders: Map<EntityId, ConvexShape[]>;
  /** Entities explicitly excluded from collision (`collides: false`). */
  readonly nonCollidable: Set<EntityId>;
  /** The world's material registry; entities reference materials by id. */
  readonly materials: MaterialLibrary;
  /** Material references keyed by entity (present only for material-tagged bodies). */
  readonly materialRefs: Map<EntityId, MaterialRef>;
  /** Per-step queue of interactions to resolve (slice gestures, impacts). */
  readonly interactions: InteractionQueue;
  /** Registry of interaction processors keyed by type (slice, fracture, …). */
  readonly interactionRegistry: InteractionRegistry<SimWorld>;
  spawn(options: SpawnOptions): EntityId;
  despawn(id: EntityId): boolean;
}
