import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages project URLs and on a custom domain alike.
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 2048, chunkSizeWarningLimit: 900 },
});
