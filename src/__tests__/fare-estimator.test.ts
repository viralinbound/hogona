import { applyFares, busFare, metroFare, slabFare } from '../algorithms/fare-estimator';
import fares from '../data/fare-tables.json';
import type { Leg } from '../types/journey';
import type { FareTables } from '../types/transport';

const tables = fares as unknown as FareTables;

describe('metro slab fares (BMRCL table from 2025-02-09)', () => {
  it.each([
    [0.5, 10],
    [2, 10],
    [2.01, 20],
    [5.9, 30],
    [10, 50],
    [12, 60],
    [15, 60],
    [15.1, 70],
    [24, 80],
    [29, 90],
    [43, 90],
  ])('%s km → ₹%s', (km, fare) => {
    expect(metroFare(km * 1000, tables).amount).toBe(fare);
  });

  it('labels the fare as a slab estimate', () => {
    expect(metroFare(3000, tables).basis).toBe('slab-estimate');
  });

  it('returns null when no slab matches', () => {
    expect(slabFare(5, [{ uptoKm: 2, fare: 10 }])).toBeNull();
  });
});

describe('BMTC fares', () => {
  it('uses the verified ordinary stages', () => {
    expect(busFare(1500, tables, { ac: false, shakti: false }).amount).toBe(6);
    expect(busFare(3900, tables, { ac: false, shakti: false }).amount).toBe(12);
    expect(busFare(6000, tables, { ac: false, shakti: false }).amount).toBe(18);
  });

  it('does not invent fares beyond the verified stages', () => {
    const f = busFare(6100, tables, { ac: false, shakti: false });
    expect(f.amount).toBeNull();
    expect(f.basis).toBe('unknown');
  });

  it('has no AC fare table', () => {
    expect(busFare(2000, tables, { ac: true, shakti: false }).amount).toBeNull();
  });

  it('Shakti makes non-AC travel free but not AC', () => {
    expect(busFare(20000, tables, { ac: false, shakti: true }).amount).toBe(0);
    expect(busFare(2000, tables, { ac: true, shakti: true }).amount).toBeNull();
  });
});

const leg = (mode: Leg['mode'], distanceM: number, extra: Partial<Leg> = {}): Leg => ({
  mode,
  from: { name: 'a', lat: 0, lon: 0, kind: 'address' },
  to: { name: 'b', lat: 0, lon: 0, kind: 'address' },
  distanceM,
  durationSec: 60,
  durationBasis: 'estimated',
  waitSec: 0,
  waitBasis: 'estimated',
  geometry: [],
  geometryKind: 'approximate',
  notes: [],
  ...extra,
});

describe('journey fare totals', () => {
  it('joins metro legs across an interchange into one ticket', () => {
    const legs = [leg('walk', 100), leg('metro', 1500), leg('walk', 50, { interchange: true }), leg('metro', 1500), leg('walk', 100)];
    const f = applyFares(legs, tables, false);
    expect(f).toEqual({ known: 20, complete: true, unknownParts: [] });
    expect(legs[1].fare?.amount).toBe(20);
    expect(legs[3].fare?.amount).toBe(0);
  });

  it('charges separately when you exit and re-enter the metro', () => {
    const legs = [leg('metro', 1500), leg('walk', 400), leg('metro', 1500)];
    expect(applyFares(legs, tables, false).known).toBe(20);
  });

  it('adds bus tickets per leg and flags ride fares as unknown', () => {
    const legs = [leg('bus', 1800, { route: { id: 'x', ref: '1', name: 'x', ac: false } }), leg('ride', 3000)];
    const f = applyFares(legs, tables, false);
    expect(f.known).toBe(6);
    expect(f.complete).toBe(false);
    expect(f.unknownParts).toEqual(['ride']);
    expect(legs[1].fare?.basis).toBe('in-app');
  });
});
