import type { RigidBody, Aabb } from '@vanilla-slice/physics';
import type { SpatialHash, EntityId } from '@vanilla-slice/spatial';
import type { Mesh } from '@vanilla-slice/geometry';

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
  /** Default separation speed applied to slice fragments. */
  sliceSeparationSpeed?: number;
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
  /** Render handle; presence adds a {@link Renderable} component. */
  meshRef?: string | number;
  tags?: string[];
  name?: string;
}

/** A snapshot of one renderable entity's transform for the render adapter. */
export interface RenderItem {
  id: EntityId;
  meshRef: string | number;
  position: Vec3T;
  orientation: QuatT;
  visible: boolean;
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
  spawn(options: SpawnOptions): EntityId;
  despawn(id: EntityId): boolean;
}
