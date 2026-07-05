# ADR 0001 — Use an Nx monorepo

Status: Accepted · Date: 2026-07-05

## Context

Vanilla Slice is composed of many small, independently reusable packages
(`math`, `geometry`, `physics`, `slicing`, `spatial`, `core`, `renderer-three`,
`angular`) plus consuming apps (`portfolio`, `fruit-demo`). We need enforced
package boundaries, fast incremental builds, consistent tooling, workspace
linking during development, and a path to publishing packages to npm.

## Decision

Use an **Nx monorepo** to host all packages and apps.

- Packages live under `packages/`; apps under `apps/`.
- Nx project boundaries and lint rules enforce the one-way dependency direction
  (framework → adapters → core).
- Nx caching accelerates builds and tests across the graph.
- Workspace linking enables local development without publishing.
- Nx provides the release/publishing pipeline for npm packages later.

## Consequences

- **Positive:** enforced boundaries, cache-accelerated CI, single toolchain,
  straightforward cross-package refactors, ready for multi-package publishing.
- **Negative:** Nx introduces a learning curve and configuration overhead; the
  team must maintain project graph and boundary rules.
- **Follow-ups:** configure dependency-constraint lint rules in Phase 2 to make
  the golden layering rules mechanically enforced.

## Alternatives considered

- **Multiple standalone repos:** rejected — high coordination cost, no shared
  cache, harder cross-package changes.
- **npm/pnpm workspaces without Nx:** rejected — lacks the task graph, caching,
  and boundary enforcement Nx provides out of the box.
