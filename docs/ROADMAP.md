# Slice Engine — Roadmap (ROADMAP.md)

Status: Draft · Phase: Pre-implementation

The roadmap sequences work from documentation through a working demo. Each phase
gates the next. Implementation does not begin until Phase 2 is approved.

## Phase 0 — Context & Instructions (current)
- [x] Capture design context (`AI_CONTEXT.md`).
- [x] Author Copilot instructions (`.github/copilot-instructions.md`).
- [ ] Review and approve golden rules and boundaries.

## Phase 1 — Foundational Documentation
- [x] `SPEC.md`
- [x] `ARCHITECTURE.md`
- [x] `PRINCIPLES.md`
- [x] `ROADMAP.md`
- [x] ADRs 0001–0005
- [ ] Stakeholder review and sign-off.

## Phase 2 — Workspace Setup (Nx)
- [x] Create Nx monorepo.
- [x] Scaffold empty packages: `math`, `geometry`, `physics`, `slicing`,
      `spatial`, `core`, `renderer-three`, `angular`.
- [x] Scaffold apps: `portfolio`, `fruit-demo`.
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
- [ ] `renderer-three`: engine state → meshes, transform sync, camera, raycasting.
- [ ] Verify renderer owns no simulation state.

## Phase 6 — Framework Integration & Demo
- [ ] `angular`: canvas hosting, lifecycle integration, UI components.
- [ ] `fruit-demo`: imperative loop independent of Angular change detection.
- [ ] `portfolio`: showcase integration.

## Phase 7 — Hardening & Publishing
- [ ] Performance passes (allocation profiling, spatial tuning).
- [ ] API stabilization and versioning.
- [ ] npm publishing pipeline for packages.

## AI-DLC operating cadence
- Break phases into small issues on the board:
  `Backlog → Ready → In Progress → Review → Done`.
- No large feature lands without approval.
- Every decision updates docs and, when direction changes, adds an ADR.
