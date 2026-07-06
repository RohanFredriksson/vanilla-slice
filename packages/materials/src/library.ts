import type { Material, MaterialId } from './types';
import { DEFAULT_MATERIAL } from './material';

/**
 * A registry of materials keyed by id. Entities reference materials by id (via a
 * `MaterialRef` component in `core`), keeping simulation data-driven: no material
 * behaviour or object-type knowledge leaks into systems (ADR 0009).
 */
export interface MaterialLibrary {
  /** Register (or replace) a material by its `id`. */
  register(material: Material): void;
  /** Look up a material; returns {@link MaterialLibrary.defaultMaterial} on a miss. */
  get(id: MaterialId): Material;
  /** Whether a material with this id is registered. */
  has(id: MaterialId): boolean;
  /** The fallback returned by {@link MaterialLibrary.get} for unknown ids. */
  readonly defaultMaterial: Material;
}

/** Options for {@link createMaterialLibrary}. */
export interface MaterialLibraryOptions {
  /** Materials to register up front. */
  materials?: readonly Material[];
  /** Override the fallback material (defaults to {@link DEFAULT_MATERIAL}). */
  defaultMaterial?: Material;
}

/** Create a {@link MaterialLibrary}, optionally seeded with materials. */
export function createMaterialLibrary(
  options: MaterialLibraryOptions = {},
): MaterialLibrary {
  const defaultMaterial = options.defaultMaterial ?? DEFAULT_MATERIAL;
  const store = new Map<MaterialId, Material>();
  for (const material of options.materials ?? []) {
    store.set(material.id, material);
  }
  return {
    defaultMaterial,
    register(material: Material): void {
      store.set(material.id, material);
    },
    get(id: MaterialId): Material {
      return store.get(id) ?? defaultMaterial;
    },
    has(id: MaterialId): boolean {
      return store.has(id);
    },
  };
}
