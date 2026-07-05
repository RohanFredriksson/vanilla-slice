# ADR 0005 — Fixed-timestep physics with an engine-owned imperative loop

Status: Accepted · Date: 2026-07-05

## Context

Rendering frame rates are variable and framework change-detection cycles (e.g.
Angular) are unpredictable. Coupling physics to variable frame deltas or to a
framework's lifecycle produces non-deterministic, unstable simulation and ties
the engine to a specific host.

## Decision

- Physics advances on a **fixed timestep**, decoupled from the variable frame
  delta (accumulate frame time; step the simulation in fixed increments).
- The runtime uses an **imperative, engine-owned loop** driven by
  `requestAnimationFrame` at the app layer:

  ```ts
  function animate() {
    world.update(dt);
    renderer.render();
    requestAnimationFrame(animate);
  }
  ```

- **Angular (or any framework) must not control or gate this loop.** The loop
  runs outside framework change detection.

## Consequences

- **Positive:** deterministic-where-possible, stable integration; renderer and
  framework are decoupled from simulation timing; portable across hosts and
  headless environments.
- **Negative:** requires an accumulator and interpolation strategy for smooth
  rendering between fixed steps; developers must resist wiring the loop into
  framework lifecycles.
- **Follow-ups:** define the accumulator and optional render interpolation in
  `physics`/`core` during Phase 3; document loop ownership in `ARCHITECTURE.md`.

## Alternatives considered

- **Variable-timestep integration from raw frame delta:** rejected —
  non-deterministic and unstable under frame spikes.
- **Framework-driven loop (Angular change detection / zone):** rejected —
  couples simulation to the framework and violates the golden rules.
