// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Plain Node scripts (scripts/fetch-osm-boundary.mjs) — not part of the
    // browser app, so they don't get DOM globals from tsconfig's "lib" the
    // way .ts files under src/ do. Scoped here rather than pulling in the
    // `globals` package for four names.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', fetch: 'readonly' },
    },
  },
  eslintConfigPrettier,
);
