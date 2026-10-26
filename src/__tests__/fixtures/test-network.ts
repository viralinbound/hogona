/**
 * ⚠️ TEST DATA — FICTIONAL. These stations, stops and routes do not exist.
 * They sit inside the Bengaluru bounding box only so the router's service-area
 * check passes. Never import this file from app code.
 *
 *   Line A (west → east):  A1 ── A2 ── A3(X) ── A4
 *   Line B (south → north):       B1 ── B2(X) ── B3
 *   A3 and B2 are an interchange 50 m apart.
 *   Bus T1: S1 → S2 → S3 → S4 → S5 (one-way), running north of line A.
 */
import fares from '../../data/fare-tables.json';
import type { TransportData } from '../../types/transport';

const LAT = 12.95;
const LON = 77.55;
const dLon = 0.01; // ≈ 1.08 km
const dLat = 0.01; // ≈ 1.11 km

const st = (id: string, line: string, lat: number, lon: number, chainageM: number) => ({
  id,
  name: `Test ${id}`,
  nameKn: null,
  lat,
  lon,
  line,
  osmId: 'test',
  chainageM,
  trackOffsetM: 0,
});

export function makeTestData(overrides: Partial<TransportData> = {}): TransportData {
  const stations = [
    st('A1', 'a', LAT, LON, 0),
    st('A2', 'a', LAT, LON + dLon, 1080),
    st('A3', 'a', LAT, LON + 2 * dLon, 2160),
    st('A4', 'a', LAT, LON + 3 * dLon, 3240),
    st('B1', 'b', LAT - 2 * dLat, LON + 2 * dLon + 0.0004, 0),
    st('B2', 'b', LAT - 0.0004, LON + 2 * dLon + 0.0004, 2180),
    st('B3', 'b', LAT + 2 * dLat, LON + 2 * dLon + 0.0004, 4400),
  ];
  const seg = (a: (typeof stations)[number], b: (typeof stations)[number]): [number, number][] => [
    [a.lat, a.lon],
    [b.lat, b.lon],
  ];
  const s = Object.fromEntries(stations.map((x) => [x.id, x]));
  const stops = [1, 2, 3, 4, 5].map((i) => ({
    id: `S${i}`,
    name: `Test stop ${i}`,
    nameKn: null,
    lat: LAT + 0.03,
    lon: LON + (i - 1) * 0.012,
    osmId: 'test',
  }));

  return {
    stations,
    lines: [
      { id: 'a', name: 'Test Line A', colour: '#f00', osmRelation: 0, stations: ['A1', 'A2', 'A3', 'A4'], trackLengthM: 3240, segments: [seg(s.A1, s.A2), seg(s.A2, s.A3), seg(s.A3, s.A4)] },
      { id: 'b', name: 'Test Line B', colour: '#00f', osmRelation: 0, stations: ['B1', 'B2', 'B3'], trackLengthM: 4400, segments: [seg(s.B1, s.B2), seg(s.B2, s.B3)] },
    ],
    transfers: [{ from: 'A3', to: 'B2', walkM: 50, name: 'Test interchange' }],
    stops,
    routes: [{ id: 'T1', ref: 'T1', name: 'Test bus T1', from: null, to: null, operator: 'BMTC', ac: false, osmRelation: 0, stops: stops.map((x) => x.id) }],
    fares: fares as unknown as TransportData['fares'],
    metroService: {
      officialTimingsUrl: 'test',
      officialMapUrl: 'test',
      lines: {
        a: { hours: null, headwayMin: null, status: 'unverified', note: 'test' },
        b: {
          hours: { weekdayFirst: '06:00', sundayFirst: '07:00', lastFromFirstStation: '22:00', lastFromLastStation: '22:00' },
          headwayMin: { peak: 6, offPeak: 10 },
          status: 'reported',
          note: 'test',
        },
      },
      planning: { metroSpeedKmh: 34, metroDwellSec: 30, assumedWaitMinUnknownHeadway: 5, interchangeWalkMin: 4, explanation: 'test' },
    },
    busPlanning: { busSpeedKmh: 14, assumedWaitMin: 10, explanation: 'test' },
    ...overrides,
  };
}

export const TEST_COORDS = { LAT, LON, dLat, dLon };
