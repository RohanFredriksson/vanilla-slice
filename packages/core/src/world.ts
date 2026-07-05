import { createBody } from '@slice/physics';
import type { RigidBody, Aabb } from '@slice/physics';
import {
  createSpatialHash,
  insert,
  remove as spatialRemove,
} from '@slice/spatial';
import type { SpatialHash, EntityId } from '@slice/spatial';
import {
  createFixedStepper,
  advance,
  alpha as stepperAlpha,
} from '@slice/physics';
import type { FixedStepper } from '@slice/physics';
import type { SliceVolume } from '@slice/slicing';
import {
  stepPhysics,
  syncSpatial,
  runCleanup,
  getRenderState,
} from './systems';
import { sliceWorld } from './slice-system';
import type { SliceWorldOptions } from './slice-system';
import { boundingRadius, sphereAabb } from './mesh-util';
import type {
  SimWorld,
  ResolvedConfig,
  WorldConfig,
  SpawnOptions,
  Renderable,
  Sliceable,
  Metadata,
  RenderItem,
  SliceOutcome,
} from './types';

const DEFAULT_BOUNDS: Aabb = {
  min: [-1e4, -1e4, -1e4],
  max: [1e4, 1e4, 1e4],
};

function resolveConfig(config: WorldConfig): ResolvedConfig {
  return {
    gravity: config.gravity ? [...config.gravity] : [0, -9.81, 0],
    fixedTimestep: config.fixedTimestep ?? 1 / 60,
    maxSubSteps: config.maxSubSteps ?? 8,
    cellSize: config.cellSize ?? 1,
    bounds: config.bounds ?? DEFAULT_BOUNDS,
    ground: config.ground,
    sliceSeparationSpeed: config.sliceSeparationSpeed ?? 2,
  };
}

/**
 * The simulation world: a light ECS that owns entities (ids), their components
 * (`Body`, `Renderable`, `Sliceable`, `Metadata`), and the systems that operate
 * on them. Framework-free and headless — it never touches rendering or the DOM.
 */
export class World implements SimWorld {
  readonly config: ResolvedConfig;
  readonly bodies = new Map<EntityId, RigidBody>();
  readonly sliceables = new Map<EntityId, Sliceable>();
  readonly renderables = new Map<EntityId, Renderable>();
  readonly metadata = new Map<EntityId, Metadata>();
  readonly spatial: SpatialHash;

  private readonly stepper: FixedStepper;
  private nextId: EntityId = 1;

  constructor(config: WorldConfig = {}) {
    this.config = resolveConfig(config);
    this.spatial = createSpatialHash(this.config.cellSize);
    this.stepper = createFixedStepper(
      this.config.fixedTimestep,
      this.config.maxSubSteps,
    );
  }

  /** Spawn an entity and return its id. Always creates a `Body` component. */
  spawn(options: SpawnOptions): EntityId {
    const id = this.nextId++;

    const radius =
      options.radius ??
      (options.geometry ? boundingRadius(options.geometry) : 0.5);

    const body = createBody({
      position: options.position,
      velocity: options.velocity,
      orientation: options.orientation,
      angularVelocity: options.angularVelocity,
      mass: options.mass ?? 1,
      radius,
      linearDamping: options.linearDamping,
      angularDamping: options.angularDamping,
    });
    this.bodies.set(id, body);

    if (options.geometry) {
      this.sliceables.set(id, { mesh: options.geometry, enabled: true });
    }
    if (options.meshRef !== undefined) {
      this.renderables.set(id, { meshRef: options.meshRef, visible: true });
    }
    this.metadata.set(id, {
      tags: new Set(options.tags ?? []),
      ...(options.name !== undefined ? { name: options.name } : {}),
    });

    insert(this.spatial, id, sphereAabb(body.position, body.radius));
    return id;
  }

  /** Remove an entity and all its components. Returns whether it existed. */
  despawn(id: EntityId): boolean {
    if (!this.bodies.has(id)) {
      return false;
    }
    this.bodies.delete(id);
    this.sliceables.delete(id);
    this.renderables.delete(id);
    this.metadata.delete(id);
    spatialRemove(this.spatial, id);
    return true;
  }

  /** Whether an entity is currently alive. */
  has(id: EntityId): boolean {
    return this.bodies.has(id);
  }

  /** Number of live entities. */
  get entityCount(): number {
    return this.bodies.size;
  }

  /**
   * Advance the simulation by a variable `frameDelta`, running physics on a
   * fixed timestep (ADR 0005), then refreshing spatial state and cleanup.
   */
  update(frameDelta: number): void {
    advance(this.stepper, frameDelta, (dt) => stepPhysics(this, dt));
    syncSpatial(this);
    runCleanup(this);
  }

  /** Interpolation factor in `[0, 1)` toward the next fixed step. */
  alpha(): number {
    return stepperAlpha(this.stepper);
  }

  /** Perform a slice with a bounded volume, replacing hit meshes with fragments. */
  slice(volume: SliceVolume, options?: SliceWorldOptions): SliceOutcome {
    return sliceWorld(this, volume, options);
  }

  /** Snapshot of renderable transforms for a rendering adapter to consume. */
  getRenderState(): RenderItem[] {
    return getRenderState(this);
  }
}

/** Create a new simulation world. */
export function createWorld(config: WorldConfig = {}): World {
  return new World(config);
}
