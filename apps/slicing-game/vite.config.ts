import { defineConfig } from 'vite';
import { sliceAliases } from '../../vite.aliases';

// Dev server / bundler for the fruit demo. Engine packages resolve to source via
// shared aliases; `three` resolves from node_modules. Type-checking stays with
// the `tsc` build target — Vite only transpiles.
export default defineConfig({
  resolve: {
    alias: { ...sliceAliases },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
});
