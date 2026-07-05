# Vanilla Slice — Roadmap (ROADMAP.md)

Status: Draft · Phase: Pre-implementation

The roadmap sequences work from documentation through a working demo. Each phase
gates the next. Implementation does not begin until Phase 2 is approved.

## Phase 0 — Context & Instructions (current)
- [x] Capture design context (`AI_CONTEXT.md`).
- [x] Author Copilot instructions (`.github/copilot-instructions.md`).
- [x] Review and approve golden rules and boundaries.

## Phase 1 — Foundational Documentation
- [x] `SPEC.md`
- [x] `ARCHITECTURE.md`
- [x] `PRINCIPLES.md`
- [x] `ROADMAP.md`
- [x] ADRs 0001–0005
- [x] Stakeholder review and sign-off.

## Phase 2 — Workspace Setup (Nx)
- [x] Create Nx monorepo.
- [x] Scaffold empty packages: `math`, `geometry`, `physics`, `slicing`,
      `spatial`, `core`, `renderer-three`, `angular`.
- [x] Scaffold apps: `spinning-slices`, `slicing-game`.
- [x] Configure dependency-boundary lint rules (enforce one-way layering).
- [x] Configure build caching, testing, and CI.

## Phase 3 — Core Engine (framework-free)
- [x] `math`: vectors, matrices, quaternions.
- [x] `geometry`: mesh representation, plane intersection, mesh splitting, caps.
- [x] `physics`: fixed-timestep integration, rigid bodies, gravity, cleanup.
- [x] `spatial`: broad-phase structure and region/neighbor queries.
- [x] `core`: ECS world, entities, components, systems, `createWorld`/`spawn`.
- [x] Headless tests for all of the above.

## Phase 4 — Slicing
- [x] `slicing`: bounded slice volume, candidate filtering, fragment generation,
      impulse application.
- [x] End-to-end headless slice test (gesture → fragments).

## Phase 5 — Rendering Adapter
- [x] `renderer-three`: engine state → meshes, transform sync, camera, raycasting.
- [x] Verify renderer owns no simulation state.

## Phase 6 — Framework Integration & Demo
- [x] `angular`: canvas hosting + lifecycle (EngineHostComponent) and
      framework-agnostic engine loop + swipe-to-slice input.
- [x] `slicing-game`: Fruit Ninja-style game; imperative loop independent of any
      framework change detection.
- [x] `spinning-slices`: spinning-object slicing showcase.

Run the demos in a browser (Vite dev server; engine packages resolve to source):
- `nx serve slicing-game` → http://localhost:5173
- `nx serve spinning-slices` → http://localhost:5174
- Production bundle: `nx bundle <app>` (outputs `apps/<app>/dist-web`),
  preview with `nx preview <app>`.

## Phase 6.5 — Extract runtime, remove Angular (done, ADR 0006)
- [x] Create `packages/runtime` (framework-agnostic): move `EngineLoop`,
      `SwipeTracker`, `SwipeSlicer`, `intersectRayPlane`, `swipeToSliceVolume`
      and their tests. Depends on `core` + `math`.
- [x] Repoint `slicing-game` and `spinning-slices` at `@vanilla-slice/runtime`.
- [x] Copy `EngineHostComponent` to `docs/examples/angular/` (reference only).
- [x] Delete `packages/angular`; remove `@angular/core`, `rxjs`, `zone.js`,
      `tslib`; drop the `scope:angular` boundary rules, tsconfig paths, and
      references.
- [x] Update ARCHITECTURE / SPEC / copilot-instructions to match.
- [x] Verify build + lint + test; confirm the Angular XSS advisory is gone.

## Phase 7 — Hardening & Publishing
- [ ] Rigid-body collisions on generalised meshes (ADR 0007, on by default):
  - [x] Add inverse inertia tensor (`invInertia`) to `RigidBody`; wire into
        integration.
  - [x] Convex hull generation in `geometry`; compute hulls for slice fragments.
  - [x] GJK + EPA narrow-phase for convex pairs in `physics`; keep the
        `sphereSphereContact` fast path.
  - [x] Contact manifold via face clipping (stable resting contact).
  - [x] `resolveContact` (normal impulse + Coulomb friction + positional
        correction), respecting `invMass`/`invInertia` (static = 0).
  - [x] `resolveCollisions(world)` system wired into `stepPhysics`, on by default
        with a per-world / per-body opt-out (`collides`).
  - [x] Optional approximate convex decomposition for concave meshes.
  - [x] Verify `spinning-slices` (objects no longer phase through); profile and
        tune against the "hundreds of objects" goal.
- [ ] Performance passes (allocation profiling, spatial tuning).
  - [ ] DDA/voxel-walk broad-phase for `querySegment`: visit only the cells a
        segment tube actually passes through instead of iterating its full
        bounding box (O(length / cellSize)). Would let long *bounded* slice
        cylinders prune spatially in dense scenes; unbounded cylinders currently
        sidestep the cost via `queryAll` (ADR 0004 amendment).
- [ ] API stabilization and versioning (ADR 0008).
  - [x] Fixed/lockstep versioning at `0.1.0` across the eight engine packages.
  - [x] Publishable manifests (`publishConfig`, `files`, `sideEffects`, `engines`,
        metadata); apps stay private; `three` as a `renderer-three` peer.
  - [x] `nx release` configured (fixed group, `preVersionCommand` build) + root
        release scripts.
  - [x] ADR 0008 recording the versioning/publishing strategy.
  - [x] Add `repository`/`homepage`/`bugs`/`author` + `LICENSE` file (MIT,
        Rohan Fredriksson); tarballs ship `dist` JS + types only.
  - [ ] Optional per-package `README.md` for npm pages.
  - [ ] Decide `1.0.0` criteria and cut it once the API has settled.
- [ ] npm publishing pipeline for packages (CI + registry auth + provenance).
  - [x] `Release` GitHub Actions workflow on push to `master`: Conventional
        Commits drive the bump; `nx release` versions, changelogs, tags, creates
        the GitHub Release, and publishes to npm (ADR 0008 amendment).
  - [x] CI workflow trigger fixed (`main` → `master`).
  - [ ] Add the `NPM_TOKEN` repository secret and bootstrap the first release
        (`npx nx release 0.1.0 --first-release --yes`).
  - [ ] npm publish provenance / supply-chain attestation.

## AI-DLC operating cadence
- Break phases into small issues on the board:
  `Backlog → Ready → In Progress → Review → Done`.
- No large feature lands without approval.
- Every decision updates docs and, when direction changes, adds an ADR.
