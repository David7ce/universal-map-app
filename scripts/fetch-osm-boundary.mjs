#!/usr/bin/env node
// Fetches an administrative boundary relation from OpenStreetMap (via the
// Overpass API) and writes it as a single-feature GeoJSON FeatureCollection
// ready to use as a `regionRole: "boundary"` layer (see
// worlds/demo/layers/regions.layer.json for the layer.json side).
//
// Usage:
//   node scripts/fetch-osm-boundary.mjs "<OSM name tag>" <admin_level> <output-path> [propertiesJson]
//
// Example (used for worlds/paranormal-espana/data/regions.geojson):
//   node scripts/fetch-osm-boundary.mjs "La Orotava" 8 worlds/paranormal-espana/data/regions.geojson \
//     '{"province":"Santa Cruz de Tenerife","autonomousCommunity":"Canarias"}'
//
// `admin_level` follows OSM's convention — 8 is a Spanish municipio, 4 is a
// comunidad autónoma/province-level region, etc. (varies by country). Ways
// tagged with multiple `role: "outer"` segments are chained end-to-end into
// one closed ring; if OSM has the boundary split into disjoint pieces
// (islands, enclaves), only the largest ring is kept — rerun per-piece with
// a more specific query if that's wrong for a given place.
//
// One-time data-authoring tool, not part of the running app — no test
// suite coverage, matching this repo's convention for scripts under this
// directory (`docs/schemas/*.schema.json` and the layer it produces are
// what's actually validated at runtime).

const [, , name, adminLevel, outputPath, propertiesJson] = process.argv;

if (!name || !adminLevel || !outputPath) {
  console.error('Usage: node scripts/fetch-osm-boundary.mjs "<name>" <admin_level> <output-path> [propertiesJson]');
  process.exit(1);
}

const query = `[out:json][timeout:25];relation["name"="${name}"]["admin_level"="${adminLevel}"]["boundary"="administrative"];out geom;`;
const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
  headers: { 'User-Agent': 'universal-map-app/fetch-osm-boundary (one-time data-authoring script)' },
});
if (!response.ok) {
  throw new Error(`Overpass API request failed: ${response.status} ${response.statusText}`);
}
const raw = await response.json();

const relation = raw.elements.find((el) => el.type === 'relation');
if (!relation) {
  throw new Error(`No relation found for name="${name}" admin_level="${adminLevel}" — check the name/level match OSM's tags.`);
}

const ways = relation.members
  .filter((m) => m.type === 'way' && m.role === 'outer')
  .map((m) => m.geometry.map((p) => [p.lon, p.lat]));

const EPS = 1e-7;
const sameCoord = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

// Chains way segments end-to-end into one or more closed rings — a
// boundary relation's member ways aren't guaranteed to arrive in
// connected order or a consistent direction.
function assembleRings(segments) {
  const remaining = segments.slice();
  const rings = [];
  while (remaining.length > 0) {
    let ring = remaining.shift();
    let extended = true;
    while (extended && !sameCoord(ring[0], ring[ring.length - 1])) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const tail = ring[ring.length - 1];
        if (sameCoord(seg[0], tail)) {
          ring = ring.concat(seg.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (sameCoord(seg[seg.length - 1], tail)) {
          ring = ring.concat(seg.slice(0, -1).reverse());
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }
    rings.push(ring);
  }
  return rings;
}

const rings = assembleRings(ways);
rings.sort((a, b) => b.length - a.length);
const outerRing = rings[0];
if (!sameCoord(outerRing[0], outerRing[outerRing.length - 1])) {
  outerRing.push(outerRing[0]);
}

if (rings.length > 1) {
  console.error(
    `Warning: OSM relation had ${rings.length} disjoint ring(s) (lengths: ${rings.map((r) => r.length).join(', ')}) — kept only the largest. If "${name}" genuinely has multiple pieces (e.g. islands), this output is incomplete.`,
  );
}

const feature = {
  type: 'Feature',
  id: relation.tags.name.toLowerCase().replace(/\s+/g, '-'),
  properties: {
    name: relation.tags.name,
    ...(propertiesJson ? JSON.parse(propertiesJson) : {}),
    osmRelationId: relation.id,
    source: 'OpenStreetMap contributors, via Overpass API',
  },
  geometry: { type: 'Polygon', coordinates: [outerRing] },
};

const { writeFileSync } = await import('node:fs');
writeFileSync(outputPath, JSON.stringify({ type: 'FeatureCollection', features: [feature] }, null, 2) + '\n');
console.error(`Wrote "${feature.properties.name}" (${outerRing.length} ring points, OSM relation ${relation.id}) to ${outputPath}`);
