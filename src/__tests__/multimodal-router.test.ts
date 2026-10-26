import { buildNetwork, planJourneys } from '../algorithms/multimodal-router';
import { DEFAULT_PREFERENCES, type Place, type PlannerPreferences } from '../types/journey';
import { makeTestData, TEST_COORDS } from './fixtures/test-network';

const { LAT, LON, dLat, dLon } = TEST_COORDS;
const net = buildNetwork(makeTestData());
// A weekday at 10:00 IST.
const MORNING = new Date(2026, 9, 21, 10, 0);
const place = (name: string, lat: number, lon: number): Place => ({ name, lat, lon, kind: 'address' });
const prefs = (p: Partial<PlannerPreferences> = {}): PlannerPreferences => ({ ...DEFAULT_PREFERENCES, ...p, modes: { ...DEFAULT_PREFERENCES.modes, ...p.modes } });
const plan = (o: Place, d: Place, p: Partial<PlannerPreferences> = {}, at = MORNING) => planJourneys(net, { origin: o, destination: d, departAt: at, prefs: prefs(p) });

// Near A1 and near A4 (≈ 3.2 km apart along line A).
const nearA1 = place('near A1', LAT - 0.002, LON);
const nearA4 = place('near A4', LAT - 0.002, LON + 3 * dLon);
const nearB1 = place('near B1', LAT - 2 * dLat, LON + 2 * dLon + 0.002);

describe('graph construction', () => {
  it('creates station, vehicle, stop and bus-position nodes', () => {
    // 7 stations ×2 + 5 stops + 5 bus positions
    expect(net.graph.nodes.length).toBe(7 * 2 + 5 + 5);
  });
});

describe('metro-only routing', () => {
  it('finds a direct metro journey with walking at both ends', () => {
    const r = plan(nearA1, nearA4, { modes: { metro: true, bus: false, ride: false } });
    const metro = r.journeys.find((j) => j.modes.includes('metro'))!;
    expect(metro).toBeDefined();
    const legs = metro.legs.map((l) => l.mode);
    expect(legs).toEqual(['walk', 'metro', 'walk']);
    const m = metro.legs[1];
    expect(m.from.refId).toBe('A1');
    expect(m.to.refId).toBe('A4');
    expect(m.stops!.map((s) => s.refId)).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(m.distanceM).toBe(3240);
    expect(metro.transfers).toBe(0);
  });

  it('prices one metro ticket from the slab table (3.24 km → ₹20)', () => {
    const r = plan(nearA1, nearA4, { modes: { metro: true, bus: false, ride: false } });
    const metro = r.journeys.find((j) => j.modes.includes('metro'))!;
    expect(metro.fare).toEqual({ known: 20, complete: true, unknownParts: [] });
  });

  it('changes lines at the interchange and keeps a single ticket', () => {
    const r = plan(nearA1, nearB1, { modes: { metro: true, bus: false, ride: false } });
    const j = r.journeys.find((x) => x.modes.includes('metro'))!;
    const modes = j.legs.map((l) => l.mode);
    expect(modes).toEqual(['walk', 'metro', 'walk', 'metro', 'walk']);
    expect(j.legs[2].interchange).toBe(true);
    expect(j.transfers).toBe(1);
    // 2160 m on A + 2180 m on B = 4.34 km → ₹30 for one ticket
    expect(j.legs[1].fare?.amount).toBe(30);
    expect(j.legs[3].fare?.amount).toBe(0);
    expect(j.fare.known).toBe(30);
  });

  it('respects a zero-transfer limit', () => {
    const r = plan(nearA1, nearB1, { maxTransfers: 0, modes: { metro: true, bus: false, ride: false } });
    expect(r.journeys.some((j) => j.modes.includes('metro') && j.transfers > 0)).toBe(false);
  });
});

describe('time-dependent service', () => {
  it('avoids a line with published hours when it is closed', () => {
    const night = new Date(2026, 9, 21, 23, 30);
    const r = plan(nearA1, nearB1, { modes: { metro: true, bus: false, ride: false } }, night);
    expect(r.journeys.some((j) => j.legs.some((l) => l.line?.id === 'b'))).toBe(false);
    expect(r.notices.join(' ')).toMatch(/Test Line B/);
  });

  it('warns (not blocks) late at night on a line with unverified hours', () => {
    const night = new Date(2026, 9, 21, 23, 30);
    const r = plan(nearA1, nearA4, { modes: { metro: true, bus: false, ride: false } }, night);
    const j = r.journeys.find((x) => x.modes.includes('metro'))!;
    expect(j.warnings.join(' ')).toMatch(/not verified/);
  });

  it('uses half the published headway as the wait, labelled as an estimate', () => {
    const r = plan(nearB1, place('near B3', LAT + 2 * dLat, LON + 2 * dLon + 0.002), { modes: { metro: true, bus: false, ride: false } });
    const leg = r.journeys.find((x) => x.modes.includes('metro'))!.legs.find((l) => l.mode === 'metro')!;
    // 10:00 on a weekday is inside BMRCL's 08–12 peak window → 6 min / 2.
    expect(leg.waitSec).toBe(3 * 60);
    expect(leg.waitBasis).toBe('estimated');
  });
});

