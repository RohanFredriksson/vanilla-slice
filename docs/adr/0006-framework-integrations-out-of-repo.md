# ADR 0006 — Framework integrations live outside the engine monorepo

Status: Accepted · Date: 2026-07-05 · Implemented: 2026-07-05

## Context

The engine's guiding principle is framework-agnosticism: *"Angular is NOT part
of the engine"* (AI_CONTEXT, `copilot-instructions.md`, ADR 0002). Yet the
monorepo currently ships an in-repo `packages/angular` framework-integration
package. In practice this package has proven to be the odd one out:

- It is the **only** framework-coupled package. Every other package is
  framework-agnostic; the sole external dependency elsewhere is `three`, isolated
  in the rendering adapter.
- It drags in a heavy dependency tree (`@angular/core`, `rxjs`, `zone.js`,
  `tslib`) and is the **single source** of a current high-severity Angular XSS
  advisory whose only fix is a breaking Angular major upgrade.
- It requires bespoke TypeScript configuration (`experimentalDecorators`,
  `emitDecoratorMetadata`, `useDefineForClassFields: false`) that exists for this
  one package, and a "proper" Angular library really wants `ng-packagr` /
  `@angular/build` plus browser test tooling — all of which fight the lean
  `tsc` + `vitest` setup.
- Framework adapters track their framework's release cadence and should not gate
  the engine's releases. Keeping Angular in-repo also privileges it over other
  potential integrations (React, Vue, Svelte).

Critically, **most of `packages/angular` is not Angular**. `EngineLoop`,
`SwipeTracker`, `SwipeSlicer`, `intersectRayPlane`, and `swipeToSliceVolume` are
framework-agnostic and fully unit-tested. Only `EngineHostComponent` is
Angular-specific.

## Decision

1. **The monorepo stays framework-agnostic.** Framework integrations (Angular,
   React, …) live in their **own repositories**, consuming the published engine
   packages. No framework-integration layer ships in this repo.

2. **Relocate the framework-agnostic runtime** — `EngineLoop`, `SwipeTracker`,
   `SwipeSlicer`, `intersectRayPlane`, `swipeToSliceVolume` — into a new
   `packages/runtime` package. It depends only on `core` + `math`, is a
   browser-runtime helper (so it may use the `DOM` lib and
   `requestAnimationFrame`), and is consumed by the demo apps and by any external
   framework adapter.

3. **Remove `packages/angular`** along with its `@angular/core`, `rxjs`,
   `zone.js`, and `tslib` dependencies, eliminating the security advisory and the
   bespoke tsconfig.

4. **Keep a reference copy** of the Angular host component under
   `docs/examples/angular/` (documentation only, not built or tested) so external
   integrators have a starting point.

5. **Update package boundaries.** Drop the `scope:angular` / `layer:framework`
   constraints; add a boundary tag for `runtime`. Apps depend on `core`,
   `renderer-three`, and `runtime`.

## Consequences

- **Positive:** the monorepo becomes purely framework-agnostic (matching its
  stated identity); the dependency surface shrinks and the Angular XSS advisory
  disappears; tooling simplifies (no decorators/`ng-packagr`); engine releases
  decouple from any framework; all framework integrations are treated equally as
  external consumers; the genuinely reusable loop/input logic is preserved in a
  clearly-named package.
- **Negative:** the Angular integration becomes a separate repo to maintain; the
  in-repo reference example must be kept current by hand; external integrators
  wire their own framework glue.

## Relationship to prior ADRs

Refines the package structure of **ADR 0002** (layered architecture). The
one-way dependency rule is unchanged; this ADR removes the in-repo
framework-integration layer and moves the imperative loop to a framework-agnostic
`runtime` package at the boundary between the engine and its consumers. When this
ADR is implemented, `ARCHITECTURE.md`, `SPEC.md`, `ROADMAP.md`,
`copilot-instructions.md`, and the eslint boundary constraints are updated to
match.

## Migration plan (tracked in ROADMAP)

1. Create `packages/runtime`; move the framework-agnostic modules and their
   tests; add its tag + boundary constraints and tsconfig/paths.
2. Repoint `apps/fruit-demo` and `apps/portfolio` at `@vanilla-slice/runtime`.
3. Copy `EngineHostComponent` to `docs/examples/angular/` for reference.
4. Delete `packages/angular`; remove `@angular/core`, `rxjs`, `zone.js`,
   `tslib`; drop `scope:angular` boundary rules and tsconfig paths/references.
5. Update ARCHITECTURE / SPEC / ROADMAP / copilot-instructions.
6. Verify the whole workspace (build + lint + test) and confirm the advisory is
   gone.

## Alternatives considered

- **Keep `packages/angular` in-repo:** rejected — contradicts the
  framework-agnostic goal, retains heavy deps and the advisory, and privileges
  Angular over other frameworks.
- **Adopt `ng-packagr` / `@angular/build` and full Angular app tooling:**
  rejected — heavy divergence from the lean `tsc`/`vitest` workspace for a layer
  that shouldn't live here at all.
- **Duplicate the loop/input into each app:** rejected — code duplication across
  demos.
- **Fold the loop into `core`:** rejected — `core` must stay headless (no DOM,
  golden rule #3); `requestAnimationFrame` belongs in a browser-runtime package.
