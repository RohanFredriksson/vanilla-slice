# ADR 0002 — Layered architecture with one-way dependencies

Status: Accepted · Date: 2026-07-05

## Context

The engine must be reusable across frameworks and renderers and beyond games
(CAD, destruction, VR). Coupling simulation to Angular, Three.js, or the DOM
would destroy reuse and testability.

## Decision

Adopt a **three-layer architecture** with a strict one-way dependency direction:

1. **Core Engine (framework-free, headless)** — `math`, `geometry`, `physics`,
   `slicing`, `spatial`, `core`. No Angular, Three.js, DOM, or browser APIs.
2. **Rendering Adapters** — e.g. `renderer-three`. Map engine state to visuals;
   never own simulation state.
3. **Framework Integration** — e.g. `angular`. Canvas hosting, UI, lifecycle;
   never drives the engine loop.

Dependencies flow only downward: framework → adapters → core. Reverse
dependencies are prohibited.

## Consequences

- **Positive:** core is testable headlessly; renderers and frameworks are
  swappable; boundaries prevent accidental coupling; supports non-game reuse.
- **Negative:** requires discipline and adapter code to bridge layers; some
  duplication of view-model mapping in each adapter.
- **Follow-ups:** enforce with Nx dependency-constraint lint rules (see ADR
  0001); document adapter contracts in `ARCHITECTURE.md`.

## Alternatives considered

- **Monolithic engine coupled to Three.js/Angular:** rejected — kills reuse and
  headless testing.
- **Renderer owning simulation state:** rejected — violates ownership rules and
  couples physics to a specific renderer.
