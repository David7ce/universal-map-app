import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { configDefaults } from 'vitest/config';
import { isIsolatedWorldMode } from './src/engine/manifests/resolve-world-id';

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
      const isolatedWorld = isIsolatedWorldMode(mode) ? mode : null;
      const srcDir = resolve(rootDir, 'worlds', ...(isolatedWorld ? [isolatedWorld] : []));
      if (!existsSync(srcDir)) {
        if (isolatedWorld) {
          throw new Error(`copy-worlds-dir: no "worlds/${isolatedWorld}/" found for --mode ${mode}`);
        }
        return;
      }
      const destDir = resolve(rootDir, outDir, 'worlds', ...(isolatedWorld ? [isolatedWorld] : []));
      await cp(srcDir, destDir, { recursive: true });
    },
  };
}

/**
 * Path-based world routing: `/world-leaders/` loads the `world-leaders`
 * world, `/` loads the default. A static host has no server to rewrite
 * those paths, so this plugin emits a copy of `index.html` at
 * `<world-id>/index.html` for every world folder under `worlds/` — the
 * browser requests `/world-leaders/`, the host serves
 * `/world-leaders/index.html`, and the app reads the world id from
 * `location.pathname` (see `resolveWorldId`).
 *
 * `base: './'` makes the built asset references relative (`./assets/...`),
 * which would resolve to `/world-leaders/assets/...` from that nested copy
 * and 404. The app's `<base href="./">` (index.html) is what every relative
 * URL resolves against, so the nested copies get it rewritten to `../` —
 * one level up, back to the real files. That single rewrite fixes the built
 * assets, the runtime `worlds/...` fetches, and image paths in world data
 * all at once.
 *
 * In dev there's no build output to copy, so `configureServer` rewrites a
 * `/world-leaders/` request to `/index.html` instead (Vite's own SPA
 * fallback only handles extensionless paths, not a trailing-slash
 * directory).
 */
function worldRoutesPlugin(): Plugin {
  let rootDir = process.cwd();
  let outDir = 'dist';
  let mode = 'production';

  return {
    name: 'world-routes',
    configResolved(resolvedConfig) {
      rootDir = resolvedConfig.root;
      outDir = resolvedConfig.build.outDir;
      mode = resolvedConfig.mode;
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const match = url.match(/^\/([a-zA-Z0-9_-]+)\/(?:\?.*)?$/);
        if (!match || !existsSync(resolve(rootDir, 'worlds', match[1]))) return next();

        // Serve index.html with the same `<base href="../">` rewrite the
        // build applies, so relative `worlds/...` fetches resolve to the app
        // root rather than the nested world path. `transformIndexHtml` keeps
        // Vite's own dev transforms (HMR client, module rewriting) intact.
        const html = await readFile(resolve(rootDir, 'index.html'), 'utf8');
        const nested = html.replace(/(<base\s+href=")\.\//, '$1../');
        const transformed = await server.transformIndexHtml(url, nested);
        res.setHeader('Content-Type', 'text/html');
        res.end(transformed);
      });
    },
    async closeBundle() {
      // An isolated per-world build already serves that world at `/` — no
      // nested route needed.
      if (isIsolatedWorldMode(mode)) return;

      const worldsDir = resolve(rootDir, 'worlds');
      if (!existsSync(worldsDir)) return;

      const builtIndexPath = resolve(rootDir, outDir, 'index.html');
      if (!existsSync(builtIndexPath)) return;
      const builtIndex = await readFile(builtIndexPath, 'utf8');
      // `<base href="./">` -> `<base href="../">` so every relative URL in
      // the nested copy resolves one level up, to the real app root.
      const nestedIndex = builtIndex.replace(/(<base\s+href=")\.\//, '$1../');

      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(worldsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const destDir = resolve(rootDir, outDir, entry.name);
        await mkdir(destDir, { recursive: true });
        await writeFile(resolve(destDir, 'index.html'), nestedIndex);
      }
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
  plugins: [copyWorldsDirPlugin(), worldRoutesPlugin()],
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
