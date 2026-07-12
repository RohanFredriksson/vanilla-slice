# ADR 0007 — Rigid-body collisions on generalised meshes via convex hulls

Status: Accepted · Date: 2026-07-05

## Context

The engine currently simulates gravity, integration, and cleanup, plus a single
static ground half-space (`resolveHalfSpace`). Bodies **do not collide with each
other** — they interpenetrate freely. The demos (notably `spinning-slices`)
expose this: objects phase through one another.

Two capabilities are wanted:

1. **Realistic collisions between arbitrary mesh shapes.** Because slicing
   produces fragments of arbitrary geometry at runtime (see ADR 0004 and
   `geometry/split.ts`), a collision system cannot assume boxes or spheres. It
   must handle generalised triangle meshes, including newly generated fragments.
2. **Immovable (infinite-mass) obstacles.** Objects that participate in
   collision but never move — e.g. walls, pillars, blades.

Relevant existing building blocks:

- **Infinite mass already exists.** `RigidBody.invMass === 0` marks a static
  body; `createBody({ mass: 0 })` (or non-finite mass) produces one, and
  `isStatic` / `getMass` already reason about it. No new state is needed to make
  a body *immovable* — only to make it *collide*.
- **Broad-phase already exists.** The spatial hash provides
  `getPotentialPairs()` (unique candidate pairs, no O(n²) scan) and the `World`
  keeps it synced each frame via `syncSpatial`.
- **Bounding spheres already exist.** Each body carries a `radius` used today for
  broad-phase and the ground test.

What is missing is a **narrow-phase** for arbitrary convex shapes and a
**constraint solver** that produces realistic (linear *and* angular) response,
plus the per-body state that angular response requires (an inertia tensor).

Truly general (concave, self-intersecting) mesh-vs-mesh collision with full
manifold generation is a large, error-prone problem. We need a decision that is
realistic and mesh-general without committing to a full triangle-soup collision
pipeline.

## Decision

Model colliders as **convex hulls** and resolve contacts with a **sequential
impulse solver** that includes angular response. Concretely:

### 1. Collider representation — convex hulls

- Each collidable body owns a **convex collider** derived from its mesh: the
  convex hull of the mesh vertices, stored in body-local space alongside the
  existing bounding `radius`.
- **Slice fragments** compute their convex hull at generation time in
  `slicing`/`geometry`, so runtime-created pieces are collidable immediately.
- Meshes that are meaningfully **concave** are handled by an **approximate
  convex decomposition** into a small set of convex hulls (a compound collider).
  Decomposition is opt-in and computed once at spawn/fragment time, never
  per-frame.

Rationale: convex-vs-convex is well understood, robust, and fast; it covers the
box/fragment cases the demos need. Concavity degrades gracefully to "convex hull"
or a compound of hulls rather than failing.

### 2. Narrow-phase — tiered, in `physics`

