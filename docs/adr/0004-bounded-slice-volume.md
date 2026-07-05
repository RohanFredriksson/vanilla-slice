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
