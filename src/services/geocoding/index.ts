import type { Place } from '../../types/journey';
import { transportData, uniqueStationNames } from '../transport-data';
import { BENGALURU_CENTER, inKarnataka, KARNATAKA_BOUNDS } from '../../utils/geo';
import { appConfig } from '../config';

export interface SearchOutcome {
  places: Place[];
  /** Set when the online geocoder failed or is disabled. */
  onlineError?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Offline search over bundled metro stations and bus stops. */
export function searchLocal(query: string, limit = 8): Place[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const score = (name: string) => {
    const n = norm(name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(' ').some((w) => w.startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return -1;
  };
  const lineName = new Map(transportData.lines.map((l) => [l.id, l.name]));
  const metro = uniqueStationNames()
    .map(({ name, stations }) => ({ s: score(name), name, st: stations[0], lines: stations.map((x) => lineName.get(x.line)) }))
    .filter((x) => x.s >= 0)
    .map<[number, Place]>((x) => [
      x.s,
      { name: x.name, lat: x.st.lat, lon: x.st.lon, kind: 'metro', refId: x.st.id, subtitle: `Metro · ${x.lines.join(' / ')}` },
    ]);
  const seenStop = new Set<string>();
  const bus = transportData.stops
    .map((s) => ({ s: score(s.name), stop: s }))
    .filter((x) => x.s >= 0 && !seenStop.has(norm(x.stop.name)) && seenStop.add(norm(x.stop.name)))
    .map<[number, Place]>((x) => [x.s + 0.5, { name: x.stop.name, lat: x.stop.lat, lon: x.stop.lon, kind: 'bus', refId: x.stop.id, subtitle: 'BMTC bus stop' }]);
  return [...metro, ...bus]
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, p]) => p);
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; locality?: string; district?: string; city?: string; postcode?: string; type?: string };
}

function photonToPlace(f: PhotonFeature): Place | null {
  const [lon, lat] = f.geometry.coordinates;
  if (!inKarnataka(lat, lon)) return null;
  const p = f.properties;
  const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.locality || p.district;
  if (!name) return null;
  const subtitle = [p.street !== name ? p.street : null, p.locality, p.district, p.city !== p.district ? p.city : null, p.postcode].filter(Boolean).join(', ');
  return { name, lat, lon, kind: 'address', subtitle: subtitle || 'Karnataka' };
}

/**
 * Address/landmark search via a Photon-compatible geocoder (default:
 * photon.komoot.io, OpenStreetMap data). Results are restricted to Bengaluru.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
  const local = searchLocal(query, 5);
  const base = appConfig.geocoderUrl;
  if (!base) return { places: local, onlineError: 'Online address search is turned off — showing stations and stops only.' };
  if (query.trim().length < 3) return { places: local };
  // Whole Karnataka, ranked nearest Bengaluru first.
  const b = KARNATAKA_BOUNDS;
  const url =
    `${base.replace(/\/$/, '')}/api/?q=${encodeURIComponent(query)}&limit=8&lang=en` +
    `&lat=${BENGALURU_CENTER.lat}&lon=${BENGALURU_CENTER.lon}&bbox=${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { features: PhotonFeature[] };
    const online = json.features.map(photonToPlace).filter((p): p is Place => p !== null);
    return { places: [...local.slice(0, 3), ...online].slice(0, 10) };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { places: local, onlineError: 'Address search is unavailable (offline or service error) — showing stations and stops only.' };
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const base = appConfig.geocoderUrl;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/reverse?lat=${lat}&lon=${lon}&lang=en`);
    if (!res.ok) return null;
    const json = (await res.json()) as { features: PhotonFeature[] };
    const f = json.features[0];
    return f ? (photonToPlace(f)?.name ?? null) : null;
  } catch {
    return null;
  }
}
