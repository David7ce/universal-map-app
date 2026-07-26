/// <reference types="vitest/config" />
import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * `apps/` (app manifests, layer manifests, strings, and .geojson data — see
 * design spec Section 10) lives at the project root, sibling to `src/`, not
 * inside `publicDir` (this repo has no `public/` directory). Vite's dev
 * server happens to serve any file under the project root, so
 * `fetch('/apps/demo/...')` works fine under `npm run dev` — but the
 * production build only emits the bundled module graph plus a copy of
 * `publicDir`, so `apps/` is otherwise absent from `dist/` and every one of
 * `main.ts`'s runtime `fetch()` calls 404s once deployed as a static site.
 * This plugin copies `apps/` into the build output directory after the
 * bundle is written, without requiring a new dependency or moving `apps/`
 * out of the documented folder structure.
 */
function copyAppsDirPlugin(): Plugin {
  let rootDir = process.cwd();
  let outDir = 'dist';

  return {
    name: 'copy-apps-dir',
    apply: 'build',
    configResolved(resolvedConfig) {
      rootDir = resolvedConfig.root;
      outDir = resolvedConfig.build.outDir;
    },
    async closeBundle() {
      const srcDir = resolve(rootDir, 'apps');
      if (!existsSync(srcDir)) return;
      const destDir = resolve(rootDir, outDir, 'apps');
      await cp(srcDir, destDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [copyAppsDirPlugin()],
  test: {
    environment: 'node',
  },
});
