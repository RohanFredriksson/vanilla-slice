# ADR 0011 — Optional Small-Fragment Culling

Status: Accepted · Date: 2026-08-01 · Amended 2026-08-01
(shrink-dissolve despawn, below)

This ADR is an **architectural design** for bounding the body count in heavily
sliced scenes: an optional, configurable cleanup that despawns bodies whose
volume falls below a threshold once they have existed for a configurable delay.
It is **implemented** across ROADMAP Phase 12. It extends — and does not
supersede — ADR 0004 (bounded slice volume), ADR 0005 (fixed-timestep engine
loop), and ADR 0009 (materials + interaction framework).

## Context

Slicing is unbounded in the small: a cut divides a mesh into two pieces, and
either piece may be cut again, so repeated gestures grind an object into
hundreds of near-zero-volume slivers. Every sliver is a full body — it occupies
a broad-phase entry (`syncSpatial` re-inserts every body every frame), takes
part in collision-pair resolution, and holds a render mesh. Scenes therefore
slow down as fragment counts climb, with no upper bound on how small pieces can
get.

This is a **long-horizon scaling problem, not a per-frame spike**: no single
operation is slow, but cumulative body count degrades frame time after many
cuts. The fracture pipeline already bounds its own worst case (Phase 10.1 caps
fragment generation); slicing has no equivalent governor, and a hard cap on
slice count would change gameplay.

Existing bounds-related machinery is all spatial: `runCleanup` removes bodies
that leave the world `bounds` (SPEC FR-4), and the ground-fracture path guards
on a minimum bounding radius (`MIN_GROUND_FRACTURE_RADIUS`). Neither addresses
pieces that stay in play but are too small to matter.

## Decision

Add an **optional, per-world** culling pass that despawns tiny bodies on a
delay, so small pieces survive long enough to be seen and cut, then dissolve:

```ts
const world = createWorld({
  smallBodyCulling: {
    minVolume: 0.01,    // world units³ — below this = cull candidate
    delaySeconds: 1,    // seconds a body must exist before it may be culled
    skipStatic: true,   // default: static bodies are never culled
  },
});
```

Design points:

1. **Off by default.** An absent `smallBodyCulling` config leaves behaviour and
   determinism exactly as before; existing consumers are unaffected.
   `WorldConfig.smallBodyCulling` is resolved into `ResolvedConfig` with
   `skipStatic` defaulting to `true`. `minVolume` and `delaySeconds` are
   **required** when the option is present — no magic defaults, because world
   scale varies per game and any arbitrary threshold would surprise users.
2. **Volume is measured, not estimated.** The geometry package already computes
   exact mesh volume (`computeVolume`, divergence theorem). `World.spawn`
   records `Metadata.volume = |computeVolume(geometry)|` once at spawn; the
   slice/fracture helper `replaceWithFragments` already computes each fragment's
   volume for mass derivation and passes it through `SpawnOptions.volume`, so
   nothing is recomputed and no per-frame work is added. The per-frame cost of
   the pass is one accumulation and one comparison per body — no allocations.
   Bodies without geometry have no volume and are never culled (they are not
   sliceable anyway); a geometry-less body can still opt in by passing an
   explicit `volume`.
3. **Age is real elapsed time.** `Metadata.ageSeconds` accumulates the frame
   delta passed to `world.update`, so the delay matches the user's perceived
   time, not the fixed-timestep substep count. Age accumulates for every
   eligible body regardless of current size, so a piece that shrinks on a later
   cut is already counted as aged — the delay is measured from spawn, matching
   how fragments are born small.
4. **Exemptions.** Static bodies (`skipStatic`, default) and per-entity
   `SpawnOptions.cullable: false` are never culled. Fragments inherit the
   parent's `cullable` exemption, so an opted-out body's pieces stay visible.
   This mirrors the existing per-entity opt-out pattern (`collides`).
5. **Culling is instant despawn.** The pass runs in the cleanup phase of
   `world.update`, after physics, interactions, and bounds cleanup. Tiny pieces
   visibly disappear at the delay boundary; the renderer simply stops receiving
   a `RenderItem`. No fade or pooling is added — those are presentation
   concerns and out of scope for the headless core (ADR 0002).

