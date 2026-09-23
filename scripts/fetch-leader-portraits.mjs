// One-off helper: download each world-leaders portrait from Wikimedia into
// worlds/world-leaders/assets/portraits/ and rewrite the feature's
// `portrait` property to the local relative path.
//
// Why: the original hand-written `.../thumb/<a>/<ab>/<File>/480px-<File>`
// URLs now return HTTP 400 (Wikimedia rejects arbitrary hotlinked thumbnail
// widths — see https://www.mediawiki.org/wiki/Common_thumbnail_sizes), and
// several filenames turned out not to exist on Commons at all. Rather than
// depend on an external host's evolving rules and fragile hand-typed paths,
// this resolves each leader's current lead image via the Wikipedia API, then
// downloads it once and commits it as a static asset — matching the engine's
// no-backend, static-files philosophy.
//
// Run: node scripts/fetch-leader-portraits.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const geojsonPath = resolve(rootDir, 'worlds/world-leaders/data/leaders.geojson');
const outDir = resolve(rootDir, 'worlds/world-leaders/assets/portraits');

const WIDTH = 400;
const USER_AGENT = 'universal-map-app-portrait-fetch/1.0 (https://github.com/; contact: repo maintainer)';

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function resolveThumbnailUrl(leaderName) {
  for (const lang of ['es', 'en']) {
    const api =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=${WIDTH}` +
      `&titles=${encodeURIComponent(leaderName)}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(api, { headers: { 'User-Agent': USER_AGENT } });
      if (response.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!response.ok) break;
      const data = await response.json();
      const pages = Object.values(data?.query?.pages ?? {});
      const thumb = pages.find((page) => page?.thumbnail?.source)?.thumbnail?.source;
      if (thumb) return thumb;
      break;
    }
  }
  return null;
}

function localName(featureId, url) {
  const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const ext = (match ? match[1] : 'jpg').toLowerCase();
  return `${featureId.replace(/^leader-/, '')}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

async function main() {
  const geojson = JSON.parse(await readFile(geojsonPath, 'utf8'));
  await mkdir(outDir, { recursive: true });

  const failures = [];

  for (const feature of geojson.features) {
    const leader = feature.properties.leader ?? feature.properties.name;
    const thumbUrl = await resolveThumbnailUrl(leader);
    if (!thumbUrl) {
      failures.push(`${feature.id} (${leader}): no thumbnail found`);
      continue;
    }

    const localFile = localName(feature.id, thumbUrl);
    console.log(`GET  ${feature.id} (${leader}) -> ${localFile}`);

    const response = await fetch(thumbUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      failures.push(`${feature.id}: ${response.status} ${thumbUrl}`);
      continue;
    }

    await writeFile(resolve(outDir, localFile), Buffer.from(await response.arrayBuffer()));
    feature.properties.portrait = `worlds/world-leaders/assets/portraits/${localFile}`;
    await sleep(400);
  }

  await writeFile(geojsonPath, `${JSON.stringify(geojson, null, 2)}\n`);
  console.log(`Wrote ${geojsonPath}`);

  if (failures.length) {
    console.warn('\nFailures:');
    for (const failure of failures) console.warn(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
