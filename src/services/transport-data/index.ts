import stations from '../../data/metro-stations.json';
import lines from '../../data/metro-lines.json';
import transfers from '../../data/metro-transfers.json';
import stops from '../../data/bmtc-stops.json';
import routes from '../../data/bmtc-routes.json';
import fares from '../../data/fare-tables.json';
import metroService from '../../data/metro-service.json';
import bmtcSchedules from '../../data/bmtc-schedules.json';
import bmtcFares from '../../data/bmtc-fares.json';
import manifest from '../../data/dataset-manifest.json';
import operators from '../../data/operators.json';
import type { BusStop, MetroStation, TransportData } from '../../types/transport';
import { SpatialGrid } from '../../utils/geo';
import { validateTransportData, type ValidationIssue } from './validate';

export const transportData: TransportData = {
  stations: stations as TransportData['stations'],
  lines: lines as TransportData['lines'],
  transfers,
  stops,
  routes,
  fares: fares as unknown as TransportData['fares'],
  metroService: metroService as TransportData['metroService'],
  busPlanning: bmtcSchedules.planning,
  busSchedules: bmtcSchedules.routes as TransportData['busSchedules'],
  busFares: bmtcFares as TransportData['busFares'],
};

export { manifest as datasetManifest, operators };

let cachedIssues: ValidationIssue[] | null = null;
export function dataIssues(): ValidationIssue[] {
  cachedIssues ??= validateTransportData(transportData);
  return cachedIssues;
}

export const stationById = new Map<string, MetroStation>(transportData.stations.map((s) => [s.id, s]));
export const stopById = new Map<string, BusStop>(transportData.stops.map((s) => [s.id, s]));
export const lineById = new Map(transportData.lines.map((l) => [l.id, l]));

let stationGrid: SpatialGrid<MetroStation> | null = null;
let stopGrid: SpatialGrid<BusStop> | null = null;

export function nearbyStations(lat: number, lon: number, radiusM: number) {
  stationGrid ??= new SpatialGrid(transportData.stations);
  return stationGrid.within(lat, lon, radiusM);
}

export function nearbyStops(lat: number, lon: number, radiusM: number) {
  stopGrid ??= new SpatialGrid(transportData.stops);
  return stopGrid.within(lat, lon, radiusM);
}

/** Bus routes serving each stop (built lazily). */
let routesByStop: Map<string, string[]> | null = null;
export function routesAtStop(stopId: string): string[] {
  if (!routesByStop) {
    routesByStop = new Map();
    for (const r of transportData.routes)
      for (const s of new Set(r.stops)) {
        const list = routesByStop.get(s) ?? [];
        list.push(r.ref ?? r.name);
        routesByStop.set(s, list);
      }
  }
  return [...new Set(routesByStop.get(stopId) ?? [])].sort();
}

/** Display name of a metro station without the line prefix, de-duplicated for interchanges. */
export function uniqueStationNames(): { name: string; stations: MetroStation[] }[] {
  const byName = new Map<string, MetroStation[]>();
  for (const s of transportData.stations) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
  return [...byName.entries()].map(([name, list]) => ({ name, stations: list }));
}
