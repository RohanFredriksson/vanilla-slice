# Vanilla Slice — Roadmap (ROADMAP.md)

Status: Living · Phases 0–11 implemented; Phase 7 hardening and follow-ups
ongoing. Phase 11 (textured cut & fracture surfaces, ADR 0010) complete.

The roadmap sequences work from documentation through a working demo. Each phase
gates the next.

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
  - [x] Hull-footprint tipping on the ground half-space (ADR 0007 amendment):
        `resolveHalfSpace` uses the body's convex-hull contact set to build a
        support polygon and applies a toppling angular impulse (`tipFactor`,
        default 12) when the COM projects outside it; sphere fallback otherwise.
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

## Phase 8 — Materials System (ADR 0009, proposed)

Data-driven physical properties, separate from behaviour. **Prerequisite for
Phases 9–10.** Behaviour-neutral: today's defaults remain the fallback.

- [x] New `materials` package (leaf; depends on nothing). `Material` record
      (density, friction, restitution, toughness, brittleness) + `MaterialLibrary`
      registry. Fracture initiation gates on `toughness` (× collider size),
      derived at evaluation time — no stored `fractureThreshold`.
- [x] `MaterialRef` component in `core`; derive mass from material density ×
      geometry volume, and combine per-body restitution/friction in contacts,
      with existing defaults as fallback (materialless bodies unchanged).
- [x] Nx tag `scope:materials` + boundary rule (`→ []`); `scope:materials` added
      to `scope:core`'s allowed deps.
- [x] Headless tests: registry lookup, mass-from-density, default fallback.
- [ ] Defer `hardness`, full `elasticity`, `fracturePropagationFactor`,
      anisotropy, thermal, fatigue, per-face materials (see ADR 0009).

## Phase 9 — Interaction Framework (ADR 0009, proposed)

Generalise the top-level Slice system into a pipeline of stateless processors.
**Depends on Phase 8** (processors resolve materials).

- [x] New `interactions` package (framework only): interaction/event types,
      `InteractionProcessor` interface, evaluator, registry, material-evaluation
      glue. Depends on `materials`, `physics`, `geometry`, `spatial`, `math`.
- [x] Nx tag `scope:interactions` + boundary rule; add to `scope:core` deps.
- [x] `InteractionSystem` in `core` driving a per-step, stably-ordered event
      queue; run after `resolveCollisions`, before cleanup.
- [x] `SliceProcessor` wrapping `slicing`; `sliceWorld` becomes a thin shim that
      enqueues a `slice` event (backward compatible).
- [x] Route `resolveCollisions` to enqueue collision/impact events when impact
      energy exceeds the material threshold.
- [x] Reserve future interaction types (deformation, explosion, laser,
      constraint-failure) as enum values with **no** interfaces yet.
- [x] Headless tests: gesture → slice via framework; collision → event; stable
      ordering / determinism.

## Phase 10 — Fracture Engine (ADR 0009, proposed)

Real-time, material-driven fragmentation. **Depends on Phases 8 and 9.**

- [x] New `fracture` package (sibling of `slicing`): Voronoi cell generation
      (iterative bisector clipping), optional precomputed/normalized patterns,
      deterministic seeded RNG → fragment meshes. Depends on `geometry` (+ its
      transitive `math`); reuses `splitMeshByPlane`/cap infrastructure.
- [x] Nx tag `scope:fracture` + boundary rule; add to `scope:core` deps.
- [x] `FractureProcessor` in `core`: collision/impact-driven (registered for
      `impact`, origin = contact point) and slice-driven (brittle materials
      shatter) fracture gated by material thresholds; spawns fragments + applies
      impulses via the shared `replaceWithFragments` helper (core owns lifecycle).

- [x] Configurable fracture thresholds (via `toughness`), fragment count (via
      `brittleness`), and crack propagation (via `fracturePropagationFactor`:
      energy-amplified fragment count + origin-clustered seed distribution), all
      data-driven.
- [x] Performance guards: per-event fragment budget/cap (`MAX_SEEDS`),
      deterministic RNG, depth-limited (single-pass) generation. Profiling
      against the "hundreds of objects" goal still to do.
- [ ] Defer richer fracture propagation (recursive/energy-attenuated) to a
      follow-up.
