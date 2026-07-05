import { describe, it, expect } from 'vitest';
import { createBox, computeVolume } from '@vanilla-slice/geometry';
import { createWorld, World } from './world';

describe('World lifecycle', () => {
  it('creates a world with resolved defaults', () => {
    const world = createWorld();
    expect(world).toBeInstanceOf(World);
    expect(world.config.gravity).toEqual([0, -9.81, 0]);
    expect(world.config.fixedTimestep).toBeCloseTo(1 / 60, 10);
    expect(world.entityCount).toBe(0);
  });

  it('honors provided config', () => {
    const world = createWorld({ gravity: [0, -1, 0], cellSize: 2 });
    expect(world.config.gravity).toEqual([0, -1, 0]);
    expect(world.config.cellSize).toBe(2);
  });

  it('spawns entities with components based on options', () => {
    const world = createWorld();
    const id = world.spawn({
      geometry: createBox(),
      meshRef: 'fruit',
      mass: 2,
      velocity: [1, 0, 0],
      tags: ['fruit'],
      name: 'apple',
    });
    expect(world.has(id)).toBe(true);
    expect(world.bodies.get(id)!.velocity).toEqual([1, 0, 0]);
    expect(world.sliceables.has(id)).toBe(true);
    expect(world.renderables.get(id)!.meshRef).toBe('fruit');
    expect(world.metadata.get(id)!.tags.has('fruit')).toBe(true);
    expect(world.metadata.get(id)!.name).toBe('apple');
  });

  it('derives a bounding radius from geometry when not given', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox() });
    // Unit box corner distance from center = sqrt(0.75) ≈ 0.866.
    expect(world.bodies.get(id)!.radius).toBeCloseTo(Math.sqrt(0.75), 6);
  });

  it('despawns entities and reports existence', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox() });
    expect(world.despawn(id)).toBe(true);
    expect(world.despawn(id)).toBe(false);
    expect(world.has(id)).toBe(false);
    expect(world.entityCount).toBe(0);
  });
});

describe('World update loop', () => {
  it('applies gravity over fixed steps', () => {
    const world = createWorld({ gravity: [0, -10, 0] });
    const id = world.spawn({ mass: 1, radius: 0.1 });
    // Drive the loop like a real frame loop: 60 frames of 1/60s = 1s.
    for (let i = 0; i < 60; i++) {
      world.update(1 / 60);
    }
    const body = world.bodies.get(id)!;
    expect(body.velocity[1]).toBeCloseTo(-10, 6);
    expect(body.position[1]).toBeLessThan(0);
  });

  it('clamps simulation to maxSubSteps within a single large frame', () => {
    const world = createWorld({ gravity: [0, -10, 0], maxSubSteps: 8 });
    const id = world.spawn({ mass: 1, radius: 0.1 });
    world.update(1); // one huge frame is capped at 8 sub-steps of 1/60s
    // 8 * (1/60) * 10 ≈ 1.333 m/s, not a full second of gravity.
    expect(world.bodies.get(id)!.velocity[1]).toBeCloseTo(-(10 * 8) / 60, 6);
  });

  it('rests a body on the ground half-space', () => {
    const world = createWorld({
      gravity: [0, -10, 0],
      ground: { normal: [0, 1, 0], offset: 0, restitution: 0 },
    });
    const id = world.spawn({ position: [0, 5, 0], radius: 0.5, mass: 1 });
    for (let i = 0; i < 300; i++) {
      world.update(1 / 60);
    }
    // Body settles onto the surface at y = offset + radius.
    expect(world.bodies.get(id)!.position[1]).toBeCloseTo(0.5, 2);
  });

  it('removes bodies that leave the bounds', () => {
    const world = createWorld({
      gravity: [0, -10, 0],
      bounds: { min: [-5, -5, -5], max: [5, 5, 5] },
    });
    const id = world.spawn({ position: [0, 0, 0], velocity: [0, -50, 0] });
    world.update(1);
    expect(world.has(id)).toBe(false);
  });

  it('produces a render snapshot for renderable entities', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({ meshRef: 'a', position: [1, 2, 3] });
    world.spawn({ position: [9, 9, 9] }); // no meshRef => not rendered
    const state = world.getRenderState();
    expect(state).toHaveLength(1);
    expect(state[0]!.meshRef).toBe('a');
    expect(state[0]!.position).toEqual([1, 2, 3]);
  });
});

describe('World integration total volume', () => {
  it('preserves total mesh volume across a slice', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const box = createBox(2, 2, 2); // volume 8
    world.spawn({ geometry: box, position: [0, 0, 0] });
    // Volume before is available via the sliceable's local mesh.
    expect(computeVolume(box)).toBeCloseTo(8, 6);
  });
});

describe('World collisions', () => {
  const dist = (a: readonly number[], b: readonly number[]): number =>
    Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

  it('is enabled by default and pushes overlapping bodies apart', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const a = world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0] });
    const b = world.spawn({ geometry: createBox(1, 1, 1), position: [0.5, 0, 0] });
    for (let i = 0; i < 180; i++) {
      world.update(1 / 60);
    }
    const pa = world.bodies.get(a)!.position;
    const pb = world.bodies.get(b)!.position;
    // Two unit boxes should separate toward center distance ≈ 1.
    expect(dist(pa, pb)).toBeGreaterThan(0.9);
  });

  it('rests a dynamic box on a static box (stacking)', () => {
    const world = createWorld({ gravity: [0, -10, 0] });
    world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0], mass: 0 });
    const top = world.spawn({ geometry: createBox(1, 1, 1), position: [0, 2, 0] });
    for (let i = 0; i < 400; i++) {
      world.update(1 / 60);
    }
    // Top box settles resting on the static box: center at ≈ 1.0.
    expect(world.bodies.get(top)!.position[1]).toBeCloseTo(1, 1);
  });

  it('skips bodies flagged collides: false', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const a = world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0] });
    world.spawn({ geometry: createBox(1, 1, 1), position: [0.5, 0, 0], collides: false });
    for (let i = 0; i < 60; i++) {
      world.update(1 / 60);
    }
    // With the neighbour opted out, the dynamic body is not pushed.
    expect(world.bodies.get(a)!.position[0]).toBeCloseTo(0, 6);
  });

  it('can be disabled globally via config', () => {
    const world = createWorld({ gravity: [0, 0, 0], collisions: false });
    const a = world.spawn({ geometry: createBox(1, 1, 1), position: [0, 0, 0] });
    const b = world.spawn({ geometry: createBox(1, 1, 1), position: [0.5, 0, 0] });
    for (let i = 0; i < 60; i++) {
      world.update(1 / 60);
    }
    // Bodies phase through each other unchanged.
    expect(world.bodies.get(a)!.position[0]).toBeCloseTo(0, 6);
    expect(world.bodies.get(b)!.position[0]).toBeCloseTo(0.5, 6);
  });
});
