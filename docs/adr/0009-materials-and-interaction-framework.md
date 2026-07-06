# ADR 0009 — Introduce Materials and an Interaction Framework

Status: Accepted · Date: 2026-07-06

> Requested in planning as **"ADR-0006 — Introduce Materials and Interaction
> Framework."** ADR numbers in this repo are append-only and 0006 is already
> taken (`0006-framework-integrations-out-of-repo`), so this record is numbered
> **0009** (0001–0008 exist). The title is preserved.

This ADR began as an **architectural redesign and documentation exercise** and is
now **approved for phased implementation** (see ROADMAP Phases 8–10); Phase A
(the `materials` package) is in progress. It supersedes the "slicing is a
top-level capability" assumption of ADR 0002/0003 by generalising slicing into
one of many *interactions*.

## Context

The engine currently models **slicing as a top-level core system**
(`sliceWorld` in `packages/core/src/slice-system.ts`): a bespoke pipeline of
broad-phase query → candidate filter → mesh split → fragment spawn → impulse.
Collision was added later (ADR 0007) as `resolveCollisions`, another top-level
core system.

A new requirement — **real-time material fracturing** — exposes an architectural
limitation. Fracturing is not a direct cutting operation; it is driven by
*material behaviour* and *physical interaction* (a collision whose energy exceeds
a material threshold). Adding a standalone `FractureSystem` beside `SliceSystem`
would:

- duplicate the shared shape of every such feature
  (event → candidate → material check → geometry response → physics response →
  cleanup);
- grow the number of ad-hoc top-level systems in `core` linearly with each new
  interaction (impact, deformation, explosion, laser, constraint failure …);
- hard-code object behaviour into systems rather than deriving it from data
  ("fruit slices, glass fractures, steel resists") — violating the data-driven
  goal.

Looking forward, slicing is only **one interaction** an object may experience.
The requested future set is: Slice, Fracture, Collision response, Impact
response, and (later) Deformation, Explosion, Laser cutting, Constraint failure.

### Architecture review (Deliverable 1)

Two abstractions were evaluated against the golden rules (framework-agnostic
headless core, renderer abstraction, one-way layering, composition over
inheritance, data-driven design, no circular deps):

1. **Material System** — a *data* description of physical properties, separate
   from behaviour. **Verdict: improves the architecture.** It removes hidden,
   type-specific branching from systems; makes behaviour reproducible and
   tunable per object; and gives fracture/slice/collision a single source of
   truth for thresholds. It is a pure leaf package (like `math`), so it adds no
   coupling risk and no headless/renderer concerns.

2. **Interaction Framework** — a generalisation of "slice system" into a
   pipeline of typed **interaction processors** sharing one evaluation phase.
   **Verdict: improves the architecture** *if kept thin*. It collapses N bespoke
   top-level systems into one `InteractionSystem` + a registry of stateless
   processors, preserves composition-over-inheritance, and lets new interactions
   land without further high-level redesign. The main cost is API surface and
   `core` fan-in, addressed under Risks and Migration.

Both are adopted, phased, and thin-first (Slice + Fracture only).

## Decision

Introduce a **Material System** and a **generalised Interaction Framework**, and
refactor slicing and collision to flow through the framework. Slicing remains a
package; it stops being a top-level system and becomes a **Slice interaction**.

### 1. New packages (Deliverable 3)

| Package                 | Layer      | Responsibility                                                                                 | Depends on                                             |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `materials`             | core       | Pure data: `Material` records, a `MaterialLibrary` registry, property lookup. **No behaviour.** | *(nothing — leaf, like `math`)*                        |
| `interactions`          | core       | The framework only: interaction/event types, `InteractionProcessor` interface, evaluator, registry, material evaluation glue. **No concrete heavy processors.** | `materials`, `physics`, `geometry`, `spatial`, `math`  |
| `fracture`              | core       | Pure geometry: Voronoi cell generation, precomputed pattern application, propagation → fragment meshes. Sibling of `slicing`. **No world / no impulse resolution.** | `geometry`, `spatial`, `math`                          |

