import type { LatLon } from '../../types/transport';
import { appConfig } from '../config';

export interface RoutedPath {
  geometry: LatLon[];
  distanceM: number;
  durationSec: number;
}

/**
 * Fetches a real street path from an OSRM-compatible server. Used only on the
 * journey details screen, on demand, so the public demo servers are not
 * hammered. Returns null when disabled, offline or no route exists — the UI
 * then shows a dashed "approximate" line and offers external map directions.
 */
export async function routePath(kind: 'walk' | 'drive', from: LatLon, to: LatLon, signal?: AbortSignal): Promise<RoutedPath | null> {
  const base = kind === 'walk' ? appConfig.walkRoutingUrl : appConfig.driveRoutingUrl;
  if (!base) return null;
  const url = `${base.replace(/\/$/, '')}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (json.code !== 'Ok' || !r) return null;
    return { geometry: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]), distanceM: r.distance, durationSec: r.duration };
  } catch {
    return null;
  }
}

/** Google Maps directions URL (opens the app if installed, else the browser). */
export function externalDirectionsUrl(from: LatLon, to: LatLon, mode: 'walking' | 'driving' | 'transit'): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&travelmode=${mode}`;
}
