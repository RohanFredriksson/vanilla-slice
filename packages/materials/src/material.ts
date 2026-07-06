import type { Material, MaterialId } from './types';

/**
 * The neutral fallback material. Values are deliberately generic — unit density,
 * moderate friction, no bounce, effectively unbreakable — so that unconfigured
 * bodies behave exactly as they did before materials existed (behaviour-neutral
 * migration, ADR 0009 Phase A).
 */
export const DEFAULT_MATERIAL: Material = {
  id: 'default',
  density: 1,
  friction: 0.5,
  restitution: 0,
  toughness: Infinity,
  brittleness: 0,
  fracturePropagationFactor: 0,
};

/**
 * Build a {@link Material}, filling any unspecified property from
 * {@link DEFAULT_MATERIAL}. The `id` is required and cannot be set via
 * `overrides`.
 */
export function defineMaterial(
  id: MaterialId,
  overrides: Partial<Omit<Material, 'id'>> = {},
): Material {
  return { ...DEFAULT_MATERIAL, ...overrides, id };
}

/** Derive body mass from a material's density and a mesh volume (kg = kg/m³ · m³). */
export function massFromDensity(density: number, volume: number): number {
  return density * volume;
}

/**
 * The effective fracture-initiation threshold for an object of the given
 * characteristic `size`, derived from intrinsic `toughness` (ADR 0009). A larger
 * object of the same material resists a given impact more than a small one.
 * Returns `Infinity` for unbreakable (infinite-toughness) materials at any size.
 */
export function fractureThreshold(material: Material, size: number): number {
  if (!Number.isFinite(material.toughness)) {
    return Infinity;
  }
  return material.toughness * Math.max(size, 0);
}

/** Upper bound on fragments a single fracture may request (memory/perf guard). */
export const MAX_FRACTURE_FRAGMENTS = 32;

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(Math.max(x, 0), 1) : 0;
}

/**
 * How many fragments a fracture should produce for an object of the given `size`,
 * derived purely from material data plus (optional) impact `energy` (ADR 0009).
 *
 * A base count comes from `brittleness` (2–6). When an impact `energy` above the
 * fracture threshold is supplied, `fracturePropagationFactor` amplifies the count
 * in proportion to how far the crack propagates (the excess-energy ratio),
 * capped at {@link MAX_FRACTURE_FRAGMENTS}. Propagation `0` ignores energy
 * entirely (localized shatter); higher values spread the crack. Always returns at
 * least 2.
 */
export function fractureFragmentCount(
  material: Material,
  size: number,
  energy?: number,
): number {
  const brittleness = clamp01(material.brittleness);
  const propagation = clamp01(material.fracturePropagationFactor);
  const base = 2 + Math.round(brittleness * 4); // 2..6
  const threshold = fractureThreshold(material, size);
  let excess = 0;
  if (energy !== undefined && Number.isFinite(threshold) && threshold > 0) {
    excess = Math.max(0, (energy - threshold) / threshold);
  }
  const amplify = 1 + propagation * Math.min(excess, 6);
  const count = Math.round(base * amplify);
  return Math.min(Math.max(count, 2), MAX_FRACTURE_FRAGMENTS);
}
