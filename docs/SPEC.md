# Vanilla Slice — Specification (SPEC.md)

Status: Living · Core engine, slicing, rendering, runtime, materials, the
interaction framework, and fracture are implemented (ADRs 0001–0009).

## 1. Overview

Vanilla Slice is a reusable TypeScript engine providing real-time physics
simulation, mesh slicing, geometry processing, spatial queries, and rendering
via adapters. It is framework-agnostic and renderer-agnostic. Games and demos
consume the engine; the engine is never a game itself.

## 2. Goals

- Framework-agnostic core with zero UI/rendering dependencies.
- Renderer-agnostic design; Three.js is the first adapter, not a requirement.
- Highly modular, publishable npm packages within an Nx monorepo.
- Reusable beyond games (CAD, destruction systems, VR slicing).
- Deliver a Fruit Ninja-style slicing demo as the primary showcase.

## 3. Non-Goals

- The engine is not a game framework or scene editor.
- No opinionated UI toolkit inside the engine.
- No coupling to Angular, the DOM, or a specific renderer in core packages.
- No networking/multiplayer in the initial scope.

## 4. Stakeholders & Consumers

- **Engine developers** — maintain core packages and adapters.
- **App developers** — build demos and sites consuming published packages.
- **Future integrators** — non-game domains (CAD, destruction, VR).

## 5. Functional Requirements

### 5.1 World & Simulation
- FR-1: Create a simulation world with configurable gravity.
- FR-2: Spawn entities with geometry, mass, and initial velocity.
- FR-3: Advance simulation by a delta time via `world.update(dt)`.
- FR-4: Remove entities that leave configured bounds (cleanup).

### 5.2 Physics
- FR-5: Apply gravity and integrate motion with a fixed timestep.
- FR-6: Represent rigid bodies (position, velocity, mass).
- FR-7: Provide simple collision detection (broad-phase first).
- FR-8: Remain independent of rendering.

### 5.3 Geometry
- FR-9: Represent meshes (vertices, triangles).
- FR-10: Compute plane–triangle intersections.
- FR-11: Split a mesh by a plane into sub-meshes.
- FR-12: Generate caps on cut surfaces.

### 5.4 Slicing
- FR-13: Convert an input gesture into a world-space ray.
- FR-14: Build a bounded slice volume (plane + radius constraint).
- FR-15: Query the spatial system for candidate entities.
- FR-16: Filter candidates to those intersecting the slice volume.
- FR-17: Perform mesh split and generate fragments.
- FR-18: Apply physics impulses to fragments.

### 5.5 Spatial
- FR-19: Maintain a broad-phase acceleration structure (hash/octree/BVH).
- FR-20: Answer region and neighbor queries without O(n) scans.

### 5.6 Rendering (adapter)
- FR-21: Map engine bodies to renderer meshes.
- FR-22: Sync transforms each frame from engine state.
- FR-23: Provide camera and raycasting utilities.
- FR-24: Never own or mutate simulation state.

### 5.7 Runtime & Framework Integration
- FR-25: Provide a framework-agnostic imperative loop (`runtime`) that ticks the
  engine and forwards input (swipe-to-slice); the engine drives the loop.
- FR-26: Framework integrations (Angular, React, …) live in their own
  repositories, consuming the engine + `runtime`; they host a canvas and manage
  lifecycle but must not drive or gate the engine update/render loop.

### 5.8 Materials (data-driven behaviour)
- FR-27: Describe physical properties as data via a `Material` (density,
  friction, restitution, toughness, brittleness); a `MaterialLibrary` registers
  and resolves materials by id.
- FR-28: Reference a material from an entity via a `MaterialRef` component;
  derive body mass from `density × volume` and combine per-body
  restitution/friction in contacts, falling back to defaults for materialless
  bodies.
- FR-29: Contain no behaviour in `materials`; interactions read material data to
  decide responses (no object-type branching).

### 5.9 Interactions & Fracture
- FR-30: Model interactions (slice, fracture, impact, …) as stateless
  **processors** registered with an `InteractionSystem`, dispatched over a
  per-step event queue after the physics solve (`event → resolve material →
  evaluate → apply`).
- FR-31: Dispatch slicing as a slice interaction; retain `sliceWorld`/`world.slice`
  as a backward-compatible entry point.
- FR-32: Emit `impact` interaction events from collisions when impact energy
  exceeds a material's fracture threshold (`toughness × object size`).
- FR-33: Fracture a mesh into fragments via Voronoi decomposition (runtime
  generation, optional precomputed patterns, deterministic seeding); core spawns
  the fragments and applies the impulses geometry computed.

## 6. Non-Functional Requirements

- NFR-1: Fixed-timestep, deterministic-where-possible physics.
- NFR-2: Scalable to hundreds of simultaneous objects at interactive rates.
- NFR-3: Minimal per-frame allocations in hot paths.
- NFR-4: Strong typing across all public APIs.
- NFR-5: Headless execution (no DOM) for core packages, enabling testing.
- NFR-6: No circular dependencies between packages.

## 7. Public API (target shape)

```ts
const world = createWorld({ gravity: [0, -9.81, 0] });

world.spawn({
  geometry,
  mass: 1,
  velocity: [1, 5, 0],
});

function animate() {
  world.update(dt);
  renderer.render();
  requestAnimationFrame(animate);
}
```

The public surface must be minimal, strongly typed, stable, composable, and
framework-agnostic.

## 8. Constraints

- No Angular in core.
- No Three.js in the core (`math`, `materials`, `geometry`, `physics`, `spatial`,
  `slicing`, `fracture`, `interactions`, `core`).
- No DOM in the engine.
- Rendering is an adapter only.
- One-way dependency flow: framework → adapters → core.

## 9. Acceptance Criteria (initial milestone)

- Core packages compile and test headlessly with no renderer/framework deps.
- A world can spawn bodies, apply gravity, integrate motion, and cleanup.
- A slice gesture produces fragments with impulses in a headless test.
- Three.js adapter renders engine state without owning simulation.
- The slicing-game demo runs the imperative loop independent of any framework.

## 10. Open Questions

- Spatial structure choice for first milestone (hash vs. octree vs. BVH) — see
  ADR backlog.
- Collision resolution depth for the first release (detection only vs. response).
- Fragment count/limits and pooling strategy for performance.
