# ADR 0004 — Slicing as a bounded interaction volume

Status: Accepted · Date: 2026-07-05

## Context

A naive slice implementation treats the cut as an infinite plane, which would
affect every object in the world that the plane intersects — incorrect for a
swipe gesture and catastrophic for performance at scale.

## Decision

Model a slice as a **bounded interaction volume**, not an infinite plane.

A slice consists of:
- a slice **plane** derived from the gesture, plus
- a **radius / extent constraint** that bounds the affected region.

The pipeline is:
1. Input gesture.
2. Convert screen → world ray.
3. Build the bounded slice volume (plane + radius).
4. Query the spatial system for candidates.
5. Filter candidates to those within the volume.
6. Perform mesh split.
7. Generate fragments.
8. Apply physics impulse.
9. Cleanup old objects.

## Consequences

- **Positive:** slices affect only nearby, intended objects; enables spatial
  broad-phase filtering; realistic swipe semantics; scalable.
- **Negative:** requires a spatial acceleration structure and volume/candidate
  math; more moving parts than a plane test.
- **Follow-ups:** depends on the spatial structure decision (ADR 0005 backlog /
  spatial package) and geometry mesh-splitting capabilities.

## Alternatives considered

- **Infinite cutting plane:** rejected — wrong semantics and unbounded cost.
- **Per-object naive intersection scan (O(n)):** rejected — does not scale to
  hundreds of objects; violates performance goals.

## Amendment — pluggable bounded-region shape (2026-07-05)

The original decision fixed the bounded region to a **sphere** (`center` +
`radius`). In practice different applications need different reach: a swipe
should be able to cut objects at any *depth* along the camera ray (a
Fruit-Ninja slice), a board game wants an oriented box, a targeted effect wants
a sphere. A single sphere also caused a concrete bug: objects nudged along the
camera axis by collision response left the sphere (which is centered on the
play plane) and became unsliceable.

The bounded-volume **principle is unchanged** — a slice is never an infinite
plane. Only the region's *shape* becomes pluggable. `SliceVolume` is now
`{ plane, region }`, where `region` is a plain-data discriminated union:

- `sphere` — a ball of `radius` around `center` (the default; the original
  behavior, so existing callers are unaffected).
- `cylinder` — a `radius` swept along `axis`, optionally bounded by
  `halfLength`. Distance is measured perpendicular to the axis, so objects at
  any depth along the axis stay in range.
- `box` — an optionally oriented box of `halfExtents`.
- `unbounded` — the whole (still finite) world.

Each region owns **both** phases so they can never disagree: `regionContains`
(narrow-phase) and the broad-phase query shape emitted by
`querySliceCandidates` (sphere → `querySphere`, finite cylinder →
`querySegment`, box → circumscribed-sphere query, unbounded → `queryAll`). A
cylinder with an **unbounded axis** also uses `queryAll` and prunes in the
narrow-phase by perpendicular distance: there is no axial pruning to do, and it
avoids sweeping a huge, mostly-empty cell range for a long tube (broad-phase
cost is otherwise O(length / cellSize), which caused per-slice lag spikes when
a cylinder was sized to the default world bounds).

`createSliceVolume(plane, center, radius)` is retained (builds a `sphere`
region), and `sliceVolumeFromSwipe` gains an opt-in `extendAlongView` that
produces a cylinder along the view direction. The `spinning-slices` demo uses
it so collision-nudged fragments remain sliceable at any depth.

Consequences: a small amount of dispatch per region kind; a new `queryAll`
broad-phase; regions are plain data (deterministic and serializable, matching
the engine's data-oriented style). A deliberately omitted extension is an
arbitrary-predicate/`custom` region — added only if a real application needs a
shape outside this set (YAGNI).

