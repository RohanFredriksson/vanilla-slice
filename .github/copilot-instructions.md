# Vanilla Slice — Copilot Instructions

These instructions are binding for all AI-assisted work in this repository. They
are derived from `AI_CONTEXT.md` and the documents under `docs/`. When any
instruction here conflicts with a request, surface the conflict before acting.

## What this project is

**Vanilla Slice** is a reusable, framework-agnostic, renderer-agnostic TypeScript
engine for real-time physics, mesh slicing (Fruit Ninja-style), geometry
processing, and spatial queries. It is **not** a game. Games and demos are
*consumers* of the engine.

## Golden rules (never violate)

1. **No Angular in the core.** Core packages must not import Angular.
2. **No Three.js in physics/geometry/slicing/spatial/math/core.** Rendering is an
   adapter only.
3. **No DOM or browser APIs in the engine.** The engine must run headless.
4. **No circular dependencies** between packages.
5. **Rendering is an adapter layer.** It reads engine state; it never owns
   simulation state.
6. **Angular never controls the render/update loop.** The loop is imperative and
   engine-driven (`requestAnimationFrame` at the app layer).

## Layering

```
Core Engine (framework-free)  →  Rendering Adapters  →  Runtime / Consumers
math, geometry, physics,          renderer-three         runtime (loop + input),
slicing, spatial, core                                   apps, external framework
                                                         integrations
```

Allowed dependency direction is one-way: consumers depend on adapters/runtime,
adapters and runtime depend on core; never the reverse. **Framework integrations
(Angular, React, …) live in their own repositories** (ADR 0006), not here.

## Package boundaries

```
packages/math        # vectors, matrices, quaternions — zero deps
packages/geometry    # mesh representation, plane intersection, mesh splitting
packages/physics     # gravity, integration, rigid bodies, collision, cleanup
packages/slicing     # slice volume, candidate filtering, fragment generation
packages/spatial     # spatial hash / octree / BVH broad-phase queries
packages/core        # ECS world, entity/component/system orchestration
packages/renderer-three  # engine state → Three.js meshes, raycasting
packages/runtime     # framework-agnostic engine loop + swipe-to-slice input

apps/slicing-game      # Fruit Ninja-style slicing game
apps/spinning-slices   # spinning-object slicing showcase
```

The engine is framework-agnostic: no framework package lives in this repo. A
reference Angular host is kept at `docs/examples/angular/` (not built/tested).

Dependency rules:
- `math` depends on nothing.
- `geometry`, `physics`, `spatial` depend only on `math`.
- `slicing` depends on `geometry`, `spatial`, `math`.
- `core` orchestrates the above; it depends on core packages, not adapters.
- `renderer-three` depends on `core` + `math` + Three.js.
- `runtime` depends on `core` + `math`; never the reverse.
- apps depend on `core`, `renderer-three`, and `runtime`.

## Architecture model

Light **Entity-Component-System (ECS)**:
- **Entities** are ids with attached components (`Body`, `Renderable`,
  `Sliceable`, `Metadata`).
- **Systems** operate on components, not inheritance trees:
  `PhysicsSystem`, `SliceSystem`, `SpatialSystem`, `RenderSystem`,
  `CleanupSystem`.

## Slicing model

A slice is a **bounded interaction volume**, never an infinite plane:
gesture → world ray → slice plane + radius constraint → spatial query →
candidate filter → mesh split → fragment generation → physics impulse → cleanup.

## Ownership rules

- Physics owns position and velocity.
- Geometry owns mesh data.
- Renderer owns meshes.
- Game/app owns score, UI, effects.
- Engine owns simulation only.

## Performance constraints

- Fixed-timestep physics.
- Spatial partitioning; avoid O(n) broad-phase scans.
- Minimal per-frame allocations.
- Deterministic where feasible; scalable to hundreds of objects.

## Public API philosophy

Minimal, strongly typed, stable, composable, framework-agnostic. Example shape:

```ts
const world = createWorld({ gravity: [0, -9.81, 0] });
world.spawn({ geometry, mass: 1, velocity: [1, 5, 0] });
```

## AI-DLC workflow rules

- Do **not** implement large features without explicit approval.
- Keep documentation (`docs/`) and ADRs current with every decision.
- Respect existing ADRs; propose a new ADR to change a prior decision.
- Maintain package boundaries in every change.
- Prefer small, reviewable issues/PRs. Board flow:
  `Backlog → Ready → In Progress → Review → Done`.

## Current phase

**Pre-implementation.** Documentation and ADRs are being established. Do not
write engine implementation code until the roadmap says implementation begins.