describe('bus and mixed-mode routing', () => {
  const nearS1 = place('near S1', LAT + 0.031, LON);
  const nearS5 = place('near S5', LAT + 0.031, LON + 4 * 0.012);

  it('finds a bus journey along the mapped route', () => {
    const r = plan(nearS1, nearS5, { modes: { metro: false, bus: true, ride: false } });
    const j = r.journeys.find((x) => x.modes.includes('bus'))!;
    const bus = j.legs.find((l) => l.mode === 'bus')!;
    expect(bus.route?.ref).toBe('T1');
    expect(bus.stops!.length).toBe(5);
    expect(bus.waitBasis).toBe('assumed');
    expect(bus.durationBasis).toBe('assumed');
  });

  it('never routes a bus backwards against its stop order', () => {
    const r = plan(nearS5, nearS1, { modes: { metro: false, bus: true, ride: false } });
    expect(r.journeys.some((j) => j.modes.includes('bus'))).toBe(false);
  });

  it('marks long bus fares as not verified instead of inventing them', () => {
    const r = plan(nearS1, nearS5, { modes: { metro: false, bus: true, ride: false } });
    const j = r.journeys.find((x) => x.modes.includes('bus'))!;
    // ≈ 5.2 km × 1.2 road factor > 6 km verified stage table
    expect(j.fare.complete).toBe(false);
    expect(j.legs.find((l) => l.mode === 'bus')!.fare?.amount).toBeNull();
  });

  it('applies Shakti for non-AC buses', () => {
    const r = plan(nearS1, nearS5, { shakti: true, modes: { metro: false, bus: true, ride: false } });
    const j = r.journeys.find((x) => x.modes.includes('bus'))!;
    expect(j.fare).toEqual({ known: 0, complete: true, unknownParts: [] });
  });
});

describe('ride-hailing and walking alternatives', () => {
  it('offers a full ride with no fare, labelled as assumptions', () => {
    const r = plan(nearA1, nearA4);
    const ride = r.journeys.find((j) => j.modes.length === 1 && j.modes[0] === 'ride')!;
    expect(ride).toBeDefined();
    expect(ride.fare.complete).toBe(false);
    expect(ride.legs[0].fare?.amount).toBeNull();
    expect(ride.legs[0].durationBasis).toBe('assumed');
  });

  it('omits ride options when rides are disabled', () => {
    const r = plan(nearA1, nearA4, { modes: { metro: true, bus: true, ride: false } });
    expect(r.journeys.some((j) => j.modes.includes('ride'))).toBe(false);
  });

  it('includes walking only for short trips', () => {
    expect(plan(nearA1, nearA4).journeys.some((j) => j.modes.join() === 'walk')).toBe(true);
    const far = place('far', LAT + 0.2, LON + 0.2);
    expect(plan(nearA1, far).journeys.some((j) => j.modes.join() === 'walk')).toBe(false);
  });
});

describe('no-route and invalid input', () => {
  it('reports when nothing is within walking distance', () => {
    const empty = place('empty', LAT + 0.15, LON + 0.15);
    const r = plan(empty, place('empty2', LAT + 0.16, LON + 0.2), { modes: { metro: true, bus: true, ride: false } });
    expect(r.journeys.some((j) => j.modes.includes('metro') || j.modes.includes('bus'))).toBe(false);
    expect(r.notices.join(' ')).toMatch(/No metro station or mapped (bus|BMTC) stop/);
  });

  it('does not plan places the local network does not reach', () => {
    const r = plan(place('Mysuru', 12.2958, 76.6394), nearA1);
    expect(r.journeys).toHaveLength(0);
    expect(r.notices[0]).toMatch(/within 2 km/);
  });

  it('gives every journey a unique id', () => {
    const r = plan(nearA1, nearB1);
    const ids = r.journeys.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
