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
