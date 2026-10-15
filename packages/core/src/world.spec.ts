import { describe, it, expect } from 'vitest';
import { createBox, createMesh, computeVolume } from '@vanilla-slice/geometry';
import type { Mesh } from '@vanilla-slice/geometry';
import { createSliceVolume } from '@vanilla-slice/slicing';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';
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

describe('World small-fragment culling (Phase 12)', () => {
  const tiny = () => createBox(0.1, 0.1, 0.1); // volume 0.001

  it('is disabled by default: tiny bodies persist indefinitely', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const id = world.spawn({ geometry: tiny() });
    for (let i = 0; i < 300; i++) {
      world.update(1 / 60);
    }
    expect(world.has(id)).toBe(true);
  });

  it('records the geometry volume on metadata at spawn', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox(2, 2, 2) });
    expect(world.metadata.get(id)!.volume).toBeCloseTo(8, 6);
  });

  it('honors an explicit volume override and computes none', () => {
    const world = createWorld();
    const id = world.spawn({ geometry: createBox(2, 2, 2), volume: 0.5 });
    expect(world.metadata.get(id)!.volume).toBeCloseTo(0.5, 6);
  });

  it('culls a small body only after the configured delay', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 1, shrinkSeconds: 0 },
    });
    const id = world.spawn({ geometry: tiny() });
    world.update(0.9);
    expect(world.has(id)).toBe(true); // below threshold, delay not yet elapsed
    world.update(0.2);
    expect(world.has(id)).toBe(false);
  });

  it('never culls bodies above the volume threshold', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0 },
    });
    const id = world.spawn({ geometry: createBox(2, 2, 2) }); // volume 8
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60);
    }
    expect(world.has(id)).toBe(true);
  });

  it('protects static bodies by default (skipStatic)', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0 },
    });
    const id = world.spawn({ geometry: tiny(), mass: 0 });
    world.update(1);
    expect(world.has(id)).toBe(true);
  });

  it('culls static bodies when skipStatic is false', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0, skipStatic: false },
    });
    const id = world.spawn({ geometry: tiny(), mass: 0 });
    world.update(1);
    expect(world.has(id)).toBe(false);
  });

  it('exempts bodies flagged cullable: false', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0 },
    });
    const id = world.spawn({ geometry: tiny(), cullable: false });
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60);
    }
    expect(world.has(id)).toBe(true);
  });

  it('culls geometry-less bodies given an explicit volume', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0 },
    });
    const id = world.spawn({ radius: 0.5, volume: 0.01 });
    world.update(1);
    expect(world.has(id)).toBe(false);
  });

  it('culls tiny slice fragments after the delay, not before', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.5, shrinkSeconds: 0 },
    });
    world.spawn({ geometry: createBox(0.2, 0.2, 0.2) }); // volume 0.008
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const outcome = world.slice(createSliceVolume(plane, [0, 0, 0], 2));
    expect(outcome.created.length).toBeGreaterThanOrEqual(2);

    world.update(0.4); // below the delay: fragments still alive
    for (const fid of outcome.created) {
      expect(world.has(fid)).toBe(true);
    }

    world.update(0.2); // age passes 0.5s: tiny fragments culled
    expect(world.entityCount).toBe(0);
  });

  it('fragments inherit the parent cullable: false exemption', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0 },
    });
    world.spawn({ geometry: createBox(0.2, 0.2, 0.2), cullable: false });
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const outcome = world.slice(createSliceVolume(plane, [0, 0, 0], 2));
    world.update(1);
    for (const fid of outcome.created) {
      expect(world.has(fid)).toBe(true);
    }
  });
});

