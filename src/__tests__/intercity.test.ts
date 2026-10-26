import { KSRTC_TERMINAL, planTrip } from '../algorithms/intercity';
import { buildNetwork } from '../algorithms/multimodal-router';
import { transportData } from '../services/transport-data';
import { DEFAULT_PREFERENCES, type Place } from '../types/journey';

const net = buildNetwork(transportData);
const at = new Date(2026, 9, 24, 9, 0);
const place = (name: string, lat: number, lon: number): Place => ({ name, lat, lon, kind: 'address' });
const indiranagar = place('Indiranagar', 12.9784, 77.6408);
const mysuru = place('Mysuru', 12.2958, 76.6394);
const hubballi = place('Hubballi', 15.3647, 75.124);
const chennai = place('Chennai', 13.0827, 80.2707);
const trip = (o: Place, d: Place) => planTrip(net, { origin: o, destination: d, departAt: at, prefs: DEFAULT_PREFERENCES });

describe('trips leaving Bengaluru', () => {
  it('offers only complete door-to-door journeys, by KSRTC bus and by train', () => {
    const r = trip(indiranagar, mysuru);
    expect(r.intercity?.bengaluruLeg).toBe('to-stand');
    expect(r.journeys.length).toBeGreaterThan(1);
    for (const j of r.journeys) {
      expect(j.legs[0].from.name).toBe('Indiranagar');
      expect(j.legs[j.legs.length - 1].to.name).toBe('Mysuru');
    }
    const bus = r.journeys.find((j) => j.legs.some((l) => l.route?.operator === 'KSRTC'))!;
    expect(bus.legs.find((l) => l.route?.operator === 'KSRTC')!.from.name).toBe(KSRTC_TERMINAL.name);
    const train = r.journeys.find((j) => j.modes.includes('train'))!;
    expect(train.legs.find((l) => l.mode === 'train')!.from.refId).toBe('rail:SBC');
    expect(train.fare.unknownParts).toContain('train');
  });

  it('arriving in Bengaluru: intercity first, then the city part', () => {
    const r = trip(mysuru, indiranagar);
    expect(r.intercity?.bengaluruLeg).toBe('from-stand');
    for (const j of r.journeys) {
      expect(j.legs[0].from.name).toBe('Mysuru');
      expect(j.legs[j.legs.length - 1].to.name).toBe('Indiranagar');
    }
  });

  it('between two other towns: KSRTC and train between real stations, no invented city legs', () => {
    const r = trip(mysuru, place('Udupi', 13.3409, 74.7421));
    expect(r.intercity?.bengaluruLeg).toBeNull();
    for (const j of r.journeys) expect(j.modes.every((m) => m === 'bus' || m === 'train' || m === 'ride' || m === 'walk')).toBe(true);
  });

  it('rejects places outside Karnataka', () => {
    const r = trip(indiranagar, chennai);
    expect(r.intercity).toBeUndefined();
    expect(r.notices[0]).toMatch(/within Karnataka/);
  });

  it('plans BMTC beyond the city box where the real network reaches (Harohalli)', () => {
    const r = trip(place('Jayanagar', 12.925, 77.5838), place('Harohalli', 12.68, 77.474));
    expect(r.intercity).toBeUndefined();
    expect(r.journeys.some((j) => j.modes.includes('bus'))).toBe(true);
  });

  it('plans real BMTC buses to Kanakapura (covered by the Namma BMTC data)', () => {
    const r = trip(indiranagar, place('Kanakapura', 12.5462, 77.4196));
    expect(r.intercity).toBeUndefined();
    expect(r.journeys.some((j) => j.modes.includes('bus'))).toBe(true);
  });

  it('labels KSRTC intercity services from the data as KSRTC, not BMTC', () => {
    const r = trip(indiranagar, hubballi);
    const ksrtc = r.journeys.flatMap((j) => j.legs).filter((l) => l.route?.operator === 'KSRTC');
    for (const l of ksrtc) expect(l.fare?.basis).toBe('in-app');
  });

  it('leaves trips inside Bengaluru unchanged', () => {
    const r = trip(indiranagar, place('Jayanagar', 12.925, 77.5838));
    expect(r.intercity).toBeUndefined();
    expect(r.journeys.length).toBeGreaterThan(0);
  });
});

describe('intercity by train and far-away community stops', () => {
  const pattandur = place('Pattandur Agrahara', 12.9886, 77.7192);
  const mysuruCentre = place('Mysuru', 12.3051, 76.6551);

  it('never offers a city cab for a 180 km trip just because a KSRTC stop is near the destination', () => {
    const r = trip(pattandur, mysuruCentre);
    expect(r.intercity?.bengaluruLeg).toBe('to-stand');
    expect(r.journeys.length).toBeGreaterThan(0);
    for (const j of r.journeys) expect(j.modes.includes('train') || j.legs.some((l) => l.route?.operator === 'KSRTC')).toBe(true);
  });

  it('suggests the train between real station codes', () => {
    expect(trip(pattandur, mysuruCentre).intercity?.rail).toMatchObject({ from: { code: 'SBC' }, to: { code: 'MYS' } });
    expect(trip(hubballi, indiranagar).intercity?.rail).toMatchObject({ from: { code: 'UBL' }, to: { code: 'SBC' } });
  });
});