Rationale for each:

- **`materials` as a leaf.** Materials describe properties, never behaviour, and
  are consumed by physics-adjacent evaluation, slicing, and fracture. Making it
  a dependency-free leaf keeps it maximally reusable and cycle-proof, mirroring
  `math`.
- **`interactions` holds only the framework.** Keeping concrete, world-mutating
  processors *out* of this package prevents an `interactions → core` cycle (core
  owns entity lifecycle) and keeps the framework headless and testable.
- **`fracture` mirrors `slicing`.** Both are pure geometry generators with no
  knowledge of the ECS world; `core` owns spawn/despawn and impulse application
  for their outputs (existing ownership rule). This reuses the convex-hull and
  split infrastructure already in `geometry` (ADR 0007).

**Concrete processors** (`SliceProcessor`, `FractureProcessor`) are **registered
by `core`**, not by `interactions`, because only `core` owns entity lifecycle —
exactly where `sliceWorld` lives today. This is the minimal, boundary-preserving
change.

### 2. Interaction model — *processors*, not systems/plugins/services (Deliverable, "Interaction Framework Investigation")

Interactions are modelled as **stateless processors driven by a single
`InteractionSystem`**, over an evaluation pipeline:

```
event → resolve material → evaluate (which processor applies?) → apply (geometry + physics response)
```

Sketch (illustrative, not final):

```ts
// packages/interactions
type InteractionType =
  | 'slice' | 'fracture' | 'collision' | 'impact'
  // reserved for future milestones (no interfaces yet):
  | 'deformation' | 'explosion' | 'laser' | 'constraint-failure';

interface InteractionEvent {
  type: InteractionType;
  entity: EntityId;              // primary target
  other?: EntityId;              // e.g. the colliding body
  contact?: Contact;            // from physics narrow-phase (impact/collision)
  volume?: SliceVolume;         // from a slice gesture
  energy?: number;              // impact energy, for threshold checks
}

interface InteractionContext {
  world: WorldPort;             // spawn/despawn/query port implemented by core
  material: Material;           // resolved from the entity's MaterialRef
  event: InteractionEvent;
}

interface InteractionDecision { applies: boolean; /* fragment budget, pattern… */ }

interface InteractionProcessor {
  readonly type: InteractionType;
  evaluate(ctx: InteractionContext): InteractionDecision;   // pure, data-driven
  apply(ctx: InteractionContext, d: InteractionDecision): InteractionOutcome;
}
```

**Justification for "processor" over the alternatives:**

- **Systems (status quo).** One top-level system per interaction → duplication,
  no shared evaluate/material step, `core` grows a new system per feature.
  Rejected as the primary model (it is what we are generalising away from).
- **Plugins.** Implies dynamic/runtime loading and external registration;
  weakens typing and determinism for no benefit in a compiled, headless engine.
  Rejected.
- **Services.** Implies stateful singletons / dependency injection; conflicts
  with the pure-function ECS-system model and the fixed-timestep determinism
  requirement (ADR 0005). Rejected.
- **Processors (chosen).** Stateless, strongly-typed, composable units sharing
  one pipeline and one driving system. New interaction = new processor + a
  registry entry; no architectural redesign. Matches composition-over-
  inheritance and data-driven design.

### 3. Material System API (Deliverable, "Material System Requirements")

Materials are **data**, resolved via a registry; entities carry a lightweight
`MaterialRef` component (a material id), never embedded behaviour — satisfying
"glass fractures / fruit slices / steel resists, purely from material data."

**Initial API (Materials M1 — implement now):**

