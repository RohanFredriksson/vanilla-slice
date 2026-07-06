import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, MeshBasicMaterial } from 'three';
import {
  createWorld,
  createBox,
  createPlane,
  fromNormalAndPoint,
  createSliceVolume,
} from '@vanilla-slice/core';
import type { Mesh, Material } from '@vanilla-slice/core';
import { ThreeRenderer } from './three-renderer';
import { InteriorAppearanceRegistry } from './interior-appearance';

/** A wood material for world registration (physics-only fields). */
const WOOD: Material = {
  id: 'wood',
  density: 700,
  friction: 0.5,
  restitution: 0.2,
  toughness: 100,
  brittleness: 0.2,
  fracturePropagationFactor: 0.3,
};

/** A unit box carrying UVs, tex3, and one interior (slot 1) face. */
function texturedBoxGeometry(): Mesh {
  const box = createBox();
  const tris = box.indices.length / 3;
  const groups = new Array<number>(tris).fill(0);
  groups[0] = 1;
  const uvs = new Array<number>((box.positions.length / 3) * 2).fill(0);
  return { ...box, uvs, tex3: box.positions.slice(), groups };
}

describe('ThreeRenderer', () => {
  it('creates a scene mesh per renderable entity and syncs transforms', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      position: [1, 2, 3],
    });

    const renderer = new ThreeRenderer();
    renderer.sync(world);

    const mesh = renderer.getObject(id);
    expect(mesh).toBeDefined();
    expect(renderer.scene.children).toContain(mesh);
    expect(mesh!.position.toArray()).toEqual([1, 2, 3]);
    expect(mesh!.userData.entityId).toBe(id);
  });

  it('does not render entities without a renderable component', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({ geometry: createBox(), position: [0, 0, 0] }); // no meshRef
    const renderer = new ThreeRenderer();
    renderer.sync(world);
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('updates transforms on subsequent syncs without recreating meshes', () => {
    const world = createWorld({ gravity: [0, -10, 0] });
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      position: [0, 0, 0],
      radius: 0.1,
    });
    const renderer = new ThreeRenderer();
    renderer.sync(world);
    const meshBefore = renderer.getObject(id);

    for (let i = 0; i < 30; i++) {
      world.update(1 / 60);
    }
    renderer.sync(world);
    const meshAfter = renderer.getObject(id);

    expect(meshAfter).toBe(meshBefore); // same object reused
    expect(meshAfter!.position.y).toBeLessThan(0); // fell under gravity
  });

  it('removes meshes for despawned entities', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({ geometry: createBox(), meshRef: 'fruit' });
    const renderer = new ThreeRenderer();
    renderer.sync(world);
    expect(renderer.getObject(id)).toBeDefined();

    world.despawn(id);
    renderer.sync(world);
    expect(renderer.getObject(id)).toBeUndefined();
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('reflects a slice as new fragment meshes replacing the original', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      position: [0, 0, 0],
    });
    const renderer = new ThreeRenderer();
    renderer.sync(world);

    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const outcome = world.slice(createSliceVolume(plane, [0, 0, 0], 2));
    renderer.sync(world);

    expect(renderer.getObject(id)).toBeUndefined();
    for (const fragmentId of outcome.created) {
      expect(renderer.getObject(fragmentId)).toBeDefined();
    }
  });

  it('picks the entity under a center screen ray', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      position: [0, 0, 0],
    });
    const renderer = new ThreeRenderer({
      createMaterial: () => new MeshBasicMaterial(),
    });
    renderer.sync(world);

    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    expect(renderer.pick(camera, 0, 0)).toBe(id);
    expect(renderer.pick(camera, 0.95, 0.95)).toBeNull();
  });

  it('gives an entity a [exterior, interior] material array when textured (ADR 0010)', () => {
    const world = createWorld({ gravity: [0, 0, 0], materials: [WOOD] });
    const id = world.spawn({
      geometry: texturedBoxGeometry(),
      meshRef: 'log',
      material: 'wood',
      position: [0, 0, 0],
    });

    const interior = new InteriorAppearanceRegistry().registerPreset('wood', {
      pattern: 'wood',
    });
    const renderer = new ThreeRenderer({ interior });
    renderer.sync(world);

    const material = renderer.getObject(id)!.material;
    expect(Array.isArray(material)).toBe(true);
    expect((material as Material[]).length).toBe(2);
    // Slot 1 is the shared, registry-owned interior material.
    expect((material as Material[])[1]).toBe(interior.resolve('wood'));
  });

  it('uses a single material when no interior registry is provided', () => {
    const world = createWorld({ gravity: [0, 0, 0], materials: [WOOD] });
    const id = world.spawn({
      geometry: texturedBoxGeometry(),
      meshRef: 'log',
      material: 'wood',
      position: [0, 0, 0],
    });
    const renderer = new ThreeRenderer();
    renderer.sync(world);
    expect(Array.isArray(renderer.getObject(id)!.material)).toBe(false);
  });

  it('uses a single material when the geometry has no tex3 attribute', () => {
    const world = createWorld({ gravity: [0, 0, 0], materials: [WOOD] });
    const id = world.spawn({
      geometry: createBox(), // no uv/tex3/groups
      meshRef: 'plain',
      material: 'wood',
      position: [0, 0, 0],
    });
    const interior = new InteriorAppearanceRegistry().registerPreset('wood', {
      pattern: 'wood',
    });
    const renderer = new ThreeRenderer({ interior });
    renderer.sync(world);
    expect(Array.isArray(renderer.getObject(id)!.material)).toBe(false);
  });

  it('does not dispose registry-owned interior materials on despawn', () => {
    const world = createWorld({ gravity: [0, 0, 0], materials: [WOOD] });
    const id = world.spawn({
      geometry: texturedBoxGeometry(),
      meshRef: 'log',
      material: 'wood',
      position: [0, 0, 0],
    });
    const interior = new InteriorAppearanceRegistry().registerPreset('wood', {
      pattern: 'wood',
    });
    const interiorMat = interior.resolve('wood')!;
    let disposed = false;
    interiorMat.dispose = () => {
      disposed = true;
    };

    const renderer = new ThreeRenderer({ interior });
    renderer.sync(world);
    world.despawn(id);
    renderer.sync(world);

    expect(disposed).toBe(false); // registry owns interior lifecycle
  });
});
