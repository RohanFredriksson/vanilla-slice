import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Resolve a workspace-relative path to an absolute filesystem path. */
const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

// Alias the framework-free core packages to their TypeScript source so tests
// run against source without a prior build step. Adapter/framework packages
// (renderer-three, angular) are intentionally excluded — they are not headless.
export default defineConfig({
  resolve: {
    alias: {
      '@vanilla-slice/math': fromRoot('./packages/math/src/index.ts'),
      '@vanilla-slice/geometry': fromRoot('./packages/geometry/src/index.ts'),
      '@vanilla-slice/physics': fromRoot('./packages/physics/src/index.ts'),
      '@vanilla-slice/spatial': fromRoot('./packages/spatial/src/index.ts'),
      '@vanilla-slice/slicing': fromRoot('./packages/slicing/src/index.ts'),
      '@vanilla-slice/core': fromRoot('./packages/core/src/index.ts'),
      '@vanilla-slice/runtime': fromRoot('./packages/runtime/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.{spec,test}.ts', 'apps/**/*.{spec,test}.ts'],
  },
});
