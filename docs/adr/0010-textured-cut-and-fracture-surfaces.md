# ADR 0010 — Surface Attributes for Textured Cutting and Fracture

Status: Accepted · Date: 2026-07-06

This ADR is an **architectural design** for supporting UV-mapped (textured)
models through slicing and fracture, and for rendering the newly-exposed interior
of a cut/shattered object as a believable, material-specific surface (wood grain,
marble, fruit flesh, …). It is **implemented** across ROADMAP Phase 11 (P1–P7).
It extends — and does not supersede — ADR 0004 (bounded slice volume), ADR 0009
(materials + interaction framework), and the ownership rules of ADR 0002.

## Context

Today the engine mesh is **positions + indices only**
(`packages/geometry/src/mesh.ts`):

```ts
interface Mesh { positions: number[]; indices: number[]; }
```

There is nowhere to store texture coordinates, vertex colours, or a per-face
material assignment. Three consequences follow:

1. **Textured models cannot be cut correctly.** Even if a source model carried
   UVs, `splitMeshByPlane` (`packages/geometry/src/split.ts`) only interpolates
   positions at clip points; any UVs would be dropped, so the surviving skin on
   each half would lose its mapping.
2. **The exposed interior is untextured and indistinguishable from the skin.**
   The cross-section cap (`buildCap`) emits bare geometry with no UVs and no
   marker that these triangles are "interior". The renderer
   (`packages/renderer-three/src/three-utils.ts`) uploads only a `position`
   attribute and assigns a **single** material per entity
   (`packages/renderer-three/src/three-renderer.ts`), so rind and flesh cannot
   differ.
3. **Fracture inherits the same limitation.** The Voronoi engine
   (`packages/fracture/src/voronoi.ts`) is built on the same `splitMeshByPlane`
   and the same `Mesh`, so cell faces are untextured for exactly the same reason.
   Fixing the split/cap path fixes both slice and fracture at once.

The physics `Material` (ADR 0009) is deliberately **data-only** (density,
friction, toughness, …) and carries no appearance. So "what the interior of this
object looks like" has no home today.

### The believable-interior requirement

The goal is not merely to paint a flat texture on the cut. For a material like
wood, the interior must show **growth rings on a cross-cut and long streaks on a
rip-cut**, and — critically — the grain must stay **welded to the material** as
fragments tumble and fly apart, rather than swimming in screen or world space. A
flat, plane-projected 2D UV on the cap cannot express cut-direction-dependent
grain and does not stay consistent across fragments.

The established technique for destructible objects is **solid (material-space)
texturing**: sample the interior appearance by each vertex's *rest-pose* (model-
space) coordinate, so the pattern is a property of the material volume, not of
the current pose. This requires carrying a per-vertex material-space coordinate
through the cut, and computing it for brand-new cap vertices.

## Decision

Add neutral **surface-attribute channels** to the engine mesh, make the split
attribute-aware, and put all *appearance* (textures, shaders, normal maps) in the
**renderer adapter**, keyed by the entity's material id. The engine gains data,
not looks — preserving the framework-agnostic, headless core (ADR 0002) and the
data-only `Material` (ADR 0009).

### 1. Mesh gains optional attribute channels

`Mesh` (in `geometry`) is extended with optional, parallel channels — absent by
default, so the existing positions-only path is unchanged:

```ts
interface Mesh {
  positions: number[];
  indices: number[];
  uvs?: number[];    // 2 per vertex — source texture coordinates (exterior skin)
  tex3?: number[];   // 3 per vertex — rest-pose (model-space) coordinate, drives
                     // solid/triplanar interior texturing
  groups?: number[]; // per-triangle material slot: 0 = exterior skin, 1 = interior
}
```

- `tex3` is initialised to the model's local-space positions at authoring/load
  time. Because it is a *rest-pose* coordinate, it stays constant as bodies move,
  so interior textures welded to it never swim.
- `groups` is a per-triangle slot index, not a Three.js concept; the renderer
  maps slots to materials.
