import type { Journey, Leg, Place } from '../types/journey';
import { BENGALURU_CENTER, haversineM, inKarnataka } from '../utils/geo';
import { railOption, railPlace, type RailOption } from './rail';
import { scoreJourneys, tagJourneys } from './journey-ranking';
import { assembleJourney, isServed, planJourneys, rideLeg, walkLeg, type Network, type PlanRequest, type PlanResult } from './multimodal-router';

/**
 * Trips that leave Bengaluru. No operator outside Bengaluru publishes open
 * routes or timetables (checked 2026-10-24), so Hogona never invents an
 * intercity bus leg. Instead it plans the real Bengaluru part — to or from
 * Kempegowda Bus Station (Majestic), the main KSRTC terminal — and hands the
 * intercity part to KSRTC's official booking (ksrtc.in / AWATAR app).
 */
export interface IntercityInfo {
  from: Place;
  to: Place;
  /** KSRTC terminal used for the Bengaluru part. */
  stand: Place;
  /** Which Bengaluru part was planned, if any. */
  bengaluruLeg: 'to-stand' | 'from-stand' | null;
  /** Train alternative between stations with known codes, when one is near both ends. */
  rail: RailOption | null;
}

export type TripResult = PlanResult & { intercity?: IntercityInfo };

/** Kempegowda Bus Station (Majestic), from the bundled BMTC stop data. */
export const KSRTC_TERMINAL: Place = {
  name: 'Kempegowda Bus Station',
  lat: 12.97751,
  lon: 77.57141,
  kind: 'bus',
  refId: 'gtfs-20921',
  subtitle: 'Majestic · KSRTC and BMTC bus terminal',
};

/** Without a local transit journey, trips longer than this are handled as intercity. */
const INTERCITY_MIN_M = 40_000;

export function planTrip(net: Network, req: PlanRequest): TripResult {
  const { origin, destination } = req;
  // "Served" = reachable by the real local network (metro / mapped BMTC), which extends past city limits.
  let oBlr = isServed(net, origin.lat, origin.lon);
  let dBlr = isServed(net, destination.lat, destination.lon);
  if (oBlr && dBlr) {
    const r = planJourneys(net, req);
    // The community data includes a few KSRTC stops in other towns (e.g. Mysuru bus stand), so both
    // ends can look "served" with no real local journey between them. Then treat the end farther from
    // Bengaluru as intercity rather than offering a city cab for hundreds of kilometres.
    const transit = r.journeys.some((j) => j.modes.includes('metro') || j.modes.includes('bus'));
    if (transit || haversineM(origin.lat, origin.lon, destination.lat, destination.lon) < INTERCITY_MIN_M) return r;
    const fromCentre = (p: Place) => haversineM(p.lat, p.lon, BENGALURU_CENTER.lat, BENGALURU_CENTER.lon);
    oBlr = fromCentre(origin) <= fromCentre(destination);
    dBlr = !oBlr;
  }

  if (!inKarnataka(origin.lat, origin.lon) || !inKarnataka(destination.lat, destination.lon)) {
    return { journeys: [], notices: ['Hogona plans trips within Karnataka. Pick a start and destination in Karnataka.'] };
  }

  const bengaluruLeg = oBlr ? 'to-stand' : dBlr ? 'from-stand' : null;
  const rail = railOption(origin, destination, bengaluruLeg === 'to-stand' ? 'origin' : bengaluruLeg === 'from-stand' ? 'destination' : null);
  const intercity: IntercityInfo = { from: origin, to: destination, stand: KSRTC_TERMINAL, bengaluruLeg, rail };

  // Door-to-door journeys only: city part (planned on the real network) + intercity leg + the other end.
  const journeys: Journey[] = [];
  const add = (legs: Leg[]) => {
    const j = assembleJourney(legs, net, req);
    if (j && !journeys.some((x) => x.id === j.id)) journeys.push(j);
  };
  const intercityLegs: { start: Place; end: Place; leg: Leg }[] = [];
  if (rail) {
    const a = railPlace(rail.from);
    const b = railPlace(rail.to);
    intercityLegs.push({ start: a, end: b, leg: trainLeg(a, b) });
  }

  if (bengaluruLeg === 'to-stand') {
    for (const city of bestCity(net, { ...req, destination: KSRTC_TERMINAL })) add([...city.legs, ksrtcLeg(KSRTC_TERMINAL, destination)]);
    for (const { start, end, leg } of intercityLegs)
      for (const city of bestCity(net, { ...req, destination: start })) add([...city.legs, leg, accessLeg(end, destination)]);
  } else if (bengaluruLeg === 'from-stand') {
    const bus = ksrtcLeg(origin, KSRTC_TERMINAL);
    for (const city of bestCity(net, { ...req, origin: KSRTC_TERMINAL, departAt: after(req.departAt, [bus]) })) add([bus, ...city.legs]);
    for (const { start, end, leg } of intercityLegs) {
      const first = [accessLeg(origin, start), leg];
      for (const city of bestCity(net, { ...req, origin: end, departAt: after(req.departAt, first) })) add([...first, ...city.legs]);
    }
  } else {
    add([ksrtcLeg(origin, destination)]);
    for (const { start, end, leg } of intercityLegs) add([accessLeg(origin, start), leg, accessLeg(end, destination)]);
  }

  scoreJourneys(journeys, req.prefs.weights);
  tagJourneys(journeys);
  const notices = journeys.length ? [] : ['No complete journey could be planned for these places.'];
  return { journeys, notices, intercity };
}