## Consequences

- **Positive.** Body count in heavily sliced scenes becomes bounded by
  throughput (pieces must shrink below `minVolume` and survive `delaySeconds`),
  so frame time stops degrading with cut count. The feature is a drop-in
  opt-in for consumers like *slice-everything* that cut aggressively.
- **Negative.** Culled pieces vanish; a game that needs every shard to persist
  (e.g. scoring per final shard) must either set a very low `minVolume` or use
  `cullable: false`. Age is measured from spawn, so a fresh spawn that is below
  threshold disappears after exactly `delaySeconds`.
- **Determinism.** Ages depend on real frame deltas and are only consulted by
  an opt-in system; default worlds remain bit-for-bit unchanged.

## Alternatives considered

- **Reject tiny fragments at slice time.** Cheaper (no delayed pass) but
  pieces pop out of existence *inside the cut* — the user never sees the
  shards they just created, which reads as broken.
- **Radius threshold.** Cheaper than exact volume but wrong for slivers — a
  long thin sliver has a large bounding radius and a near-zero volume, which is
  precisely the case that needs culling.
- **Tag-based filter.** Culling by `tags` would be more expressive but adds a
  second mechanism; the single `cullable` flag covers the fixture/exempt case.
- **Fade-out / pooling.** Presentation and allocation concerns; renderer
  adapters can animate removal, and pooling is tracked separately in ROADMAP
  Phase 10.1 follow-ups. *Partly superseded by the amendment below: a shrink
  animation is now engine-owned; pooling remains deferred.*

---

## Amendment — shrink-dissolve despawn (2026-08-01)

Supersedes decision point 5 ("Culling is instant despawn") and the negative
consequence "culled pieces vanish": a culled body now **shrinks out of
existence** over a configurable duration instead of popping.

### Context

Playtesting in *slice-everything*'s sculpt mode showed the hard cut-off reads
as jarring: pieces the player just cut vanish on the spot. The engine's
lifecycle timing is the right home for "when the piece disappears"; the
adapter is the right home for "how it looks while doing so" (ADR 0002). The
original decision's "no fade" stance conflated the two — a *transform* shrink
is simulation state, exactly like `position` and `orientation` already are.

### Decision

When a body first crosses the culling threshold (`ageSeconds >= delaySeconds`
and `volume < minVolume`) it is marked **dissolving** (`Metadata.dissolving`)
instead of being despawned:

1. **Lifecycle, no second timer.** The existing age timer drives everything:
   the dissolve starts at `ageSeconds = delaySeconds` and the despawn happens
   at `ageSeconds = delaySeconds + shrinkSeconds`. `shrinkSeconds` defaults to
   `0.3`; `0` restores instant despawn. `smallBodyCulling.shrinkSeconds: 0` is
   therefore fully backward-compatible with the original decision.
2. **The dissolving body stops interacting.** It is skipped by `syncSpatial`
   (no broad-phase entry), `resolveCollisions` (nothing can hit it and it
   cannot hit anything), ground-fracture tracking (it must not shatter and
   resurrect the problem), and bounds cleanup (its animation always completes).
   It keeps integrating under gravity, so it drifts or settles naturally while
   shrinking.
3. **Scale is engine state.** The render scale eases uniformly `1 → 0` across
   `shrinkSeconds`, derived from the age timer, and is surfaced on every
   `RenderItem` as `scale` (`[1,1,1]` for normal bodies). The renderer-three
   adapter applies it in `sync` (`mesh.scale`); it never computes the timing.
4. **Bounds-culled bodies are unchanged** — pieces flying out of the world
   bounds still despawn instantly, since they are off-screen anyway.

### Consequences

- Culled pieces visibly dissolve, removing the pop-out jar while keeping body
  counts bounded; the engine gains no rendering dependency and the adapter
  gains no lifecycle logic.
- `RenderItem` gains one field and every render state item carries a uniform
  scale; the cost is one extra metadata read per renderable.
- Default worlds and `shrinkSeconds: 0` configs remain bit-for-bit unchanged.
