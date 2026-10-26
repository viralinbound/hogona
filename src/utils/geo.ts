import type { LatLon } from '../types/transport';

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function polylineLengthM(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  return total;
}

/** Bengaluru service area used for validation and geocoder bias. */
export const BENGALURU_BOUNDS = { minLat: 12.75, maxLat: 13.25, minLon: 77.35, maxLon: 77.85 };
export const BENGALURU_CENTER = { lat: 12.9716, lon: 77.5946 };

/** Karnataka bounding box, for place search and intercity trips. */
export const KARNATAKA_BOUNDS = { minLat: 11.5, maxLat: 18.5, minLon: 74.0, maxLon: 78.6 };

export function inKarnataka(lat: number, lon: number): boolean {
  const b = KARNATAKA_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

export function inBengaluru(lat: number, lon: number): boolean {
  const b = BENGALURU_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

/**
 * Street walking distances are longer than straight lines. 1.3 is a common
 * planning detour factor for city grids; it is an estimate, not a routed path.
 */
export const WALK_DETOUR_FACTOR = 1.3;
export const WALK_SPEED_MPS = 4.8 / 3.6;
export const ROAD_DETOUR_FACTOR = 1.35;

export function walkEstimate(straightM: number): { distanceM: number; durationSec: number } {
  const distanceM = straightM * WALK_DETOUR_FACTOR;
  return { distanceM, durationSec: distanceM / WALK_SPEED_MPS };
}

/** Simple uniform grid for "everything within N metres" lookups. */
export class SpatialGrid<T extends { lat: number; lon: number }> {
  private cells = new Map<string, T[]>();
  // ~0.005 deg ≈ 550 m cells at Bengaluru's latitude.
  constructor(items: T[], private cellDeg = 0.005) {
    for (const it of items) {
      const k = this.key(it.lat, it.lon);
      const list = this.cells.get(k);
      if (list) list.push(it);
      else this.cells.set(k, [it]);
    }
  }

  private key(lat: number, lon: number) {
    return `${Math.floor(lat / this.cellDeg)}:${Math.floor(lon / this.cellDeg)}`;
  }

  within(lat: number, lon: number, radiusM: number): { item: T; distanceM: number }[] {
    const span = Math.ceil(radiusM / (this.cellDeg * 105000)) + 1;
    const ci = Math.floor(lat / this.cellDeg);
    const cj = Math.floor(lon / this.cellDeg);
    const out: { item: T; distanceM: number }[] = [];
    for (let di = -span; di <= span; di++)
      for (let dj = -span; dj <= span; dj++)
        for (const item of this.cells.get(`${ci + di}:${cj + dj}`) ?? []) {
          const d = haversineM(lat, lon, item.lat, item.lon);
          if (d <= radiusM) out.push({ item, distanceM: d });
        }
    return out.sort((a, b) => a.distanceM - b.distanceM);
  }
}
