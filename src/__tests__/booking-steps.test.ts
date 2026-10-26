import { buildNetwork, planJourneys } from '../algorithms/multimodal-router';
import { bookingSteps } from '../features/handoff/booking-steps';
import { transportData } from '../services/transport-data';
import { DEFAULT_PREFERENCES, type Journey, type Leg } from '../types/journey';

const leg = (mode: Leg['mode'], from: string, to: string, extra: Partial<Leg> = {}): Leg => ({
  mode,
  from: { name: from, lat: 12.97, lon: 77.6, kind: 'address' },
  to: { name: to, lat: 12.97, lon: 77.6, kind: 'address' },
  distanceM: 1000,
  durationSec: 300,
  durationBasis: 'estimated',
  waitSec: 0,
  waitBasis: 'estimated',
  geometry: [],
  geometryKind: 'approximate',
  notes: [],
  ...extra,
});

const journeyOf = (legs: Leg[]): Journey => ({
  id: 'x',
  title: 'x',
  legs,
  departAt: 0,
  arriveAt: 0,
  durationSec: 0,
  walkM: 0,
  walkSec: 0,
  waitSec: 0,
  transfers: 0,
  fare: { known: 0, complete: true, unknownParts: [] },
  modes: [...new Set(legs.map((l) => l.mode))],
  warnings: [],
  tags: [],
});

describe('bookingSteps', () => {
  it('lists bus, one metro ticket across an interchange, then a ride — in order', () => {
    const steps = bookingSteps(
      journeyOf([
        leg('walk', 'Home', 'Stop A'),
        leg('bus', 'Stop A', 'Stop B', { route: { id: 'r', ref: '500D', name: 'r', ac: false } }),
        leg('walk', 'Stop B', 'Metro 1'),
        leg('metro', 'Metro 1', 'Interchange', { line: { id: 'purple', name: 'Purple Line', colour: '#000' } }),
        leg('walk', 'Interchange', 'Interchange', { interchange: true }),
        leg('metro', 'Interchange', 'Metro 3', { line: { id: 'green', name: 'Green Line', colour: '#000' } }),
        leg('ride', 'Metro 3', 'Office'),
      ]),
    );
    expect(steps.map((s) => s.kind)).toEqual(['bus', 'metro', 'ride']);
    expect(steps[1].from.name).toBe('Metro 1');
    expect(steps[1].to.name).toBe('Metro 3');
    expect(steps[1].detail).toMatch(/Purple → Green/);
    expect(steps[0].title).toContain('500D');
  });

  it('needs nothing for a walking-only trip', () => {
    expect(bookingSteps(journeyOf([leg('walk', 'A', 'B')]))).toEqual([]);
  });

  it('works on a real planned journey', () => {
    const net = buildNetwork(transportData);
    const from = transportData.stations.find((s) => s.id === 'purple-indiranagar')!;
    const to = transportData.stations.find((s) => s.id === 'yellow-electronic-city')!;
    const r = planJourneys(net, {
      origin: { name: from.name, lat: from.lat, lon: from.lon, kind: 'metro', refId: from.id },
      destination: { name: to.name, lat: to.lat, lon: to.lon, kind: 'metro', refId: to.id },
      departAt: new Date(2026, 9, 21, 11, 30),
      prefs: { ...DEFAULT_PREFERENCES, modes: { metro: true, bus: false, ride: false } },
    });
    const steps = bookingSteps(r.journeys.find((j) => j.modes.includes('metro'))!);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('metro');
  });
});