```ts
interface Material {
  readonly id: string;
  density: number;            // kg/m³ — derives mass from geometry volume
  friction: number;           // Coulomb coefficient (today a world/body default)
  restitution: number;        // bounciness (cheap proxy for elasticity)
  toughness: number;          // intrinsic resistance to fracture (energy per unit
                              // crack area); the initiation gate. The effective
                              // per-object threshold = toughness × collider size,
                              // derived at evaluation time (not stored).
  brittleness: number;        // ductile↔brittle bias → base fragment count
  fracturePropagationFactor: number; // 0..1 how far a crack spreads: amplifies
                              // fragment count with excess impact energy and the
                              // spatial reach of seeds from the impact origin
}

interface MaterialLibrary {
  register(m: Material): void;
  get(id: string): Material;   // throws / returns a default on miss
}
```

`fractureThreshold` is deliberately **not** a stored material property:
toughness is intrinsic (per unit crack area) while a trigger threshold also
depends on object geometry (size, cross-section, stress concentration). Storing
both invites inconsistent data for the same material; instead the effective
threshold is derived at evaluation time as `toughness × collider size`, so one
material behaves correctly on small and large objects automatically.

**Deferred properties (later milestones — reserved, not implemented now):**

- `hardness` — needs a scratch/indentation model (Deformation milestone).
- full `elasticity` / stiffness (stress–strain) — `restitution` is the M1 proxy;
  a real elastic model is deferred until Deformation.
- anisotropy / grain direction, thermal properties, fatigue / accumulated
  damage, per-face material assignment — deferred until there is a concrete
  consumer.

Rationale: ship the smallest set that lets mass, collision response, and
threshold-based fracture be data-driven; add properties only when a milestone
consumes them, to avoid speculative API surface.

### 4. Collision integration (Deliverable, "Collision Integration")

Collision *detection* stays in `physics` / `resolveCollisions` (ADR 0007).
The refined flow decouples detection from interaction resolution via a
**per-step event queue**, improving on the conceptual flow in the request:

```
collision solve (physics)                      // per substep, applies normal response
  └─ if impact energy > material.toughness × collider size → enqueue InteractionEvent
InteractionSystem.drain()                       // once, after the solve
  └─ per event: resolve material → processors.evaluate → apply winning response
       → fracture | slice | ignore | (future response)
cleanup
```

**Improvement over the conceptual example:** an explicit event queue and a
distinct resolution phase mean geometry mutation (spawn/despawn of fragments)
never happens *inside* the collision solver loop — avoiding re-entrancy and
preserving deterministic, stable ordering under the fixed timestep (ADR 0005).
Slice gestures enqueue the same event type, unifying input-driven and
collision-driven interactions through one path.

### 5. Slice integration (Deliverable, "Slice Integration")

**Recommendation: slicing becomes a Slice *interaction* (a processor), while the
`slicing` package is retained unchanged as a pure geometry generator.**

- The `slicing` package (bounded volume, candidate filter, mesh split, fragment
  generation — ADR 0004) stays a core-layer geometry package.
- Its *invocation path* moves out of the bespoke `sliceWorld` system into a
  `SliceProcessor` registered with the framework.
- For backward compatibility, `sliceWorld(world, volume)` is retained as a thin
  shim that enqueues a `slice` interaction event and drives the framework, so
  existing public API and tests keep working during and after migration.

Reasoning: this preserves the bounded-volume slice model and all existing
geometry code, removes the "slicing is special/top-level" assumption, and gives
slice and fracture a shared evaluation/material step.

## Consequences

- **Positive:** one extensible pipeline for all present and future interactions;
  data-driven behaviour (no object-type branching in systems); a single source
  of truth for physical properties; fracture, slice, and collision share
  evaluation and thresholds; boundaries and the one-way layering (ADR 0002) are
  preserved; reuses convex-hull/split infrastructure (ADR 0007) and the
  fixed-timestep model (ADR 0005).
- **Negative:** three new packages and a non-trivial type surface; `core` fan-in
  grows by three; a temporary dual path for slicing during migration; Voronoi
  fracture adds real geometry-processing and memory cost that must be budgeted
  and profiled.
