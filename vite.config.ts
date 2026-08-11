import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';

/**
 * `worlds/` (world manifests, layer manifests, strings, and .geojson data —
 * see design spec Section 10) lives at the project root, sibling to `src/`,
 * not inside `publicDir` (this repo has no `public/` directory). Vite's dev
 * server happens to serve any file under the project root, so
 * `fetch('/worlds/demo/...')` works fine under `npm run dev` — but the
 * production build only emits the bundled module graph plus a copy of
 * `publicDir`, so `worlds/` is otherwise absent from `dist/` and every one of
 * `main.ts`'s runtime `fetch()` calls 404s once deployed as a static site.
 * This plugin copies `worlds/` into the build output directory after the
 * bundle is written, without requiring a new dependency or moving `worlds/`
 * out of the documented folder structure.
 *
 * In an isolated per-world build (`vite build --mode <world-id>`, see
 * `resolveWorldId`), only that one world's folder is copied — every other
 * world's data is absent from `dist/`, so a domain built for one world
 * never ships another world's content.
 */
function copyWorldsDirPlugin(): Plugin {
  let rootDir = process.cwd();
  let outDir = 'dist';
  let mode = 'production';

  return {
    name: 'copy-worlds-dir',
    apply: 'build',
    configResolved(resolvedConfig) {
      rootDir = resolvedConfig.root;
      outDir = resolvedConfig.build.outDir;
      mode = resolvedConfig.mode;
    },
    async closeBundle() {
      const isolatedWorld = mode === 'development' || mode === 'production' ? null : mode;
      const srcDir = resolve(rootDir, 'worlds', ...(isolatedWorld ? [isolatedWorld] : []));
      if (!existsSync(srcDir)) return;
      const destDir = resolve(rootDir, outDir, 'worlds', ...(isolatedWorld ? [isolatedWorld] : []));
      await cp(srcDir, destDir, { recursive: true });
    },
  };
}

export default defineConfig({
  // Relative, not an absolute '/...' path: this app is deployed as a GitHub
  // Pages project site (served from '/<repo>/', not the domain root), and a
  // relative base keeps the built asset references correct there without
  // hardcoding the repo name — same build also works served from a domain
  // root or any other subpath.
  base: './',
  plugins: [copyWorldsDirPlugin()],
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