/** Top city journeys (by score) that actually use transport, so every option is complete and sensible. */
function bestCity(net: Network, req: PlanRequest): Journey[] {
  return planJourneys(net, req)
    .journeys.filter((j) => j.modes.some((m) => m !== 'walk') || j.walkM < 1200)
    .sort((a, b) => (a.score?.total ?? 0) - (b.score?.total ?? 0))
    .slice(0, 2);
}

const after = (d: Date, legs: Leg[]) => new Date(d.getTime() + legs.reduce((n, l) => n + (l.waitSec + l.durationSec) * 1000, 0));

/** Walk when it's short, otherwise a cab/auto (the fare is shown in the ride app). */
function accessLeg(from: Place, to: Place): Leg {
  const straight = haversineM(from.lat, from.lon, to.lat, to.lon);
  return straight * 1.3 <= 1200 ? walkLeg(from, to, straight) : rideLeg(from, to);
}

const KSRTC_SPEED_KMH = 45;
const TRAIN_SPEED_KMH = 50;

/** Intercity KSRTC bus. Time is an estimate from road distance; KSRTC shows the real schedule and fare. */
function ksrtcLeg(from: Place, to: Place): Leg {
  const distanceM = haversineM(from.lat, from.lon, to.lat, to.lon) * 1.3;
  return {
    mode: 'bus',
    from,
    to,
    distanceM,
    durationSec: distanceM / (KSRTC_SPEED_KMH / 3.6),
    durationBasis: 'assumed',
    waitSec: 15 * 60,
    waitBasis: 'assumed',
    route: { id: 'ksrtc-intercity', ref: 'KSRTC', name: 'KSRTC intercity bus', ac: false, operator: 'KSRTC' },
    geometry: [[from.lat, from.lon], [to.lat, to.lon]],
    geometryKind: 'approximate',
    notes: [`Time estimated at ${KSRTC_SPEED_KMH} km/h average by road plus a 15-min wait. KSRTC shows the real departures and fare.`],
  };
}

/** Indian Railways leg between two coded stations. Time is an estimate; the booking site shows the real trains. */
function trainLeg(from: Place, to: Place): Leg {
  const distanceM = haversineM(from.lat, from.lon, to.lat, to.lon) * 1.25;
  return {
    mode: 'train',
    from,
    to,
    distanceM,
    durationSec: distanceM / (TRAIN_SPEED_KMH / 3.6),
    durationBasis: 'assumed',
    waitSec: 20 * 60,
    waitBasis: 'assumed',
    route: { id: `rail-${from.refId}-${to.refId}`, ref: `${from.refId?.slice(5)} → ${to.refId?.slice(5)}`, name: 'Indian Railways', ac: false, operator: 'IR' },
    geometry: [[from.lat, from.lon], [to.lat, to.lon]],
    geometryKind: 'approximate',
    notes: [`Time estimated at ${TRAIN_SPEED_KMH} km/h average plus 20 min to reach the platform. Real trains, times and fares are on the booking page.`],
  };
}
