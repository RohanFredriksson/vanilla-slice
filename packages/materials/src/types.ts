/** Identifier for a registered {@link Material}. */
export type MaterialId = string;

/**
 * A material describes the *physical properties* of an object; it contains no
 * behaviour (ADR 0009). Interactions (slice, fracture, collision) read these
 * values to decide, in a data-driven way, how an object responds — "fruit
 * slices, glass fractures, steel resists" follows purely from the numbers here,
 * never from object-type knowledge inside a system.
 */
export interface Material {
  /**
   * Stable identifier used by a `MaterialRef` component (in `core`) to resolve
   * this record from a {@link MaterialLibrary}.
   */
  readonly id: MaterialId;
  /**
   * Mass per unit volume, kg/m³. Combined with a mesh's volume to derive the
   * rigid-body mass (see `massFromDensity`).
   */
  density: number;
  /** Coulomb friction coefficient (>= 0). */
  friction: number;
  /** Restitution / bounciness in `[0, 1]`; a cheap proxy for elasticity. */
  restitution: number;
  /**
   * Intrinsic resistance to fracture — energy per unit crack area. Acts as the
   * fracture *initiation gate*: the effective per-object threshold is derived at
   * evaluation time as `toughness × size` (see `fractureThreshold`), so a
   * material behaves correctly on both small and large objects. `Infinity`
   * marks an unbreakable material.
   */
  toughness: number;
  /**
   * Ductile↔brittle bias in `[0, 1]`. Higher is more brittle and biases fracture
   * toward more, sharper fragments; lower absorbs/deforms. Consumed by the
   * fracture engine (ADR 0009, ROADMAP Phase 10).
   */
  brittleness: number;
  /**
   * How readily a crack **propagates** through the body, in `[0, 1]`. `0` keeps
   * fracture localized around the impact (fine shards near the hit, large chunks
   * elsewhere); `1` lets the crack spread across the whole body and amplifies the
   * fragment count with excess impact energy. Consumed by the fracture engine
   * (ADR 0009, ROADMAP Phase 10).
   */
  fracturePropagationFactor: number;
}
