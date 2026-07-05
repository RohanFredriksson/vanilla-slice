# Slice Engine — Principles (PRINCIPLES.md)

These principles guide every design and implementation decision. When in doubt,
optimize for reuse, boundaries, and clarity over convenience.

## 1. Separation of concerns
Three layers with a strict one-way dependency direction:
Framework integration → Rendering adapters → Core engine. Never the reverse.

## 2. The core is pure
Core packages (`math`, `geometry`, `physics`, `slicing`, `spatial`, `core`) have
no Angular, no Three.js, no DOM, and no browser APIs. They must run headless.

## 3. Rendering is an adapter
Adapters read engine state and produce visuals. They never own simulation state
and never mutate physics/geometry ownership data.

## 4. Composition over inheritance
Use a light ECS: entities carry components; systems operate on components. Avoid
deep inheritance trees.

## 5. Clear ownership
- Physics owns position and velocity.
- Geometry owns mesh data.
- Renderer owns meshes.
- App/game owns score, UI, effects.
- Engine owns simulation only.

## 6. Bounded interactions
A slice is a bounded volume (plane + radius), never an infinite plane. Effects
are localized and spatially filtered.

## 7. Deterministic-where-possible simulation
Fixed timestep, minimal hidden state, reproducible results where feasible.

## 8. Performance by design
Spatial partitioning over O(n) scans; minimal per-frame allocations; pooling in
hot paths; scalable to hundreds of objects.

## 9. Minimal, stable public API
Small, strongly typed, composable surfaces. Prefer stability; evolve via additive
changes and ADRs.

## 10. Documentation is part of the work
Every meaningful decision updates `docs/` and, when it changes direction, adds an
ADR. Code without corresponding docs is incomplete.

## 11. No circular dependencies
Package boundaries are enforced. Introduce a new package or invert a dependency
rather than creating a cycle.

## 12. The engine is not a game
Games and demos are consumers. Keep engine APIs generic enough for non-game
domains (CAD, destruction, VR slicing).