- [x] End-to-end demo validation: `spinning-slices` launches glass cubes at a
      static steel slab; glass shatters into Voronoi fragments on impact, steel
      resists — the full collision → impact → material → fracture path, rendered.

## Phase 10.1 — Fracture performance (profiled) — RESOLVED

**Decision (2026-07-06):** instant, deterministic shattering on collision is a
**hard requirement**. The residual worst-case single-frame spike is **accepted**:
it is only reached by extreme materials (very brittle + high propagation taking a
violent hit) and is a rare, one-frame cost. Time-slicing and off-thread fracture
were evaluated and **rejected** for changing the feel (delay) or the look
(pop-in); the exact algorithmic win (neighbour-limited Voronoi) and collider
reuse are shipped.

Motivation: `spinning-slices` showed a brief stutter each time an object
shattered. Profiled 2026-07-06 (CDP CPU profile + rAF frame-timing + headless
micro-benchmarks):

- Frame times are a locked 16.8 ms except single-frame spikes of **~50–83 ms** —
  one per shatter. A transient per-shatter spike, not a sustained regression.
- Headless timing pinned the cause: the demo shatter spawns **~23 fragments** in
  one frame (propagation amplified the count), and `fractureMesh` is **O(n²)** in
  fragment count (each Voronoi cell clips against every other seed):

  | fragments | `fractureMesh` |
  | --------- | -------------- |
  | 8         | ~9 ms          |
  | 16        | ~27 ms         |
  | 23        | ~55 ms         |
  | 32        | ~120 ms        |

  So the 23-fragment shatter is ~55 ms of clipping + ~30 ms for the 23 spawns.
- **Correction to the earlier hypothesis:** the per-fragment convex hull is *not*
  a hotspot (~0.27 ms/fragment; `hullFromConvexMesh` measured no faster than
  `computeConvexHull`). Fragment **count × O(n²) clipping** is the driver.
- **The demo is a near-worst case.** Fragment count is
  `round(base × amplify)` where `base = 2 + round(brittleness×4)` and
  `amplify = 1 + propagation × min(excess, 6)`. The demo's glass stacks all
  multipliers (brittleness 0.85, propagation 0.6, a violent hit ⇒ excess ≈ 8),
  giving ~23 fragments. Typical fractures (tougher/less brittle materials, softer
  hits, lower propagation) produce **~5–10 fragments ≈ 7–13 ms** — a small blip,
  not a stutter. The ~43 ms spike is the ceiling for one object, rarely reached.

Work (done + planned):

- [x] **Reuse fragment colliders.** `hullFromConvexMesh` fast path (geometry);
      `slicing` and `fracture` emit each fragment's centroid-local hull; core
      passes it via `SpawnOptions.collider` so `spawn` skips `computeConvexHull`.
      Removes `slicing`'s double hull compute; neutral for fracture. (Not the
      spike fix, but a clean win — kept.)
- [x] **Neighbour-limited Voronoi — the chosen fix (exact optimisation).** For
      each cell, visit the other seeds in order of increasing distance and stop
      clipping once the nearest remaining bisector can no longer reach the
      shrinking cell (`distance / 2 >= cell radius`). A farther seed's bisector
      lies entirely outside the cell, so skipping it yields the **same geometry**
      as clipping against every seed — no approximation, no fragment overlap —
      while cutting the O(n²) clip toward ~O(n·k). Fully deterministic; all
      existing fracture tests pass unchanged. Measured on the demo's clustered
      23-fragment shatter: `fractureMesh` ~55 ms → ~43 ms; larger gains for more
      spread (higher-propagation) seed distributions. Fracture stays a single,
      immediate operation.
- [x] **Time-slicing — tried and REJECTED.** A `fractureBudget` spread each
      shatter's generation across frames. It removed the frame spike but the
      result looked and felt wrong (collisions felt delayed; the object popped /
      transitioned awkwardly as fragments trickled in), so it was scrapped
      entirely — the engine only ships behaviour we can fully back. Fracture is
      always immediate.
Remaining levers were considered and **deliberately not applied** (they would
compromise instant shattering, detail, or determinism for a rare worst case):

- [ ] **Cap fragment count for realtime (rejected for now).** Lowering
      `MAX_FRACTURE_FRAGMENTS` / the propagation amplification would cut the
      residual spike but trades away shatter detail. Left as a tuning knob.