- No **tangent** channel is added: exterior tangents are recomputed by the
  renderer from UVs; interior normal mapping is triplanar (in-shader TBN). This
  keeps the split free of tangent interpolation (see §5).

`cloneMesh`, `transformMesh`, and the core `recenterMesh`/`toWorldMesh` helpers
carry these channels through unchanged (they are invariant under the rigid
transforms applied there).

### 2. The split becomes attribute-aware (fixes slice **and** fracture)

`splitMeshByPlane` and its `MeshBuilder` interpolate `uv` and `tex3` at each
clip point using the **same edge parameter `s`** already computed for the
position lerp. Source triangles/polygons are emitted with **group 0**. When a
source mesh has no attributes, the split falls back to today's positions-only
behaviour. Because fracture is repeated `splitMeshByPlane(...).back` calls, cell
faces inherit interpolation automatically.

### 3. Interior geometry: cap material-space coordinates and fallback UVs

`buildCap` emits cap triangles with **group 1** and assigns each new cap vertex:

- `tex3` = the world-space cap point mapped **back into model space** via the
  body's inverse model matrix, supplied to the split as a new
  `SplitOptions.capToMaterialSpace` matrix. This is what makes solid interior
  textures continuous across fragments and correct for the cut orientation.
- `uv` = a planar projection onto the cap's in-plane basis `(u, v)` (already
  computed for cap triangulation), as a 2D fallback for interior materials that
  prefer a conventional texture.

### 4. Appearance lives in the renderer, keyed by material id

`Material` (ADR 0009) stays data-only. Interior *appearance* is described by a
renderer-side **`InteriorAppearanceRegistry`** keyed by material id. To let the
renderer resolve it, `core` surfaces the entity's material id on `RenderItem`
(neutral data — no boundary break; the renderer still decides all looks).

The renderer (`renderer-three`):

- uploads `uv` and `tex3` as geometry attributes and coalesces `groups` into
  `geometry.addGroup(start, count, slot)` ranges;
- assigns a **material array** per entity: **slot 0** = exterior (the existing
  `createMaterial` hook), **slot 1** = interior from the registry;
- interior materials are **triplanar / solid** shaders sampling `tex3` — with
  built-in presets (procedural wood rings+streaks, marble, stone, fruit flesh)
  selected per material id, so interiors are object-dependent by configuration.

### 5. Normal mapping is two distinct paths

- **Exterior skin (has real UVs) → conventional tangent-space normal mapping.**
  The renderer calls `geometry.computeTangents()` when a `uv` attribute is
  present (indexed geometry + uv + normal are all available after §4). The slot-0
  material gains `normalMap`. No engine tangent channel and no seam tangent
  interpolation are required.
- **Interior faces (triplanar/solid, no clean UV) → triplanar normal mapping.**
  The interior shader builds the TBN per-fragment from the geometric normal and
  the three projection axes keyed to `tex3` (whiteout/UDN blending), so **no
  per-vertex tangent attribute** is needed. This yields correctly-oriented relief
  for a cross-cut vs. a rip-cut that stays stable as fragments move.

Keeping tangents out of the engine `Mesh` keeps the split/fracture code simpler
and boundary-clean.

## Consequences

- **Positive:** textured models cut and fracture correctly; interiors are
  believable and material-specific; one change to the split fixes slice *and*
  fracture; the engine stays headless and renderer-agnostic; `Material` stays
  data-only; the new channels are optional, so all existing meshes and tests are
  unaffected.
- **Negative:** a larger mesh footprint when attributes are present; the renderer
  grows an interior-appearance registry and shader materials; the split gains
  attribute interpolation and an inverse-transform argument; a small `core`
  change surfaces `materialId` on `RenderItem`.
- **Determinism:** attribute interpolation is a pure function of `s`; cap `tex3`
  is a pure function of the (already deterministic) cut geometry and the body
  transform — the fixed-timestep/determinism guarantees (ADR 0005) are preserved.

### Architectural risks

