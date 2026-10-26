import railData from '../data/rail-stations.json';
import type { Place } from '../types/journey';
import { haversineM } from '../utils/geo';

export interface RailStation {
  code: string;
  name: string;
  lat: number;
  lon: number;
  osmId: string;
}

export const railStations: RailStation[] = railData.stations;
export const railSnapshot = railData.snapshot;

/**
 * Bengaluru's main long-distance stations, most central first. Which one a
 * train uses isn't in any open data, so the app names them and lets IRCTC say.
 */
export const BENGALURU_RAIL_CODES = ['SBC', 'YPR', 'SMVB', 'KJM', 'BNC'] as const;

const byCode = new Map(railStations.map((s) => [s.code, s]));
export const railStation = (code: string) => byCode.get(code);

/** A station is only useful within a short ride of the place. */
const MAX_STATION_M = 25_000;

/** Main stations by name; long-distance trains usually stop at these rather than at nearby halts. */
const MAJOR = /\b(junction|jn|central|city|terminal|cantonment)\b/i;
/** How much farther a major station may be than the nearest one and still be preferred. */
const MAJOR_EXTRA_M = 8_000;

/**
 * The station to use for a place: the nearest one, unless a main station (by name,
 * or named like the place itself, e.g. "Hubballi") is at most 8 km farther.
 */
export function nearestRailStation(lat: number, lon: number, maxM = MAX_STATION_M, placeName?: string): { station: RailStation; distanceM: number } | null {
  const within = railStations
    .map((station) => ({ station, distanceM: haversineM(lat, lon, station.lat, station.lon) }))
    .filter((c) => c.distanceM <= maxM)
    .sort((a, b) => a.distanceM - b.distanceM);
  if (!within.length) return null;
  const town = placeName?.split(/[\s,]/)[0]?.toLowerCase();
  const isMain = (st: RailStation) => MAJOR.test(st.name) || (!!town && town.length > 3 && st.name.toLowerCase().startsWith(town));
  const major = within.find((c) => isMain(c.station) && c.distanceM <= within[0].distanceM + MAJOR_EXTRA_M);
  return major ?? within[0];
}

/**
 * ixigo's public train-search page with stations and date filled in (an IRCTC
 * partner; trains, times, seats and booking are on that page). Undocumented URL
 * pattern, checked 2026-10-24: /search/result/train/{FROM}/{TO}/{DDMMYYYY}//1/0/0/0/ALL.
 */
export function trainSearchUrl(from: RailStation, to: RailStation, date: Date): string {
  const d = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`;
  return `https://www.ixigo.com/search/result/train/${from.code}/${to.code}/${d}//1/0/0/0/ALL`;
}

export const railPlace = (s: RailStation): Place => ({ name: `${s.name} (${s.code})`, lat: s.lat, lon: s.lon, kind: 'map', refId: `rail:${s.code}`, subtitle: 'Railway station' });

export interface RailOption {
  from: RailStation;
  to: RailStation;
  /** Other Bengaluru stations trains on this corridor may use. */
  bengaluruAlternatives: RailStation[];
  /** Straight-line distance from the far station to the place itself. */
  lastMileM: number;
}

/**
 * Train suggestion for an intercity trip: Bengaluru's central station to the
 * station nearest the other town (or nearest-to-nearest when neither end is in
 * Bengaluru). Trains and times are not known here — IRCTC and NTES have them.
 */
export function railOption(origin: Place, destination: Place, bengaluruEnd: 'origin' | 'destination' | null): RailOption | null {
  const blr = BENGALURU_RAIL_CODES.map(railStation).filter((s): s is RailStation => !!s);
  const near = (p: Place) => nearestRailStation(p.lat, p.lon, undefined, p.name);
  const far = bengaluruEnd === 'origin' ? near(destination) : bengaluruEnd === 'destination' ? near(origin) : null;

  if (bengaluruEnd) {
    if (!far || !blr.length) return null;
    // A "far" station that is itself in Bengaluru means this isn't a train trip.
    if (blr.some((s) => s.code === far.station.code)) return null;
    const central = blr[0];
    const [from, to] = bengaluruEnd === 'origin' ? [central, far.station] : [far.station, central];
    return { from, to, bengaluruAlternatives: blr.slice(1), lastMileM: far.distanceM };
  }
  const a = near(origin);
  const b = near(destination);
  if (!a || !b || a.station.code === b.station.code) return null;
  return { from: a.station, to: b.station, bengaluruAlternatives: [], lastMileM: b.distanceM };
}
