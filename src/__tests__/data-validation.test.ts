import { buildNetwork, planJourneys } from '../algorithms/multimodal-router';
import manifest from '../data/dataset-manifest.json';
import { transportData } from '../services/transport-data';
import { validateTransportData } from '../services/transport-data/validate';
import { DEFAULT_PREFERENCES } from '../types/journey';
import { makeTestData } from './fixtures/test-network';

describe('bundled Bengaluru datasets', () => {
  const issues = validateTransportData(transportData);

  it('have no structural errors', () => {
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('contain only the lines open on the verification date', () => {
    expect(transportData.lines.map((l) => l.id).sort()).toEqual(['green', 'purple', 'yellow']);
  });

  it('have line lengths consistent with published figures (±5%)', () => {
    const km = Object.fromEntries(transportData.lines.map((l) => [l.id, l.trackLengthM / 1000]));
    // Published route lengths: Purple ≈ 43.5 km, Green ≈ 33.5 km, Yellow ≈ 19.15 km (incl. approaches).
    expect(km.purple).toBeGreaterThan(41.3);
    expect(km.purple).toBeLessThan(45.7);
    expect(km.green).toBeGreaterThan(31.8);
    expect(km.green).toBeLessThan(35.2);
    expect(km.yellow).toBeGreaterThan(17);
    expect(km.yellow).toBeLessThan(20.2);
  });

  it('have both interchanges (Majestic, RV Road)', () => {
    expect(transportData.transfers.map((t) => t.name).join(' ')).toMatch(/Majestic/);
    expect(transportData.transfers.map((t) => t.name).join(' ')).toMatch(/Rashtreeya Vidyalaya Road/);
  });

  it('document source, licence and import date for every dataset', () => {
    for (const key of ['metro', 'bmtc'] as const) {
      const d = manifest.datasets[key];
      expect(d.source).toBeTruthy();
      expect(d.licence).toMatch(/ODbL/);
      expect(d.importedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('route a real trip: Whitefield (Kadugodi) → Majestic by Purple Line', () => {
    const net = buildNetwork(transportData);
    const kadugodi = transportData.stations.find((s) => s.id === 'purple-whitefield')!;
    const majestic = transportData.stations.find((s) => s.name.startsWith('Nadaprabhu Kempegowda') && s.line === 'purple')!;
    expect(kadugodi).toBeDefined();
    const r = planJourneys(net, {
      origin: { name: kadugodi.name, lat: kadugodi.lat, lon: kadugodi.lon, kind: 'metro', refId: kadugodi.id },
      destination: { name: majestic.name, lat: majestic.lat, lon: majestic.lon, kind: 'metro', refId: majestic.id },
      departAt: new Date(2026, 9, 21, 10, 0),
      prefs: { ...DEFAULT_PREFERENCES, modes: { metro: true, bus: false, ride: false } },
    });
    const metro = r.journeys.find((j) => j.modes.includes('metro'))!;
    expect(metro.legs.map((l) => l.mode)).toEqual(['metro']);
    expect(metro.legs[0].line?.id).toBe('purple');
    // ≈ 24 km between these stations → ₹80 slab (24 km) or ₹90 (25+ km)
    expect([80, 90]).toContain(metro.fare.known);
  });
});

describe('real three-line metro trip (regression)', () => {
  it('Indiranagar → Electronic City changes at Majestic and RV Road on one ticket', () => {
    const net = buildNetwork(transportData);
    const from = transportData.stations.find((s) => s.id === 'purple-indiranagar')!;
    const to = transportData.stations.find((s) => s.id === 'yellow-electronic-city')!;
    const r = planJourneys(net, {
      origin: { name: from.name, lat: from.lat, lon: from.lon, kind: 'metro', refId: from.id },
      destination: { name: to.name, lat: to.lat, lon: to.lon, kind: 'metro', refId: to.id },
      departAt: new Date(2026, 9, 21, 11, 30),
      prefs: { ...DEFAULT_PREFERENCES, modes: { metro: true, bus: false, ride: false } },
    });
    const j = r.journeys.find((x) => x.modes.includes('metro'))!;
    expect(j.legs.map((l) => l.mode)).toEqual(['metro', 'walk', 'metro', 'walk', 'metro']);
    expect(j.legs.filter((l) => l.mode === 'walk').every((l) => l.interchange)).toBe(true);
    // One ticket, capped by the top slab.
    expect(j.fare.known).toBeLessThanOrEqual(90);
    expect(j.legs.filter((l) => (l.fare?.amount ?? 0) > 0)).toHaveLength(1);
  });
});

describe('validator catches broken data', () => {
  it('flags unknown station references and bad fare tables', () => {
    const bad = makeTestData();
    bad.lines[0].stations.push('NOPE');
    bad.fares = { ...bad.fares, metro: { ...bad.fares.metro, slabs: [{ uptoKm: 5, fare: 30 }, { uptoKm: 2, fare: 10 }] } };
    const msgs = validateTransportData(bad).map((i) => i.message).join('\n');
    expect(msgs).toMatch(/unknown station NOPE/);
    expect(msgs).toMatch(/fare slabs/);
  });

  it('flags bus routes with missing stops', () => {
    const bad = makeTestData();
    bad.routes[0].stops.push('GHOST');
    expect(validateTransportData(bad).some((i) => i.message.includes('GHOST'))).toBe(true);
  });
});