- **Determinism:** the interaction event queue must have a stable order (sort by
  entity id, then contact index) and processors must be pure and use fixed
  iteration counts — extending the ADR 0005 / 0007 determinism requirement.

### Architectural risks (Deliverable 8)

| Risk                        | Impact                                                      | Mitigation                                                                                          |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Package coupling            | `core` now depends on `interactions`, `materials`, `fracture`. | Keep `interactions` a thin framework; concrete processors isolated in `core`; `materials` a leaf.  |
| API complexity              | Over-general interaction/material/event surface.           | Ship Slice + Fracture only; future types are reserved enum values with **no** interfaces yet.       |
| Runtime performance         | Per-contact material lookup + evaluation each step.         | Integer-id material registry; threshold pre-check *before* enqueue; pooled event objects.            |
| Memory usage                | Voronoi fracture can explode fragment counts.              | Per-event fragment budget/cap; pooling; depth-limited propagation; optional precomputed patterns.   |
| Geometry processing cost    | Voronoi / convex clipping is expensive, worse when concave. | Precomputed patterns; per-frame time budget; reuse ADR 0007 hull/decomposition; async off-thread later. |
| Long-term maintainability   | Two ways to trigger slicing during migration.             | `sliceWorld` becomes a thin shim and is removed after migration; this ADR governs the single path.  |
| Re-entrancy                 | Spawning fragments inside the collision solver.           | Deferred event-queue phase runs geometry mutation after the solve, never within it.                 |

## Migration strategy (Deliverable 6)

Phased and independently shippable; no big-bang, boundaries preserved throughout:

- **Phase A — Materials (ROADMAP Phase 8).** Add `materials` (data + registry)
  and a `MaterialRef` component. Derive mass/restitution/friction from material,
  with today's defaults as fallback → behaviour-neutral.
- **Phase B — Interaction Framework (ROADMAP Phase 9).** Add `interactions`
  (types, evaluator, registry) and the `InteractionSystem`. Wrap existing
  slicing as `SliceProcessor`; `sliceWorld` delegates to it. Route
  `resolveCollisions` through the event queue.
- **Phase C — Fracture Engine (ROADMAP Phase 10).** Add `fracture` (Voronoi +
  patterns + propagation) and `FractureProcessor`. Wire collision/impact-driven
  fracture via material thresholds.

Dependencies: B depends on A (processors resolve materials); C depends on A and B
(fracture is a processor gated by material thresholds).

## Alternatives considered

- **Standalone `FractureSystem` beside `SliceSystem` (no framework).** Rejected:
  duplicates the shared pipeline, grows top-level systems per feature, and
  keeps behaviour non-data-driven — the exact limitation this ADR addresses.
- **Materials as behaviour (methods on a material class).** Rejected: couples
  material to geometry/physics, breaks data-driven design and headless purity,
  and reintroduces inheritance. Materials stay pure data.
- **`interactions` owning concrete world-mutating processors.** Rejected: forces
  `interactions → core` (core owns entity lifecycle), creating a cycle. Concrete
  processors live in `core`; the framework stays world-agnostic via a port.
- **Plugins / services for interactions.** Rejected: dynamic loading / stateful
  DI conflict with the compiled, headless, deterministic fixed-timestep model.
- **Fracture inside `slicing`.** Rejected: overloads a bounded-cut package with
  volumetric Voronoi generation; a sibling `fracture` package keeps
  responsibilities and dependencies clean.

## References

- ADR 0002 — Layered architecture (one-way layering preserved).
- ADR 0003 — Light ECS (processors keep composition over inheritance).
- ADR 0004 — Bounded slice volume (retained; slice becomes an interaction).
- ADR 0005 — Fixed-timestep loop (determinism requirement extended to events).
- ADR 0007 — Rigid-body collisions / convex hulls (reused by fracture and
  impact evaluation).
- `docs/ARCHITECTURE.md` §§9–12 (proposed layers, dependency graph, runtime flow).
- `docs/ROADMAP.md` Phases 8–10.
