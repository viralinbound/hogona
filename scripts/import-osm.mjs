#!/usr/bin/env node
/**
 * Imports Namma Metro and BMTC route data for Bengaluru from OpenStreetMap
 * (Overpass API) and writes the bundled JSON datasets in src/data/.
 *
 * Data licence: OpenStreetMap contributors, ODbL 1.0. Attribution is shown in-app.
 *
 * Usage:
 *   node scripts/import-osm.mjs            # fetch live from Overpass
 *   node scripts/import-osm.mjs --cache    # reuse scripts/.cache/*.json if present
 *
 * Only route relations that OSM mappers have entered are imported. Nothing is
 * generated or guessed: a bus route that is not mapped in OSM is not in the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data');
const CACHE = path.join(ROOT, 'scripts', '.cache');
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const UA = 'Hogona-dataimport/1.0 (+https://github.com/; contact via project README)';
const BBOX = '12.75,77.35,13.25,77.85';
const useCache = process.argv.includes('--cache');

// One direction per line is enough: stations and track are shared by both directions.
// Relations are chosen as the full-length relation for each line (see README "Data sources").
const METRO_LINES = [
  // `track` lists the relations (both directions) whose ways form the track graph.
  { id: 'purple', relation: 7841331, track: [7841331, 1798771], name: 'Purple Line', colour: '#8E44AD' },
  { id: 'green', relation: 7842287, track: [7842287, 1798772], name: 'Green Line', colour: '#1E9E4A' },
  { id: 'yellow', relation: 19421944, track: [19421944, 19421927], name: 'Yellow Line', colour: '#E0B000' },
];

async function overpass(name, query) {
  const file = path.join(CACHE, `${name}.json`);
  if (useCache && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Fetching ${name} from Overpass...`);
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${name}: HTTP ${res.status}`);
  const json = await res.json();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json));
  return json;
}

const R = 6371000;
function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const round = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

/** Douglas-Peucker simplification on [lat, lon] points with tolerance in metres. */
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const kx = 111320 * Math.cos((12.97 * Math.PI) / 180);
  const ky = 110540;
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = [points[s][1] * kx, points[s][0] * ky];
    const [bx, by] = [points[e][1] * kx, points[e][0] * ky];
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = [points[i][1] * kx, points[i][0] * ky];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maxD) [maxD, idx] = [d, i];
    }
    if (maxD > tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Builds an undirected graph of OSM track nodes from the relation's ways, so the
 * along-track path between two stations can be found regardless of way order.
 */
function trackGraph(ways) {
  const coord = new Map();
  const adj = new Map();
  const link = (u, v, d) => {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push([v, d]);
  };
  for (const w of ways) {
    w.nodes.forEach((id, i) => coord.set(id, [w.geometry[i].lat, w.geometry[i].lon]));
    for (let i = 1; i < w.nodes.length; i++) {
      const d = haversine(coord.get(w.nodes[i - 1]), coord.get(w.nodes[i]));
      link(w.nodes[i - 1], w.nodes[i], d);
      link(w.nodes[i], w.nodes[i - 1], d);
    }
  }
  // Close small mapping gaps (ways that touch but do not share a node).
  const ids = [...coord.keys()];
  const grid = new Map();
  for (const id of ids) {
    const [la, lo] = coord.get(id);
    const k = `${Math.floor(la * 2000)}:${Math.floor(lo * 2000)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(id);
  }
  for (const id of ids) {
    if ((adj.get(id) || []).length > 1) continue; // only dangling ends
    const [la, lo] = coord.get(id);
    const [ci, cj] = [Math.floor(la * 2000), Math.floor(lo * 2000)];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++)
        for (const o of grid.get(`${ci + di}:${cj + dj}`) || []) {
          if (o === id) continue;
          const d = haversine(coord.get(id), coord.get(o));
          if (d < 40) {
            link(id, o, d);
            link(o, id, d);
          }
        }
  }
  return { coord, adj };
}

function nearestNode(g, p) {
  let best = null;
  let bestD = Infinity;
  for (const [id, c] of g.coord) {
    const d = haversine(c, p);
    if (d < bestD) [best, bestD] = [id, d];
  }
  return { id: best, offset: bestD };
}

/** Dijkstra over the track graph; returns length (m) and polyline. */
function trackPath(g, from, to) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  const queue = [[0, from]];
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, u] = queue.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const [v, w] of g.adj.get(u) || []) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        queue.push([nd, v]);
      }
    }
  }
  if (!dist.has(to)) return null;
  const ids = [to];
  while (ids[0] !== from) ids.unshift(prev.get(ids[0]));
  return { m: dist.get(to), points: ids.map((id) => g.coord.get(id)) };
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function importMetro() {
  const ids = [...new Set(METRO_LINES.flatMap((l) => l.track))].join(',');
  const data = await overpass('metro', `[out:json][timeout:170];relation(id:${ids})->.r;.r out body;way(r.r);out geom;node(r.r);out body;`);
  const byKey = new Map(data.elements.map((e) => [`${e.type}/${e.id}`, e]));
  const stations = new Map();
  const lines = [];

  for (const cfg of METRO_LINES) {
    const rel = byKey.get(`relation/${cfg.relation}`);
    if (!rel) throw new Error(`Relation ${cfg.relation} missing`);
    const stopNodes = rel.members
      .filter((m) => m.type === 'node' && m.role.startsWith('stop'))
      .map((m) => byKey.get(`node/${m.ref}`))
      .filter(Boolean);
    const ways = cfg.track
      .flatMap((rid) => byKey.get(`relation/${rid}`)?.members || [])
      .filter((m) => m.type === 'way' && (m.role === '' || m.role === 'forward'))
      .map((m) => byKey.get(`way/${m.ref}`))
      .filter((w) => w && w.geometry);
    const g = trackGraph(ways);
    const snaps = stopNodes.map((n) => nearestNode(g, [n.lat, n.lon]));
    const segments = [];
    let cum = 0;
    const chain = [0];
    for (let i = 1; i < snaps.length; i++) {
      let seg = trackPath(g, snaps[i - 1].id, snaps[i].id);
      if (!seg) {
        const a = [stopNodes[i - 1].lat, stopNodes[i - 1].lon];
        const b = [stopNodes[i].lat, stopNodes[i].lon];
        console.warn(`${cfg.id}: track gap between stops ${i - 1} and ${i}; using straight distance x1.1`);
        seg = { m: haversine(a, b) * 1.1, points: [a, b] };
      }
      cum += seg.m;
      chain.push(cum);
      segments.push(simplify(seg.points, 10).map(([a, b]) => [round(a, 5), round(b, 5)]));
    }
    const stationIds = [];
    stopNodes.forEach((n, i) => {
      const rawName = n.tags.name.replace(/\s*\((Purple|Green|Yellow) Line\)/i, '');
      const id = `${cfg.id}-${slug(rawName)}`;
      stationIds.push(id);
      stations.set(id, {
        id,
        name: rawName,
        nameKn: n.tags['name:kn'] || null,
        lat: round(n.lat),
        lon: round(n.lon),
        line: cfg.id,
        osmId: `node/${n.id}`,
        chainageM: Math.round(chain[i]),
        trackOffsetM: Math.round(snaps[i].offset),
      });
    });
    lines.push({
      id: cfg.id,
      name: cfg.name,
      colour: cfg.colour,
      osmRelation: cfg.relation,
      stations: stationIds,
      trackLengthM: Math.round(cum),
      segments,
    });
  }

  // Interchanges: stations of different lines within 350 m (Majestic, RV Road).
  const all = [...stations.values()];
  const transfers = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.line === b.line) continue;
      const d = haversine([a.lat, a.lon], [b.lat, b.lon]);
      if (d < 350) transfers.push({ from: a.id, to: b.id, walkM: Math.round(d), name: a.name });
    }
  return { stations: all, lines, transfers, osmBase: data.osm3s?.timestamp_osm_base };
}

async function importBus() {
  const rels = await overpass('bus', `[out:json][timeout:270];relation["route"="bus"](${BBOX});out body;`);
  const nodes = await overpass('busnodes', `[out:json][timeout:270];relation["route"="bus"](${BBOX})->.r;node(r.r);out body;`);
  const nodeById = new Map(nodes.elements.map((n) => [n.id, n]));
  const stops = []; // merged stops
  const grid = new Map();
  const cell = (lat, lon) => `${Math.floor(lat * 500)}:${Math.floor(lon * 500)}`;

  /** Merges OSM nodes with the same name within 80 m into one stop. */
  function stopFor(n) {
    const name = (n.tags?.name || '').trim();
    if (!name) return null;
    const [ci, cj] = cell(n.lat, n.lon).split(':').map(Number);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++)
        for (const s of grid.get(`${ci + di}:${cj + dj}`) || [])
          if (s.name.toLowerCase() === name.toLowerCase() && haversine([s.lat, s.lon], [n.lat, n.lon]) < 80) return s;
    const s = { id: `bmtc-${n.id}`, name, nameKn: n.tags['name:kn'] || null, lat: round(n.lat), lon: round(n.lon), osmId: `node/${n.id}` };
    stops.push(s);
    const k = cell(n.lat, n.lon);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
    return s;
  }

  const routes = [];
  for (const r of rels.elements.filter((e) => e.type === 'relation')) {
    const t = r.tags || {};
    const net = `${t.network || ''} ${t.operator || ''}`;
    if (!/BMTC|Bengaluru Metro(politan)? Tran|Big 10|Metro Feeder/i.test(net)) continue;
    if (t.disused || t['disused:route']) continue;
    const byRole = (prefix) =>
      r.members.filter((m) => m.type === 'node' && m.role.startsWith(prefix)).map((m) => nodeById.get(m.ref)).filter(Boolean);
    let members = byRole('platform');
    if (members.filter((n) => n.tags?.name).length < 5) members = byRole('stop');
    const seq = [];
    for (const n of members) {
      const s = stopFor(n);
      if (s && seq[seq.length - 1] !== s.id) seq.push(s.id);
    }
    if (seq.length < 5) continue;
    routes.push({
      id: `bmtc-r${r.id}`,
      ref: t.ref || null,
      name: t.name || t.ref || `Route ${r.id}`,
      from: t.from || null,
      to: t.to || null,
      operator: 'BMTC',
      ac: /vajra|vayu|ac\b/i.test(`${t.name} ${t.ref}`) || /^(V-|KIA)/i.test(t.ref || ''),
      osmRelation: r.id,
      stops: seq,
    });
  }
  const used = new Set(routes.flatMap((r) => r.stops));
  return { stops: stops.filter((s) => used.has(s.id)), routes, osmBase: rels.osm3s?.timestamp_osm_base };
}

const metro = await importMetro();
const bus = await importBus();
const write = (f, d) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(d) + '\n');
fs.mkdirSync(OUT, { recursive: true });
write('metro-stations.json', metro.stations);
write('metro-lines.json', metro.lines);
write('metro-transfers.json', metro.transfers);
write('bmtc-stops.json', bus.stops);
write('bmtc-routes.json', bus.routes);

const manifestPath = path.join(OUT, 'dataset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
manifest.datasets.metro.importedOn = today;
manifest.datasets.metro.osmSnapshot = metro.osmBase;
manifest.datasets.bmtc.importedOn = today;
manifest.datasets.bmtc.osmSnapshot = bus.osmBase;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Metro: ${metro.lines.length} lines, ${metro.stations.length} stations, ${metro.transfers.length} interchanges`);
metro.lines.forEach((l) => console.log(`  ${l.name}: ${l.stations.length} stations, ${(l.trackLengthM / 1000).toFixed(2)} km`));
console.log(`BMTC: ${bus.routes.length} routes, ${bus.stops.length} stops`);
const badOffset = metro.stations.filter((s) => s.trackOffsetM > 150);
if (badOffset.length) console.warn('Stations far from track (check chaining):', badOffset.map((s) => s.id));