1. **Bounding-sphere reject** using the existing `radius` (cheap early-out).
2. **AABB overlap** using the existing `Aabb` helpers.
3. **GJK** for boolean overlap between two convex hulls.
4. **EPA** to extract the penetration **normal** and **depth** for overlapping
   pairs, producing a `Contact` (same shape as today's `sphereSphereContact`).
5. **Contact manifold** via face clipping (Sutherland–Hodgman) so resting
   contact is stable, not a single jittery point.

`sphereSphereContact` is retained as a fast path for sphere colliders.

### 3. Rigid-body state — add rotational inertia

- `RigidBody` gains an **inverse inertia tensor** (body-local `invInertia`,
  rotated into world space each step). Static bodies use a zero tensor, mirroring
  `invMass === 0`.
- `createBody` derives the inertia tensor from the collider + mass; spawn options
  accept an override.

### 4. Resolution — sequential impulse solver, in `physics` + `core`

- A new `resolveContact(a, b, manifold, { restitution, friction })` applies
  normal impulses (`j = -(1 + e)·vRel·n / (invMassSum + angularTerms)`) plus a
  Coulomb friction impulse, and does split positional correction weighted by
  `invMass`. Static bodies contribute zero, so all correction/impulse flows to
  the dynamic body — immovable objects fall out naturally.
- A new **`resolveCollisions(world)`** system iterates `getPotentialPairs`, runs
  the narrow-phase, and applies `resolveContact`. It runs inside the
  fixed-timestep `stepPhysics` (ADR 0005), after integration, with the spatial
  hash refreshed beforehand.

### 5. Configuration & opt-in

- Per-body `restitution` and `friction` (with world-level defaults), plus a
  `collides` flag / tag so non-physical props can opt out of collision.
- Collisions are **on by default at the world level**: interpenetration is a
  defect in the existing demos, so the corrected behaviour is the default.
  Consumers that need the old pass-through behaviour opt out explicitly (world
  config flag, or per-body `collides: false`).

### Boundaries (golden-rule compliance)

- Hull/decomposition geometry lives in `geometry`; collision math and the solver
  live in `physics`; the `resolveCollisions` system lives in `core`. No new
  dependency on rendering, Three.js, DOM, or any framework. Layering (ADR 0002)
  is preserved: `core → physics/geometry/spatial/math` only.

## Consequences

- **Positive:** realistic linear + angular collision response on arbitrary
  meshes, including slice fragments; immovable objects supported with no new
  concept (mass 0); reuses the existing broad-phase and bounding spheres; stays
  within package boundaries and the headless/fixed-timestep model.
- **Negative:** significant new code (GJK/EPA, clipping, hull generation,
  optional convex decomposition, inertia tensors, an impulse solver) with real
  numerical-robustness and tuning cost; concave shapes are approximated, not
  exact; adds per-spawn/per-fragment precomputation and per-frame solver work
  that must be profiled against the "hundreds of objects" goal.
- **Determinism:** the solver must use a fixed iteration count and stable pair
  ordering to stay deterministic under the fixed timestep (ADR 0005).
- **Follow-ups / phasing (proposed for ROADMAP Phase 7 — Hardening):**
  1. Add `invInertia` to `RigidBody`; wire into integration.
  2. Convex hull generation in `geometry`; hull on slice fragments.
  3. GJK + EPA + `Contact` for convex pairs in `physics`; keep sphere fast path.
  4. Contact manifold via face clipping.
  5. `resolveContact` (normal + friction + positional correction).
  6. `resolveCollisions(world)` system, wired into `stepPhysics` and on by
     default (with an opt-out flag).
  7. Optional approximate convex decomposition for concave meshes.
  8. Verify in `spinning-slices` (objects no longer phase through); profile and
     tune.

## Alternatives considered

- **Sphere-only collisions (bounding spheres).** Rejected as the primary model:
  trivial to build on the existing `radius` + `sphereSphereContact`, but boxes
  and fragments would collide as balls — not "realistic collisions on
  generalised mesh shapes." May still be offered as a cheap opt-in tier.
- **Full triangle-soup (concave mesh-vs-mesh) collision.** Rejected: closest to
  "exact," but expensive, numerically fragile, poor for dynamic-vs-dynamic
  contact, and overkill for the intended shapes; convex hulls / decomposition
  give the needed realism at far lower risk.
- **Third-party physics engine (e.g. Rapier, Cannon, Ammo).** Rejected for the
  core: pulls a large dependency into a deliberately minimal, headless,
  framework-agnostic engine and cedes ownership of simulation state, conflicting
  with the golden rules and the project's "own the simulation" philosophy. Could
  be revisited as an optional external adapter, never as a core dependency.
- **Position-based dynamics (XPBD) instead of an impulse solver.** Reasonable and
  arguably simpler to stabilise, but diverges from the existing
  velocity/impulse-based model (`applyImpulse`, `resolveHalfSpace`); deferred as
  a possible future ADR rather than adopted now.

## Amendment — hull-footprint tipping on the ground half-space (2026-07-11)

The original `resolveHalfSpace` treats every body as a **bounding sphere**: the
ground's normal-force correction always passes through the centroid, so the
ground can never exert a *toppling* torque. Tall or narrow pieces — including
slice/fracture fragments — stand upright forever even when their centre of mass
projects well outside their base, which reads as unphysical in the demos.

Decision: `resolveHalfSpace` gains two optional parameters,
`collider?: ConvexShape` and `tipFactor = 12`, and grows a **support-polygon**
path on top of the existing sphere correction (which is unchanged and still
applied):

- The collider's vertices are transformed into world space; those within
  `CONTACT_EPSILON` (`0.05`) of the surface form the **contact set**.
- With ≥ 3 contacts, their footprint is projected into the ground plane's 2D
  basis and reduced to a **convex support polygon** (monotone-chain hull).
- If the body's centre of mass projects **inside** the polygon it is stable and
  nothing extra happens. If it projects **outside**, a destabilising angular
  impulse is applied about `normal × overhang` (overhang = direction from the
  nearest support edge toward the COM), scaled by
  `overhangDistance × tipFactor × dt`, so the body topples over that edge.
- It **falls back to the sphere correction** when no collider is supplied or the
  contact set has fewer than three vertices; `tipFactor = 0` disables tipping.

Wiring: `WorldConfig`/`ResolvedConfig` gain `tipFactor` (default `12`);
`stepPhysics` iterates `world.bodies.entries()` and passes each body's collider
(`world.colliders.get(id)`) and the world `tipFactor` into `resolveHalfSpace`.
Because `resolveHalfSpace`'s signature carries no timestep, the impulse folds a
fixed `1/60` `dt` estimate into the magnitude — `tipFactor` is the intended
tuning knob, so the exact `dt` is immaterial.

Consequences: bodies resting on the ground now tip realistically at negligible
cost (the hull scan runs only for grounded bodies with a collider); static
bodies (`invMass === 0`) are unaffected (early-out preserved); materialless and
colliderless bodies keep their previous sphere behaviour exactly. This extends,
and does not reverse, the ADR's collision model — it is a signature change to a
physics helper, acceptable at the current `0.x` stage (ADR 0008).
