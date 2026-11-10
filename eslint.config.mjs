import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'build/**',
      '.claude/**',
      // The custom host configuration is not part of the repository
      'host-config.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    ...react.configs.flat.recommended,
    ...react.configs.flat['jsx-runtime'],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    plugins: {
      react,
      // Only the classic hook rules: the rest of react-hooks 7 targets the React Compiler
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['src/**/*.test.js', 'src/setupTests.js', 'src/**/test-utils/**/*.js'],
    languageOptions: { globals: { ...globals.vitest, ...globals.node } },
  },
  {
    files: ['vite.config.mjs', 'eslint.config.mjs', 'style-embedder/**/*.js', 'sw-build/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Runs inside the service worker, where workbox-sw defines 'workbox'
    files: ['sw-build/template.js'],
    languageOptions: { globals: { ...globals.serviceworker, workbox: 'readonly' } },
  },
];
