# ADR 0003 — Light Entity-Component-System (ECS) model

Status: Accepted · Date: 2026-07-05

## Context

Simulation objects combine varied concerns: physics bodies, renderable meshes,
sliceable geometry, and metadata. A deep inheritance hierarchy would be rigid,
hard to compose, and couple unrelated concerns.

## Decision

Use a **light Entity-Component-System** model.

- **Entities** are ids with attached components.
- **Components** are plain data: `Body` (physics), `Renderable`, `Sliceable`,
  `Metadata`.
- **Systems** operate over components, not inheritance trees:
  `PhysicsSystem`, `SpatialSystem`, `SliceSystem`, `RenderSystem`,
  `CleanupSystem`.

Behavior lives in systems; state lives in components; entities are the join.

## Consequences

- **Positive:** composition over inheritance; easy to add behavior via new
  systems/components; clear ownership; friendly to data-oriented performance and
  minimal allocations.
- **Negative:** indirection relative to OOP objects; requires conventions for
  component storage and system scheduling.
- **Follow-ups:** define component storage strategy and system execution order in
  `core` during Phase 3; keep it "light" — avoid over-engineering a full ECS
  framework unless a concrete need arises.

## Alternatives considered

- **Classic OOP inheritance (GameObject subclasses):** rejected — poor
  composition, tight coupling, brittle hierarchies.
- **Full-featured third-party ECS:** deferred — unnecessary weight for current
  scope; revisit if performance/scaling demands it.
