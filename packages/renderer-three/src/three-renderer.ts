import {
  Scene,
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  Raycaster,
  Vector2,
  type Material,
  type BufferGeometry,
  type PerspectiveCamera,
  type OrthographicCamera,
} from 'three';
import type { Mesh as EngineMesh } from '@vanilla-slice/core';
import type { EntityId, RenderItem } from '@vanilla-slice/core';
import { meshToBufferGeometry } from './three-utils';
import type { InteriorAppearanceRegistry } from './interior-appearance';

type Camera = PerspectiveCamera | OrthographicCamera;

/**
 * The minimal engine surface the renderer reads from. `World` satisfies this
 * structurally, so the renderer never depends on the concrete class. The
 * renderer only ever reads — it never mutates simulation state.
 */
export interface RenderSource {
  getRenderState(): RenderItem[];
  readonly sliceables: ReadonlyMap<EntityId, { mesh: EngineMesh }>;
}

/** Options for {@link ThreeRenderer}. */
export interface ThreeRendererOptions {
  /** Scene to add meshes to; a new one is created if omitted. */
  scene?: Scene;
  /** Factory for an entity's material (defaults to a white standard material). */
  createMaterial?: (item: RenderItem) => Material;
  /**
   * Optional registry mapping an entity's material id to an interior
   * (cut-surface) material. When present and an entity's geometry carries a
   * `tex3` attribute and geometry groups, the mesh is given a material array:
   * slot 0 = exterior (from `createMaterial`), slot 1 = interior (ADR 0010).
   * The registry owns its materials' lifecycle; the renderer never disposes
   * them.
   */
  interior?: InteriorAppearanceRegistry;
}

/**
 * Rendering adapter that mirrors engine render state into a Three.js scene. It
 * creates a mesh per renderable entity, syncs transforms each frame, and removes
 * meshes for despawned entities. Geometry is derived from the entity's engine
 * mesh (its `Sliceable`), so slice fragments render with their true shape.
 *
 * This adapter reads engine state only; it never writes back (ARCHITECTURE.md,
 * ownership rules).
 */
export class ThreeRenderer {
  readonly scene: Scene;
  private readonly meshes = new Map<EntityId, Mesh>();
  private readonly createMaterial: (item: RenderItem) => Material;
  private readonly interior?: InteriorAppearanceRegistry;
  private readonly fallbackGeometry = new BoxGeometry(1, 1, 1);

  constructor(options: ThreeRendererOptions = {}) {
    this.scene = options.scene ?? new Scene();
    this.createMaterial =
      options.createMaterial ??
      (() => new MeshStandardMaterial({ color: 0xffffff }));
    this.interior = options.interior;
  }

  /**
   * Synchronize the scene with the engine's current render state: add meshes for
   * new entities, update transforms, and remove meshes for entities no longer
   * present.
   */
  sync(source: RenderSource): void {
    const state = source.getRenderState();
    const present = new Set<EntityId>();

    for (const item of state) {
      present.add(item.id);
      let mesh = this.meshes.get(item.id);
      if (!mesh) {
        mesh = this.createMesh(source, item);
        this.meshes.set(item.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(item.position[0], item.position[1], item.position[2]);
      mesh.quaternion.set(
        item.orientation[0],
        item.orientation[1],
        item.orientation[2],
        item.orientation[3],
      );
      mesh.visible = item.visible;
    }

    for (const [id, mesh] of this.meshes) {
      if (!present.has(id)) {
        this.disposeMesh(id, mesh);
      }
    }
  }

  /** The Three.js mesh backing an entity, if any. */
  getObject(id: EntityId): Mesh | undefined {
    return this.meshes.get(id);
  }

  /**
   * Pick the entity under a normalized-device-coordinate point (`[-1, 1]`) via
   * raycasting. Returns the nearest hit entity id, or `null`.
   */
  pick(camera: Camera, ndcX: number, ndcY: number): EntityId | null {
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
    const hits = raycaster.intersectObjects([...this.meshes.values()], false);
    for (const hit of hits) {
      const id = (hit.object.userData as { entityId?: EntityId }).entityId;
      if (id !== undefined) {
        return id;
      }
    }
    return null;
  }

  /** Remove and dispose the mesh for a single entity. */
  remove(id: EntityId): void {
    const mesh = this.meshes.get(id);
    if (mesh) {
      this.disposeMesh(id, mesh);
    }
  }

  /** Remove and dispose every mesh and the fallback geometry. */
  clear(): void {
    for (const [id, mesh] of this.meshes) {
      this.disposeMesh(id, mesh);
    }
    this.fallbackGeometry.dispose();
  }

  private createMesh(source: RenderSource, item: RenderItem): Mesh {
    const geometry = this.geometryFor(source, item.id);
    const material = this.materialFor(geometry, item);
    const mesh = new Mesh(geometry, material);
    mesh.userData.entityId = item.id;
    return mesh;
  }

  /**
   * Resolve the material(s) for an entity. Returns a `[exterior, interior]`
   * array when an interior registry resolves the entity's material *and* the
   * geometry carries the `tex3` attribute and groups the interior shader needs;
   * otherwise the single exterior material (which Three applies to all groups).
   */
  private materialFor(
    geometry: BufferGeometry,
    item: RenderItem,
  ): Material | Material[] {
    const exterior = this.createMaterial(item);
    if (
      !this.interior ||
      geometry.groups.length === 0 ||
      !geometry.getAttribute('tex3')
    ) {
      return exterior;
    }
    const interior = this.interior.resolve(item.materialId);
    return interior ? [exterior, interior] : exterior;
  }

  private geometryFor(source: RenderSource, id: EntityId): BufferGeometry {
    const engineMesh = source.sliceables.get(id)?.mesh;
    return engineMesh ? meshToBufferGeometry(engineMesh) : this.fallbackGeometry;
  }

  private disposeMesh(id: EntityId, mesh: Mesh): void {
    this.scene.remove(mesh);
    if (mesh.geometry !== this.fallbackGeometry && mesh.geometry.dispose) {
      mesh.geometry.dispose();
    }
    // Only the exterior (slot 0) material is renderer-owned; interior materials
    // belong to the InteriorAppearanceRegistry and are disposed by it.
    const material = mesh.material;
    const exterior = Array.isArray(material) ? material[0] : material;
    exterior?.dispose();
    this.meshes.delete(id);
  }
}
