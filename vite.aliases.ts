import { fileURLToPath } from 'node:url';

/** Resolve a repo-relative path to an absolute filesystem path. */
const abs = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

/**
 * Vite path aliases mapping each engine package to its TypeScript source, so the
 * demo apps run against source during dev/build without a separate library build
 * step. Shared by every app's `vite.config.ts`.
 */
export const sliceAliases: Record<string, string> = {
  '@vanilla-slice/math': abs('./packages/math/src/index.ts'),
  '@vanilla-slice/geometry': abs('./packages/geometry/src/index.ts'),
  '@vanilla-slice/physics': abs('./packages/physics/src/index.ts'),
  '@vanilla-slice/spatial': abs('./packages/spatial/src/index.ts'),
  '@vanilla-slice/slicing': abs('./packages/slicing/src/index.ts'),
  '@vanilla-slice/core': abs('./packages/core/src/index.ts'),
  '@vanilla-slice/renderer-three': abs('./packages/renderer-three/src/index.ts'),
  '@vanilla-slice/runtime': abs('./packages/runtime/src/index.ts'),
};
