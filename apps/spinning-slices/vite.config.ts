import { defineConfig } from 'vite';
import { sliceAliases } from '../../vite.aliases';

// Dev server / bundler for the spinning-slices showcase. Engine packages resolve
// to source via shared aliases; type-checking stays with the `tsc` build target.
export default defineConfig({
  resolve: {
    alias: { ...sliceAliases },
  },
  server: {
    port: 5174,
    open: false,
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
});
