import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  // Same as CRA's "homepage": "." (the build is served from many hosts and sub-paths)
  base: './',
  // Keep the CRA variable names so .env stays as it is
  envPrefix: 'REACT_APP_',
  plugins: [react({ include: /\.(js|jsx|ts|tsx)$/ })],
  // JSX lives in .js files (CRA allows it, Vite/esbuild doesn't by default).
  // The tsx loader parses both the JSX in .js files and the two .ts files
  esbuild: { loader: 'tsx', include: /src\/.*\.[jt]sx?$/, exclude: [] },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
      define: { global: 'globalThis' },
    },
  },
  define: { global: 'globalThis' },
  resolve: {
    alias: [
      // tsconfig "baseUrl": "." absolute imports, e.g. 'src/utils/constants'
      { find: /^src\//, replacement: srcDir },
    ],
  },
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,ts}'],
    // Node 25+ defines its own global localStorage (undefined without --localstorage-file),
    // which hides jsdom's
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
  build: {
    outDir: 'build',
    // Mol* alone is ~3 MB, warnings about it are expected
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        // CRA-like layout, so sw-build and style-embedder keep working with small changes
        entryFileNames: 'static/js/main.[hash].js',
        chunkFileNames: 'static/js/[name].[hash].chunk.js',
        assetFileNames: ({ name = '' }) =>
          name.endsWith('.css')
            ? 'static/css/[name].[hash][extname]'
            : 'static/media/[name].[hash][extname]',
      },
    },
  },
});