- [ ] **Off-thread fracture (rejected for now).** A Web Worker keeps the
      framerate smooth and swaps atomically (no pop-in), but still delays the
      shatter by the compute time (~the same latency), breaks the synchronous
      per-frame determinism model (ADR 0005), and — being a browser API — cannot
      live in the headless core (it would sit in the app/runtime layer). Not
      worth it to hide a rare one-frame cost.
- [ ] **Fewer allocations.** Pool `MeshBuilder`/clone buffers to cut GC on
      shatter frames. (Minor; still open as a low-risk future cleanup.)
- [ ] **Sustained-scaling follow-up (separate from the jank).** `syncSpatial`
      re-`insert`s every body every frame; skip static/sleeping bodies. Pairs
      with the deferred DDA broad-phase (Phase 7).

## Phase 11 — Textured Cut & Fracture Surfaces (ADR 0010, proposed)

Textured (UV-mapped) models cut and fracture correctly, and the newly-exposed
interior renders as a believable, material-specific surface (wood grain with
rings/streaks by cut direction, marble, fruit flesh, …), consistent across
fragments. **Depends on Phases 8–10.** Engine gains only neutral data; all
appearance lives in the renderer, keyed by material id (ADR 0010).

- [x] **P1 — Mesh attribute channels (`geometry`).** Add optional `uvs` (2/vtx),
      `tex3` (3/vtx, rest-pose/model-space coordinate), and `groups` (per-triangle
      slot: 0 = exterior skin, 1 = interior). Carry through `cloneMesh` /
      `transformMesh` and core `recenterMesh` / `toWorldMesh`; add `getUv`/`getTex3`
      accessors. Behaviour-neutral (channels absent by default).
- [x] **P2 — Attribute-aware split (`geometry`, fixes slice + fracture).**
      `MeshBuilder` stores channels; interpolate `uv`/`tex3` at the existing clip
      parameter `s`; emit source polys as group 0; fall back to positions-only when
      no attributes. Fracture inherits this via shared `splitMeshByPlane`.
- [x] **P3 — Interior geometry: cap coords (`geometry`).** Cap triangles as group
      1; cap `tex3` = world cap point × inverse model matrix (new
      `SplitOptions.capToMaterialSpace`); planar `uv` from the cap's in-plane basis
      as a 2D fallback.
- [x] **P4 — Core plumbing.** Pass each body's inverse model matrix into
      slice/fracture (`slice-system`, `fracture-system`; `voronoi` forwards
      options); `recenterMesh` keeps channels; surface the entity's `materialId` on
      `RenderItem` so the renderer can resolve an interior appearance.
- [x] **P5 — Renderer interiors (`renderer-three`).** Upload `uv`/`tex3`; coalesce
      `groups` into `geometry.addGroup`; material **array** per entity (slot 0
      exterior via existing `createMaterial`, slot 1 interior from a new
      `InteriorAppearanceRegistry` keyed by `materialId`); interior = triplanar /
      solid shaders sampling `tex3` with presets (procedural wood rings+streaks,
      marble, stone, fruit flesh).
- [x] **P6 — Normal mapping & tangents (two paths).** Exterior (has uv): renderer
      `geometry.computeTangents()` + slot-0 `normalMap`; no engine tangent channel.
      Interior (triplanar/solid): triplanar normal mapping with in-shader TBN from
      `tex3` — no per-vertex tangents; correct relief for cross-cut vs rip-cut,
      stable across fragments.
- [x] **P7 — Tests & demos.** Geometry seam UV/tex3 interpolation + cap group/tex3;
      fracture `tex3` continuity across adjacent cells (reassembly); renderer
      attribute + group upload; exterior tangent attribute present when uv exists;
      interior solid shader compiles + perturbs normals (validated in-browser on
      WebGL). Demos: a wood block in `spinning-slices` (concentric rings on the
      cut) and a watermelon in `slicing-game` (green rind → red flesh).
- [ ] Defer: non-convex cap cross-sections (unchanged assumption); per-face
      material assignment beyond the two-slot exterior/interior split.

## AI-DLC operating cadence
- Break phases into small issues on the board:
  `Backlog → Ready → In Progress → Review → Done`.
- No large feature lands without approval.
- Every decision updates docs and, when direction changes, adds an ADR.
