import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const srcDir = fileURLToPath(new URL('./src/', import.meta.url));

// Resolve 'host-config' to the custom host configuration at the repository root if there is one
// Otherwise resolve it to a module which exports the default host configuration
const customHostConfig = fileURLToPath(new URL('./host-config.js', import.meta.url));
const defaultHostConfigId = '\0default-host-config';
const hostConfigPlugin = {
  name: 'host-config',
  enforce: 'pre',
  resolveId(id) {
    if (id !== 'host-config') return null;
    return existsSync(customHostConfig) ? customHostConfig : defaultHostConfigId;
  },
  // When the custom host configuration is created or deleted, resolve 'host-config' again and reload the page
  configureServer(server) {
    server.watcher.add(customHostConfig);
    const onChange = path => {
      if (path !== customHostConfig) return;
      server.moduleGraph.invalidateAll();
      server.ws.send({ type: 'full-reload' });
    };
    server.watcher.on('add', onChange);
    server.watcher.on('unlink', onChange);
  },
  load(id) {
    if (id !== defaultHostConfigId) return null;
    return "import { getDefaultHostConfig } from 'src/utils/constants/default-host-config';\n"
      + "export default getDefaultHostConfig(window.location.hostname);";
  },
};

export default defineConfig({
  // Same as CRA's "homepage": "." (the build is served from many hosts and sub-paths)
  base: './',
  // Keep the CRA variable names so .env stays as it is
  envPrefix: 'REACT_APP_',
  plugins: [hostConfigPlugin, react({ include: /\.(js|jsx|ts|tsx)$/ })],
  // JSX lives in .js files (CRA allows it, Vite/esbuild doesn't by default).
  // The tsx loader parses both the JSX in .js files and the two .ts files
  // The custom host configuration at the repository root may have JSX too
  esbuild: { loader: 'tsx', include: [/src\/.*\.[jt]sx?$/, /\/host-config\.js$/], exclude: [] },
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
    // As CRA's jest config did, reset every mock's calls and implementation before each test
    mockReset: true,
    // Node 25+ defines its own global localStorage (undefined without --localstorage-file),
    // which hides jsdom's
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
  build: {
    outDir: 'build',
    // Mol* alone is ~3 MB, warnings about it are expected
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // Vite replaces Node builtins with an empty module in the browser, e.g. 'events' for readable-stream,
      // which https-browserify and stream-http use. Their polyfills must be installed instead, or every
      // request through them crashes, so stop the build when one is missing
      onwarn(warning, warn) {
        if (warning.plugin === 'vite:resolve' && warning.message.includes('externalized for browser compatibility'))
          throw new Error(warning.message);
        warn(warning);
      },
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