| Risk                          | Impact                                                       | Mitigation                                                                                     |
| ----------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Boundary leak (appearance)    | Renderer/texture concerns creeping into engine or materials.| Engine gains only neutral data (uv/tex3/groups); all textures/shaders live in `renderer-three`.|
| Mesh-size growth              | Extra per-vertex data on every sliceable.                   | Channels are optional; absent unless a model supplies them.                                    |
| Split complexity/regressions  | Attribute interpolation could break the positions-only path.| Attribute emission is gated on presence; existing split tests stay green as a guard.            |
| Non-convex caps               | Cap UV/tex3 assumes a convex cross-section.                 | Same assumption as today's cap (unchanged); documented, not a new regression.                  |
| Interior shader cost          | Triplanar/solid shading is heavier than a flat material.    | Slot-1 only (interior faces); presets kept lean; profile against the "hundreds of objects" goal.|
| `core` fan-out to renderer    | `RenderItem` carrying `materialId`.                         | It is inert data the renderer may ignore; no new package dependency direction.                 |

## Migration strategy

Phased and independently shippable; boundaries preserved throughout:

- **Phase 1 — Mesh channels.** Add optional `uvs`/`tex3`/`groups` and carry them
  through `clone`/`transform`/`recenter`. Behaviour-neutral.
- **Phase 2 — Attribute-aware split.** Interpolate `uv`/`tex3` at clip points;
  emit source polys as group 0. Fixes exterior mapping for slice and fracture.
- **Phase 3 — Interior geometry.** Cap tris as group 1 with model-space `tex3`
  (`capToMaterialSpace`) and fallback planar `uv`.
- **Phase 4 — Core plumbing.** Pass each body's inverse model matrix into
  slice/fracture; surface `materialId` on `RenderItem`.
- **Phase 5 — Renderer interiors.** Upload `uv`/`tex3`, coalesce `groups`,
  material array per entity, `InteriorAppearanceRegistry` + triplanar/solid
  presets.
- **Phase 6 — Normal mapping & tangents.** Exterior `computeTangents()` +
  `normalMap`; interior triplanar normal mapping.
- **Phase 7 — Tests & demos.** Geometry seam/cap tests, fracture `tex3`
  continuity across cells, renderer attribute/group tests, wood + watermelon
  demos.

## Alternatives considered

- **Flat plane-projected 2D UV on the cut only.** Rejected as the primary model:
  it cannot express cut-direction-dependent grain and does not stay consistent
  across fragments. Retained only as a *fallback* channel alongside `tex3`.
- **Storing appearance on the physics `Material`.** Rejected: it couples the
  data-only material to rendering, breaking ADR 0009 and headless purity.
  Appearance stays in the renderer, keyed by material id.
- **Per-vertex tangent channel carried through the split.** Rejected: forces
  tangent interpolation across seams and a heavier mesh; the exterior recomputes
  tangents from UVs and the interior uses in-shader triplanar TBN instead.
- **World-space (not rest-pose) interior texturing.** Rejected: the pattern would
  swim as fragments move; `tex3` (model space) welds it to the material.
- **Per-face `Material` assignment in the engine.** Rejected here (already
  deferred by ADR 0009): a two-slot exterior/interior split via `groups` covers
  the requirement without a general per-face material model.

## References

- ADR 0002 — Layered architecture (appearance stays in the renderer adapter).
- ADR 0004 — Bounded slice volume (cut path extended, not changed).
- ADR 0005 — Fixed-timestep loop (attribute interpolation stays deterministic).
- ADR 0007 — Convex hulls / cap infrastructure (reused for caps).
- ADR 0009 — Materials & interaction framework (`Material` stays data-only;
  interior appearance keyed by material id).
- `packages/geometry/src/mesh.ts`, `packages/geometry/src/split.ts`.
- `packages/fracture/src/voronoi.ts` (same split path — fixed for free).
- `packages/renderer-three/src/three-utils.ts`,
  `packages/renderer-three/src/three-renderer.ts`.
- `docs/ROADMAP.md` Phase 11.
