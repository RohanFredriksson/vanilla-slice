# Tipping / toppling physics on the ground plane

**Date:** 2026-07-11
**Packages:** `@vanilla-slice/physics`, `@vanilla-slice/core`

Bodies resting on the ground now **tip and topple realistically** instead of
balancing forever. When a body's centre of mass moves past the edge of its base,
gravity rotates it over that edge — so a sliced-off sliver, a tall fragment, or
an off-balance piece falls the way you'd expect.

## Why it matters

Previously the engine treated every resting body as a sphere for the ground
contact, so the ground could only push straight up — never rotate a body over.
Tall or narrow shapes (including slice/fracture fragments) stood upright no
matter how unbalanced they were. With this change the ground uses each body's
actual convex footprint, so unstable objects fall over on their own.

## Using it

Tipping is **on by default** — you don't need to do anything to get it. Any body
that has a collider (the convex hull is derived from `geometry` automatically)
will tip when it becomes unbalanced on the ground.

To tune or disable it, set `tipFactor` on the world:

```ts
import { createWorld } from '@vanilla-slice/core';

const world = createWorld({
  gravity: [0, -9.81, 0],
  ground: { normal: [0, 1, 0], offset: 0 },
  tipFactor: 12, // default; higher = topples faster, 0 = disabled
});
```

- `tipFactor` (default `12`) scales how strongly an unbalanced body is pushed
  over its support edge. Increase it for snappier toppling, lower it for a
  slower lean, or set it to `0` to turn tipping off entirely.

## Behaviour

- A body is **stable** while its centre of mass sits over its base (its
  ground-contact footprint) — it just rests.
- Once the centre of mass passes the nearest edge of that footprint, the body
  receives a toppling rotation over that edge, proportional to how far past the
  edge it is and to `tipFactor`.
- **Static bodies** (mass `0`) never tip — ground, walls, and pillars stay put.
- Bodies **without a collider** keep the previous simple sphere-based ground
  response, so nothing regresses.

## API changes

- `createWorld({ tipFactor })` — new optional world setting (default `12`).
- `resolveHalfSpace(body, normal, offset, restitution, collider?, tipFactor?)` —
  the low-level physics helper gains two optional trailing arguments. Existing
  four-argument calls keep working unchanged.

No migration is required. This is additive and backward-compatible for existing
callers; the only visible difference is that unbalanced resting bodies now fall
over.

---

For the design rationale and internals, see the ADR 0007 amendment,
*hull-footprint tipping on the ground half-space*, in
`docs/adr/0007-rigid-body-collisions-convex-hulls.md`.