describe('World shrink-dissolve despawn (Phase 12.1)', () => {
  const tiny = () => createBox(0.1, 0.1, 0.1); // volume 0.001

  it('marks a culled body dissolving instead of despawning instantly', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.5, shrinkSeconds: 0.3 },
    });
    const id = world.spawn({ geometry: tiny() });
    world.update(0.5); // crosses the threshold exactly
    expect(world.has(id)).toBe(true);
    expect(world.metadata.get(id)!.dissolving).toBe(true);
  });

  it('despawns a dissolving body only at delay + shrink', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.5, shrinkSeconds: 0.3 },
    });
    const id = world.spawn({ geometry: tiny() });
    world.update(0.5); // marked dissolving
    world.update(0.2); // age 0.7 < 0.8: still shrinking
    expect(world.has(id)).toBe(true);
    world.update(0.11); // age 0.81 >= 0.8: shrink complete, despawned
    expect(world.has(id)).toBe(false);
  });

  it('eases the render scale 1 -> 0 across the shrink window', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.5, shrinkSeconds: 1 },
    });
    const id = world.spawn({ geometry: tiny(), meshRef: 'spec' });
    world.update(0.5); // marked dissolving, scale still 1
    expect(world.getRenderState()[0]!.scale).toEqual([1, 1, 1]);
    world.update(0.5); // halfway through the shrink
    const halfway = world.getRenderState()[0]!.scale;
    expect(halfway[0]).toBeCloseTo(0.5, 6);
    world.update(0.5); // shrink window over; entity despawned
    expect(world.getRenderState()).toHaveLength(0);
    expect(world.has(id)).toBe(false);
  });

  it('reports scale [1,1,1] for ordinary bodies', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({ geometry: createBox(), meshRef: 'spec' });
    expect(world.getRenderState()[0]!.scale).toEqual([1, 1, 1]);
  });

  it('shrinkSeconds: 0 keeps instant despawn', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.5, shrinkSeconds: 0 },
    });
    const id = world.spawn({ geometry: tiny() });
    world.update(0.5);
    expect(world.has(id)).toBe(false); // despawned the moment it crossed
  });

  it('takes a dissolving body out of the broad phase: slices cannot hit it', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.5, shrinkSeconds: 0.5 },
    });
    const id = world.spawn({ geometry: tiny(), position: [0, 0, 0] });
    world.update(0.5); // marked dissolving, removed from the spatial hash
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const outcome = world.slice(createSliceVolume(plane, [0, 0, 0], 2));
    expect(outcome.removed).toEqual([]);
    expect(world.has(id)).toBe(true); // still alive, still shrinking
    world.update(0.6); // age 1.1 >= delay 0.5 + shrink 0.5
    expect(world.has(id)).toBe(false);
  });

  it('exempts dissolving bodies from bounds cleanup until the shrink completes', () => {
    const world = createWorld({
      gravity: [0, 0, 0],
      bounds: { min: [-5, -5, -5], max: [5, 2, 5] },
      smallBodyCulling: { minVolume: 1, delaySeconds: 0.2, shrinkSeconds: 1 },
    });
    const id = world.spawn({ geometry: tiny(), position: [0, 0, 0], velocity: [0, 5, 0] });
    // 13 one-frame steps: age 0.217s crosses the 0.2s delay, sim y = 1.08 (in bounds).
    for (let i = 0; i < 13; i++) {
      world.update(1 / 60);
    }
    expect(world.metadata.get(id)!.dissolving).toBe(true);
    // Continue past the bounds (y > 2 at age ~0.43s): still alive while shrinking.
    for (let i = 0; i < 13; i++) {
      world.update(1 / 60);
    }
    expect(world.bodies.get(id)!.position[1]).toBeGreaterThan(2);
    expect(world.has(id)).toBe(true);
    // The shrink window (delay 0.2 + shrink 1 = age 1.2s) eventually despawns it.
    for (let i = 0; i < 47; i++) {
      world.update(1 / 60);
    }
    expect(world.has(id)).toBe(false);
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

describe('World compound colliders (decomposition)', () => {
  /** A single mesh of two unit boxes separated along x (concave, gap ≈ [0.5,3.5]). */
  function twoSeparatedBoxes(): Mesh {
    const near = createBox(1, 1, 1);
    const far = createBox(1, 1, 1);
    const farShifted = far.positions.map((v, i) => (i % 3 === 0 ? v + 4 : v));
    const offset = near.positions.length / 3;
    return createMesh(
      [...near.positions, ...farShifted],
      [...near.indices, ...far.indices.map((i) => i + offset)],
    );
  }

  const moved = (p: readonly number[]): number =>
    Math.hypot(p[0]! - 2, p[1]!, p[2]!);

  it('lets a body pass through the gap of a decomposed concave body', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    const shell = world.spawn({
      geometry: twoSeparatedBoxes(),
      position: [0, 0, 0],
      mass: 0,
      decompose: true,
    });
    const probe = world.spawn({ geometry: createBox(1, 1, 1), position: [2, 0, 0] });
    expect(world.compoundColliders.has(shell)).toBe(true);
    for (let i = 0; i < 60; i++) {
      world.update(1 / 60);
    }
    // Probe sits in the empty gap between the two hulls: untouched.
    expect(moved(world.bodies.get(probe)!.position)).toBeCloseTo(0, 5);
  });

  it('pushes the same body out when the concave shell is a single hull', () => {
    const world = createWorld({ gravity: [0, 0, 0] });
    world.spawn({
      geometry: twoSeparatedBoxes(),
      position: [0, 0, 0],
      mass: 0,
      decompose: false, // single hull spans the gap
    });
    const probe = world.spawn({ geometry: createBox(1, 1, 1), position: [2, 0, 0] });
    for (let i = 0; i < 60; i++) {
      world.update(1 / 60);
    }
    // The filled hull ejects the probe from the gap.
    expect(moved(world.bodies.get(probe)!.position)).toBeGreaterThan(0.1);
  });
});
