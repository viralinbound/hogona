#!/usr/bin/env node
/**
 * Imports a BMTC GTFS feed that YOU ARE LICENSED TO USE and replaces the
 * OSM-derived bus datasets (src/data/bmtc-stops.json, bmtc-routes.json) and
 * writes per-route headways to src/data/bmtc-schedules.json.
 *
 * Usage:  npm run data:gtfs -- <path-to-unzipped-gtfs-folder> "<licence text>" "<source url>"
 *
 * Required files: stops.txt, routes.txt, trips.txt, stop_times.txt.
 * For each route and direction, the trip with the most stops is used as the
 * stop pattern. Headway = service span / trips (an average, labelled as such).
 *
 * Check the licence first. The community feed at github.com/Vonter/bmtc-gtfs is
 * ODbL but notes that some contents are BMTC's copyright and that its
 * timetables are inaccurate. BMTC publishes no official open GTFS feed
 * (checked 2026-10-22).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data');
const [dir, licence, source] = process.argv.slice(2);
if (!dir || !licence) {
  console.error('Usage: npm run data:gtfs -- <gtfs-folder> "<licence>" "<source url>"');
  process.exit(1);
}

function parseLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

async function* rows(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, file), 'utf8'), crlfDelay: Infinity });
  let header = null;
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, '');
    if (!line.trim()) continue;
    const cells = parseLine(line);
    if (!header) {
      header = cells.map((h) => h.trim());
      continue;
    }
    yield Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  }
}

const toSec = (t) => {
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};
const fmt = (sec) => `${String(Math.floor(sec / 3600) % 24).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;

const stops = new Map();
for await (const r of rows('stops.txt')) {
  const lat = Number(r.stop_lat);
  const lon = Number(r.stop_lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  stops.set(r.stop_id, { id: `gtfs-${r.stop_id}`, name: (r.stop_name || '').trim(), nameKn: null, lat: +lat.toFixed(6), lon: +lon.toFixed(6), osmId: `gtfs:${r.stop_id}`, ...(r.zone_id ? { zone: r.zone_id } : {}) });
}

const routes = new Map();
for await (const r of rows('routes.txt')) routes.set(r.route_id, r);

const trips = new Map();
for await (const t of rows('trips.txt')) trips.set(t.trip_id, { route: t.route_id, dir: t.direction_id || '0', stops: [], first: null });

for await (const st of rows('stop_times.txt')) {
  const t = trips.get(st.trip_id);
  if (!t) continue;
  t.stops.push([Number(st.stop_sequence), st.stop_id]);
  if (st.departure_time && Number(st.stop_sequence) <= (t.firstSeq ?? Infinity)) {
    t.firstSeq = Number(st.stop_sequence);
    t.first = toSec(st.departure_time);
  }
}

const patterns = new Map();
for (const t of trips.values()) {
  const key = `${t.route}|${t.dir}`;
  t.stops.sort((a, b) => a[0] - b[0]);
  const p = patterns.get(key) ?? { best: null, starts: [] };
  if (!p.best || t.stops.length > p.best.stops.length) p.best = t;
  if (t.first !== null) p.starts.push(t.first);
  patterns.set(key, p);
}

const outRoutes = [];
const schedules = {};
for (const [key, p] of patterns) {
  const [routeId, dir] = key.split('|');
  const r = routes.get(routeId);
  const seq = p.best.stops.map(([, id]) => stops.get(id)?.id).filter(Boolean);
  if (seq.length < 2) continue;
  const id = `bmtc-g${routeId}-${dir}`;
  const name = r?.route_long_name || r?.route_short_name || routeId;
  outRoutes.push({
    id,
    // Public route number: BMTC short names carry depot/variant codes after a space ("350-E KBS-NJP").
    ref: (r?.route_short_name || '').trim().split(/\s+/)[0] || null,
    gtfsRouteId: routeId,
    name,
    from: stops.get(p.best.stops[0][1])?.name ?? null,
    to: stops.get(p.best.stops.at(-1)[1])?.name ?? null,
    // The Namma BMTC feed also carries KSRTC intercity services (route names "KSRTC-…").
    operator: /^KSRTC/i.test(r?.route_short_name || '') ? 'KSRTC' : 'BMTC',
    ac: /vajra|vayu|\bac\b/i.test(name) || /^(V-|KIA)/i.test(r?.route_short_name || ''),
    osmRelation: 0,
    stops: seq,
  });
  const starts = p.starts.sort((a, b) => a - b);
  if (starts.length >= 2) {
    const span = starts.at(-1) - starts[0];
    schedules[id] = { trips: starts.length, firstDeparture: fmt(starts[0]), lastDeparture: fmt(starts.at(-1)), avgHeadwayMin: Math.max(1, Math.round(span / 60 / (starts.length - 1))) };
  }
}

const used = new Set(outRoutes.flatMap((r) => r.stops));
const outStops = [...stops.values()].filter((s) => used.has(s.id));
fs.writeFileSync(path.join(OUT, 'bmtc-stops.json'), JSON.stringify(outStops) + '\n');
fs.writeFileSync(path.join(OUT, 'bmtc-routes.json'), JSON.stringify(outRoutes) + '\n');

const schedPath = path.join(OUT, 'bmtc-schedules.json');
const sched = JSON.parse(fs.readFileSync(schedPath, 'utf8'));
sched.status = 'gtfs-average-headway';
sched.reason = `Average headways derived from GTFS (${source || 'source not given'}). Licence: ${licence}. Not live; individual departures may differ.`;
sched.routes = schedules;
fs.writeFileSync(schedPath, JSON.stringify(sched, null, 2) + '\n');

// Fares (GTFS fares v1): zone-pair prices, general and route-specific.
const fareFile = path.join(dir, 'fare_rules.txt');
if (fs.existsSync(fareFile) && fs.existsSync(path.join(dir, 'fare_attributes.txt'))) {
  const price = new Map();
  for await (const f of rows('fare_attributes.txt')) price.set(f.fare_id, Number(f.price));
  const general = {};
  const byRoute = {};
  for await (const r of rows('fare_rules.txt')) {
    const p = price.get(r.fare_id);
    if (!Number.isFinite(p) || !r.origin_id || !r.destination_id) continue;
    const key = `${r.origin_id}|${r.destination_id}`;
    if (r.route_id) (byRoute[r.route_id] ??= {})[key] = p;
    else general[key] = p;
  }
  fs.writeFileSync(path.join(OUT, 'bmtc-fares.json'), JSON.stringify({ source: source || dir, licence, general, byRoute }) + '\n');
  console.log(`Fares: ${Object.keys(general).length} general zone pairs, ${Object.keys(byRoute).length} routes with own fares.`);
}

const manifestPath = path.join(OUT, 'dataset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
Object.assign(manifest.datasets.bmtc, {
  source: `GTFS feed: ${source || dir}`,
  licence,
  importedOn: new Date().toISOString().slice(0, 10),
  osmSnapshot: null,
  coverage: `${outRoutes.length} route patterns from GTFS.`,
});
manifest.datasets.bmtcSchedules.status = 'gtfs-average-headway';
manifest.datasets.bmtcSchedules.note = 'Average headway per route from the imported GTFS timetable. Not live.';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`GTFS import: ${outRoutes.length} route patterns, ${outStops.length} stops, ${Object.keys(schedules).length} with headways.`);
console.log('Run `npm test` to validate the new data.');
