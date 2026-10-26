/**
 * Indian Railways stations in Karnataka from OpenStreetMap (ODbL), with the
 * station code from the `railway:ref` / `ref` tag. Only stations with a code
 * are kept, since the code is what IRCTC and NTES search by.
 *
 *   node scripts/import-rail.mjs [--cache]
 *
 * No timetable is imported: Indian Railways publishes no open timetable feed,
 * so the app hands train search and booking to IRCTC / NTES.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts', '.cache', 'rail.json');
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const UA = 'Hogona-dataimport/1.0 (+https://github.com/; contact via project README)';
const useCache = process.argv.includes('--cache');

const query = `[out:json][timeout:170];
area["ISO3166-2"="IN-KA"][admin_level=4]->.ka;
(nwr["railway"~"^(station|halt)$"](area.ka);nwr["public_transport"="station"]["train"="yes"](area.ka););
out center tags;`;

let json;
if (useCache && fs.existsSync(CACHE)) json = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
else {
  console.log('Fetching railway stations from Overpass...');
  const res = await fetch(OVERPASS, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
  if (!res.ok) throw new Error(`Overpass: HTTP ${res.status}`);
  json = await res.json();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(json));
}

const seen = new Set();
const stations = [];
for (const el of json.elements) {
  const t = el.tags ?? {};
  // Metro stations are tagged station + station=subway/light_rail; keep mainline only.
  if (t.station === 'subway' || t.station === 'light_rail' || t.subway === 'yes' || t.monorail === 'yes') continue;
  if (/metro/i.test(t.network ?? '') || /metro/i.test(t.operator ?? '')) continue;
  const code = (t['railway:ref'] ?? t.ref ?? t['ref:IR'] ?? '').trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(code) || seen.has(code)) continue;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || !t.name) continue;
  seen.add(code);
  stations.push({ code, name: t['name:en'] ?? t.name, lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, osmId: `${el.type}/${el.id}` });
}
// Major stations OSM maps only as platform stop positions, without a station code.
// Position = an OSM platform node; code = a cited public source. Re-check on each import.
const SUPPLEMENT = [
  { code: 'MYS', name: 'Mysuru Junction', lat: 12.316829, lon: 76.645529, osmId: 'node/312565912', codeSource: 'https://en.wikipedia.org/wiki/Mysore_Junction_railway_station' },
];
for (const s of SUPPLEMENT) if (!seen.has(s.code)) stations.push(s);
stations.sort((a, b) => a.code.localeCompare(b.code));
const out = { source: 'OpenStreetMap contributors (ODbL), railway=station/halt or train stations in Karnataka with a station code', snapshot: new Date().toISOString().slice(0, 10), stations };
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'rail-stations.json'), JSON.stringify(out, null, 1));
console.log(`${stations.length} stations with codes`);
for (const c of ['SBC', 'YPR', 'SMVB', 'KJM', 'BNC', 'MYS', 'UBL', 'MAQ', 'BAY', 'DVG']) console.log(c, stations.find((s) => s.code === c)?.name ?? 'MISSING');
