import { clockOfMinutes, lastTrainMinutes, metroWait, operatingState } from '../features/metro/service';
import { rideEstimate, RIDE_ASSUMPTIONS } from '../features/ride/estimate';
import type { Journey, Leg, LegMode, Place, PlannerPreferences } from '../types/journey';
import type { BusRoute, BusStop, LatLon, MetroLine, MetroStation, TransportData } from '../types/transport';
import { haversineM, SpatialGrid, walkEstimate } from '../utils/geo';
import { formatDistance } from '../utils/format';
import { dijkstra, type PathStep } from './dijkstra';
import { applyFares } from './fare-estimator';
import { Graph, type Edge, type NodeInfo } from './graph';
import { scoreJourneys, tagJourneys } from './journey-ranking';

/** Bus travel between consecutive stops follows roads, so add 20 % to the straight distance. */
const BUS_ROAD_FACTOR = 1.2;
const STOP_TO_STOP_WALK_M = 250;
const STATION_TO_STOP_WALK_M = 350;
const MAX_ACCESS_STATIONS = 6;
const MAX_ACCESS_STOPS = 20;
const HAIL_RADIUS_M = 12000;
const MAX_HAIL_STATIONS = 8;
const WALK_ONLY_MAX_M = 5000;
const LAST_MILE_RIDE_MIN_WALK_M = 700;
/** Assumed average speed of KSRTC intercity buses (city buses use bmtc-schedules planning). */
export const KSRTC_SPEED_KMH = 40;
/**
 * Time to pass a metro station's entrance, security check and fare gates
 * (planning assumption). Added to every walk that enters or leaves a station,
 * so walking out and back in is never cheaper than an in-station interchange.
 */
export const STATION_GATE_SEC = 90;

export interface Network {
  graph: Graph;
  data: TransportData;
  stations: Map<string, MetroStation>;
  stops: Map<string, BusStop>;
  lines: Map<string, MetroLine>;
  routes: Map<string, BusRoute>;
  stationGrid: SpatialGrid<MetroStation>;
  stopGrid: SpatialGrid<BusStop>;
}

/** Builds the static transit graph once; queries add origin/destination edges on top. */
export function buildNetwork(data: TransportData): Network {
  const g = new Graph();
  const stations = new Map(data.stations.map((s) => [s.id, s]));
  const stops = new Map(data.stops.map((s) => [s.id, s]));
  const { metroSpeedKmh, metroDwellSec, interchangeWalkMin } = data.metroService.planning;
  const metroMps = metroSpeedKmh / 3.6;
  const busMps = data.busPlanning.busSpeedKmh / 3.6;
  // KSRTC intercity buses mostly run on highways (planning assumption, labelled in the leg notes).
  const intercityMps = KSRTC_SPEED_KMH / 3.6;

  for (const line of data.lines) {
    let prevVehicle = -1;
    let prevStation: MetroStation | null = null;
    line.stations.forEach((sid, i) => {
      const s = stations.get(sid)!;
      const st = g.addNode(`S:${sid}`, { type: 'station', refId: sid, lat: s.lat, lon: s.lon });
      const v = g.addNode(`M:${sid}`, { type: 'metro-vehicle', refId: sid, lat: s.lat, lon: s.lon, serviceId: line.id, seq: i });
      g.addEdge(st, { to: v, kind: 'board', timeSec: 0, distanceM: 0, mode: 'metro', serviceId: line.id });
      g.addEdge(v, { to: st, kind: 'alight', timeSec: 0, distanceM: 0, mode: 'metro', serviceId: line.id });
      if (prevStation) {
        const d = s.chainageM - prevStation.chainageM;
        g.addBidirectional(prevVehicle, v, { kind: 'ride', timeSec: d / metroMps + metroDwellSec, distanceM: d, mode: 'metro', serviceId: line.id });
      }
      prevVehicle = v;
      prevStation = s;
    });
  }

  for (const t of data.transfers) {
    g.addBidirectional(g.id(`S:${t.from}`)!, g.id(`S:${t.to}`)!, { kind: 'interchange', timeSec: interchangeWalkMin * 60, distanceM: t.walkM });
  }

  for (const s of data.stops) g.addNode(`B:${s.id}`, { type: 'stop', refId: s.id, lat: s.lat, lon: s.lon });

  for (const r of data.routes) {
    let prev = -1;
    r.stops.forEach((sid, i) => {
      const s = stops.get(sid)!;
      const b = g.id(`B:${sid}`)!;
      const v = g.addNode(`V:${r.id}:${i}`, { type: 'bus-vehicle', refId: sid, lat: s.lat, lon: s.lon, serviceId: r.id, seq: i });
      if (i < r.stops.length - 1) g.addEdge(b, { to: v, kind: 'board', timeSec: 0, distanceM: 0, mode: 'bus', serviceId: r.id });
      if (i > 0) {
        g.addEdge(v, { to: b, kind: 'alight', timeSec: 0, distanceM: 0, mode: 'bus', serviceId: r.id });
        const p = g.nodes[prev];
        const d = haversineM(p.lat, p.lon, s.lat, s.lon) * BUS_ROAD_FACTOR;
        g.addEdge(prev, { to: v, kind: 'ride', timeSec: d / (r.operator === 'KSRTC' ? intercityMps : busMps), distanceM: d, mode: 'bus', serviceId: r.id });
      }
      prev = v;
    });
  }

  const stationGrid = new SpatialGrid(data.stations);
  const stopGrid = new SpatialGrid(data.stops);
  const walkEdge = (a: number, b: number, straight: number, extraSec = 0) => {
    const w = walkEstimate(straight);
    g.addBidirectional(a, b, { kind: 'walk', timeSec: w.durationSec + extraSec, distanceM: w.distanceM });
  };
  for (const s of data.stops) {
    const a = g.id(`B:${s.id}`)!;
    for (const { item, distanceM } of stopGrid.within(s.lat, s.lon, STOP_TO_STOP_WALK_M))
      if (item.id > s.id) walkEdge(a, g.id(`B:${item.id}`)!, distanceM);
  }
  for (const st of data.stations) {
    const a = g.id(`S:${st.id}`)!;
    for (const { item, distanceM } of stopGrid.within(st.lat, st.lon, STATION_TO_STOP_WALK_M)) walkEdge(a, g.id(`B:${item.id}`)!, distanceM, STATION_GATE_SEC);
  }

  return {
    graph: g,
    data,
    stations,
    stops,
    lines: new Map(data.lines.map((l) => [l.id, l])),
    routes: new Map(data.routes.map((r) => [r.id, r])),
    stationGrid,
    stopGrid,
  };
}

/**
 * Coverage comes from the real network, not a city box: a place is served
 * when a mapped metro station or BMTC stop is within this distance (BMTC runs
 * beyond city limits, e.g. Harohalli, Anekal, Doddaballapura).
 */
export const SERVED_RADIUS_M = 2000;

export function isServed(net: Network, lat: number, lon: number): boolean {
  return net.stationGrid.within(lat, lon, SERVED_RADIUS_M).length > 0 || net.stopGrid.within(lat, lon, SERVED_RADIUS_M).length > 0;
}

export interface PlanRequest {
  origin: Place;
  destination: Place;
  departAt: Date;
  prefs: PlannerPreferences;
}

export interface PlanResult {
  journeys: Journey[];
  notices: string[];
}

interface Profile {
  id: string;
  metro: boolean;
  bus: boolean;
  hail: boolean;
  walkReluctance: number;
  boardPenaltySec: number;
  /** Extra cost multiplier for ride edges of services used by earlier results. */
  avoid?: Set<string>;
}

const ASSUMPTION_NOTES = {
  walk: 'Walking time assumes 4.8 km/h over 1.3 × straight-line distance, plus ~1.5 min to pass a metro station entrance and gates where relevant.',
  bus: 'Bus time assumes an average city speed; no BMTC timetable or live position is available.',
  metro: 'Metro run time is estimated from track distance; not a live prediction.',
};

export function planJourneys(net: Network, req: PlanRequest): PlanResult {
  const { origin, destination, departAt, prefs } = req;
  const notices: string[] = [];
  if (!isServed(net, origin.lat, origin.lon) || !isServed(net, destination.lat, destination.lon)) {
    // Places beyond the local network are handled by planTrip (intercity.ts).
    return { journeys: [], notices: ['No metro station or mapped BMTC stop within 2 km of one of these places.'] };
  }

  const g = net.graph;
  const O = g.nodes.length;
  const D = O + 1;
  const info = (id: number): NodeInfo =>
    id === O
      ? { type: 'origin', refId: 'origin', lat: origin.lat, lon: origin.lon }
      : id === D
        ? { type: 'destination', refId: 'destination', lat: destination.lat, lon: destination.lon }
        : g.nodes[id];

  // Access/egress edges for this query.
  const accessWalk = (p: Place) => {
    const edges: { node: number; edge: Omit<Edge, 'to'> }[] = [];
    const add = (node: number, straight: number, gateSec = 0) => {
      const w = walkEstimate(straight);
      if (w.distanceM <= prefs.maxWalkM || straight < 1) edges.push({ node, edge: { kind: 'walk', timeSec: w.durationSec + gateSec, distanceM: w.distanceM } });
    };
    const radius = prefs.maxWalkM;
    for (const { item, distanceM } of net.stationGrid.within(p.lat, p.lon, radius).slice(0, MAX_ACCESS_STATIONS))
      add(g.id(`S:${item.id}`)!, item.id === p.refId ? 0 : distanceM, item.id === p.refId ? 0 : STATION_GATE_SEC);
    for (const { item, distanceM } of net.stopGrid.within(p.lat, p.lon, radius).slice(0, MAX_ACCESS_STOPS))
      add(g.id(`B:${item.id}`)!, item.id === p.refId ? 0 : distanceM);
    return edges;
  };
  const accessHail = (p: Place) =>
    net.stationGrid
      .within(p.lat, p.lon, HAIL_RADIUS_M)
      .filter(({ distanceM }) => distanceM > 600)
      .slice(0, MAX_HAIL_STATIONS)
      .map(({ item }) => {
        const r = rideEstimate(p.lat, p.lon, item.lat, item.lon);
        return { node: g.id(`S:${item.id}`)!, edge: { kind: 'hail' as const, timeSec: r.durationSec + r.waitSec, distanceM: r.distanceM } };
      });

  const originWalk = accessWalk(origin).map(({ node, edge }) => ({ ...edge, to: node }));
  const originHail = accessHail(origin).map(({ node, edge }) => ({ ...edge, to: node }));
  const destWalk = new Map<number, Edge>();
  const destHail = new Map<number, Edge>();
  for (const { node, edge } of accessWalk(destination)) destWalk.set(node, { ...edge, to: D });
  for (const { node, edge } of accessHail(destination)) destHail.set(node, { ...edge, to: D });

  if (!originWalk.length) notices.push(`No metro station or mapped bus stop within ${formatDistance(prefs.maxWalkM)} of the start.`);
  if (!destWalk.size) notices.push(`No metro station or mapped bus stop within ${formatDistance(prefs.maxWalkM)} of the destination.`);

  // Board costs depend on line hours and headways at the departure time.
  const lineState = new Map<string, boolean>();
  const metroOpen = (lineId: string) => {
    if (!lineState.has(lineId)) {
      const line = net.lines.get(lineId)!;
      const mid = net.stations.get(line.stations[Math.floor(line.stations.length / 2)])!;
      const open =
        operatingState(line, mid, true, departAt, net.data.metroService) !== 'closed' ||
        operatingState(line, mid, false, departAt, net.data.metroService) !== 'closed';
      lineState.set(lineId, open);
      if (!open) notices.push(`${line.name}: no train scheduled at this time (reported hours). Journeys avoid it.`);
    }
    return lineState.get(lineId)!;
  };

  /**
   * A* estimate of the remaining cost: straight-line distance to the
   * destination at the fastest speed the profile allows — 10 m/s when metro
   * is allowed (34 km/h along track never shorter than the straight line),
   * 4 m/s for bus-only searches (14 km/h). Walks and rides cost more per
   * metre. The 1.2 weight trades a little optimality for a large speed-up on
   * the full BMTC network (1.5 for mixed metro+bus searches); journeys stay close to
   * the cheapest, which matters less than answering in about a second on a phone.
   */
  const heuristicFor = (p: Profile) => {
    const mps = p.metro ? 10 : 4;
    // Mixed metro+bus searches spread the widest, so they get a stronger focus.
    const w = p.metro && p.bus ? 1.5 : 1.2;
    return (node: number) => {
      const n = node === O ? origin : node === D ? destination : g.nodes[node];
      return (w * haversineM(n.lat, n.lon, destination.lat, destination.lon)) / mps;
    };
  };

  const search = (p: Profile) => {
    const neighbors = (u: number): Edge[] => {
      if (u === O) return p.hail ? [...originWalk, ...originHail] : originWalk;
      if (u === D) return [];
      const base = g.adj[u];
      const w = destWalk.get(u);
      const h = p.hail ? destHail.get(u) : undefined;
      return w || h ? [...base, ...(w ? [w] : []), ...(h ? [h] : [])] : base;
    };
    const cost = (e: Edge): number => {
      switch (e.kind) {
        case 'walk':
        case 'interchange':
          return e.timeSec * p.walkReluctance;
        case 'board': {
          if (e.mode === 'metro') {
            if (!p.metro || !metroOpen(e.serviceId!)) return Infinity;
            return metroWait(e.serviceId!, departAt, net.data.metroService).sec + p.boardPenaltySec;
          }
          if (!p.bus) return Infinity;
          return busWait(net, e.serviceId!).sec + p.boardPenaltySec;
        }
        case 'ride':
          return p.avoid?.has(e.serviceId!) ? e.timeSec * 1.6 : e.timeSec;
        case 'hail':
          return e.timeSec * 1.4 + 600;
        default:
          return 0;
      }
    };
    return dijkstra({ source: O, target: D, nodeCount: g.nodes.length + 2, neighbors, cost, heuristic: heuristicFor(p), maxBoardings: prefs.maxTransfers + 1 });
  };

  const profiles: Profile[] = [];
  const { metro, bus, ride } = prefs.modes;
  if (metro) profiles.push({ id: 'metro', metro: true, bus: false, hail: false, walkReluctance: 2, boardPenaltySec: 240 });
  if (bus) profiles.push({ id: 'bus', metro: false, bus: true, hail: false, walkReluctance: 2, boardPenaltySec: 240 });
  if (metro && bus) {
    profiles.push({ id: 'transit', metro: true, bus: true, hail: false, walkReluctance: 2, boardPenaltySec: 240 });
    // With the full BMTC network (~7,500 route patterns) each extra search costs
    // ~1 s on a phone, so only searches that add genuinely different options run.
  }
  if (metro && ride) profiles.push({ id: 'metro-ride', metro: true, bus: false, hail: true, walkReluctance: 3, boardPenaltySec: 240 });

  const results: Journey[] = [];
  const seen = new Set<string>();
  const add = (j: Journey | null) => {
    if (!j) return;
    const sig = signature(j);
    if (seen.has(sig)) return;
    seen.add(sig);
    results.push(j);
  };

  for (const p of profiles) {
    const res = search(p);
    if (!res) continue;
    const legs = stepsToLegs(res.steps, net, info, origin, destination, departAt);
    // A ride profile result is only useful when it actually combines a ride with the metro.
    if (p.hail && !(legs.some((l) => l.mode === 'ride') && legs.some((l) => l.mode === 'metro'))) continue;
    const j = assemble(legs, net, req);
    add(j);
    // One alternative per transit profile that avoids the services just used.
    if (j && p.id === 'transit') {
      const used = new Set(legs.filter((l) => l.mode === 'bus' || l.mode === 'metro').map((l) => (l.route?.id ?? l.line?.id)!));
      const alt = search({ ...p, id: `${p.id}-alt`, avoid: used });
      if (alt) add(assemble(stepsToLegs(alt.steps, net, info, origin, destination, departAt), net, req));
    }
  }

  // Bus + ride: replace a long first/last walk in bus journeys with a ride.
  if (ride)
    for (const j of [...results]) {
      if (!j.modes.includes('bus')) continue;
      const legs = j.legs.map((l) => ({ ...l, notes: [...l.notes] }));
      let changed = false;
      const first = legs[0];
      if (first.mode === 'walk' && first.distanceM > LAST_MILE_RIDE_MIN_WALK_M) {
        legs[0] = rideLeg(first.from, first.to);
        changed = true;
      }
      const last = legs[legs.length - 1];
      if (last.mode === 'walk' && last.distanceM > LAST_MILE_RIDE_MIN_WALK_M) {
        legs[legs.length - 1] = rideLeg(last.from, last.to);
        changed = true;
      }
      if (changed) add(assemble(legs, net, req, true));
    }

  const straight = haversineM(origin.lat, origin.lon, destination.lat, destination.lon);
  if (straight * 1.3 <= WALK_ONLY_MAX_M) add(assemble([walkLeg(origin, destination, straight)], net, req, true));
  if (ride && straight > 500) add(assemble([rideLeg(origin, destination)], net, req, true));

  if (!results.some((j) => j.modes.some((m) => m === 'metro' || m === 'bus')))
    notices.push('No public-transport journey was found with the current walking and transfer limits.');

  scoreJourneys(results, prefs.weights);
  tagJourneys(results);
  return { journeys: results, notices };
}

/** Assembles legs built outside the search (e.g. intercity journeys) into a scored-ready journey with a stable id. */
export function assembleJourney(legs: Leg[], net: Network, req: PlanRequest): Journey | null {
  const j = assemble(legs, net, req, true);
  if (j) signature(j);
  return j;
}

/** Half the GTFS average headway when a licensed timetable was imported, else the stated assumption. */
function busWait(net: Network, routeId: string): { sec: number; basis: 'estimated' | 'assumed'; note: string } {
  const s = net.data.busSchedules?.[routeId];
  if (s) return { sec: (s.avgHeadwayMin / 2) * 60, basis: 'estimated', note: `half the ${s.avgHeadwayMin}-min average timetable headway` };
  const m = net.data.busPlanning.assumedWaitMin;
  return { sec: m * 60, basis: 'assumed', note: `assumed ${m} min (no published BMTC timetable)` };
}

/** Fare between the boarding and alighting stops' zones, route-specific first. */
function busFareFromTable(net: Network, leg: Leg): number | null {
  const table = net.data.busFares;
  if (!table || !leg.route) return null;
  const from = leg.from.refId ? net.stops.get(leg.from.refId)?.zone : undefined;
  const to = leg.to.refId ? net.stops.get(leg.to.refId)?.zone : undefined;
  if (!from || !to) return null;
  const key = `${from}|${to}`;
  const gid = net.routes.get(leg.route.id)?.gtfsRouteId;
  const specific = gid ? table.byRoute[gid]?.[key] : undefined;
  // The general table is the ordinary-bus fare; AC (Vajra) routes only use their own table.
  return specific ?? (leg.route.ac ? null : (table.general[key] ?? null));
}

function placeFor(id: number, net: Network, info: (id: number) => NodeInfo, origin: Place, destination: Place): Place {
  const n = info(id);
  if (n.type === 'origin') return origin;
  if (n.type === 'destination') return destination;
  if (n.type === 'station' || n.type === 'metro-vehicle') {
    const s = net.stations.get(n.refId)!;
    return { name: s.name, lat: s.lat, lon: s.lon, kind: 'metro', refId: s.id, subtitle: net.lines.get(s.line)?.name };
  }
  const s = net.stops.get(n.refId)!;
  return { name: s.name, lat: s.lat, lon: s.lon, kind: 'bus', refId: s.id, subtitle: 'Bus stop' };
}

export function walkLeg(from: Place, to: Place, straightM: number, interchange = false): Leg {
  const w = walkEstimate(straightM);
  return {
    mode: 'walk',
    from,
    to,
    distanceM: w.distanceM,
    durationSec: w.durationSec,
    durationBasis: 'estimated',
    waitSec: 0,
    waitBasis: 'estimated',
    geometry: [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ],
    geometryKind: 'approximate',
    interchange,
    notes: [ASSUMPTION_NOTES.walk],
  };
}

export function rideLeg(from: Place, to: Place): Leg {
  const r = rideEstimate(from.lat, from.lon, to.lat, to.lon);
  return {
    mode: 'ride',
    from,
    to,
    distanceM: r.distanceM,
    durationSec: r.durationSec,
    durationBasis: 'assumed',
    waitSec: r.waitSec,
    waitBasis: 'assumed',
    geometry: [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ],
    geometryKind: 'approximate',
    notes: [RIDE_ASSUMPTIONS.explanation],
  };
}

function stepsToLegs(
  steps: PathStep[],
  net: Network,
  info: (id: number) => NodeInfo,
  origin: Place,
  destination: Place,
  departAt: Date,
): Leg[] {
  const legs: Leg[] = [];
  let cur: Leg | null = null;
  const place = (id: number) => placeFor(id, net, info, origin, destination);

  for (const { from, edge } of steps) {
    const a = info(from);
    const b = info(edge.to);
    switch (edge.kind) {
      case 'walk':
      case 'interchange': {
        const interchange = edge.kind === 'interchange';
        const prev = legs[legs.length - 1];
        if (!interchange && prev && prev.mode === 'walk' && !prev.interchange && !cur) {
          prev.to = place(edge.to);
          prev.distanceM += edge.distanceM;
          prev.durationSec += edge.timeSec;
          prev.geometry.push([b.lat, b.lon]);
        } else {
          const leg = walkLeg(place(from), place(edge.to), 0, interchange);
          leg.distanceM = edge.distanceM;
          leg.durationSec = edge.timeSec;
          if (interchange) {
            leg.durationBasis = 'assumed';
            leg.notes = [`Change lines inside the station (assumed ${Math.round(edge.timeSec / 60)} min). Your ticket remains valid.`];
          }
          legs.push(leg);
        }
        break;
      }
      case 'hail':
        legs.push(rideLeg(place(from), place(edge.to)));
        break;
      case 'board': {
        const p = place(from);
        if (edge.mode === 'metro') {
          const line = net.lines.get(edge.serviceId!)!;
          const wait = metroWait(line.id, departAt, net.data.metroService);
          cur = {
            mode: 'metro',
            from: p,
            to: p,
            distanceM: 0,
            durationSec: 0,
            durationBasis: 'estimated',
            waitSec: wait.sec,
            waitBasis: wait.basis,
            line: { id: line.id, name: line.name, colour: line.colour },
            stops: [p],
            geometry: [[p.lat, p.lon]],
            geometryKind: 'track',
            notes: [ASSUMPTION_NOTES.metro, `Wait: ${wait.note}.`],
          };
        } else {
          const r = net.routes.get(edge.serviceId!)!;
          const wait = busWait(net, r.id);
          cur = {
            mode: 'bus',
            from: p,
            to: p,
            distanceM: 0,
            durationSec: 0,
            durationBasis: 'assumed',
            waitSec: wait.sec,
            waitBasis: wait.basis,
            route: { id: r.id, ref: r.ref, name: r.name, ac: r.ac, operator: r.operator },
            stops: [p],
            geometry: [[p.lat, p.lon]],
            geometryKind: 'stops',
            notes: [
              r.operator === 'KSRTC' ? `KSRTC intercity bus: time assumes ${KSRTC_SPEED_KMH} km/h on average; book the seat with KSRTC.` : ASSUMPTION_NOTES.bus,
              `Wait: ${wait.note}.`,
            ],
          };
        }
        break;
      }
      case 'ride': {
        if (!cur) break;
        cur.distanceM += edge.distanceM;
        cur.durationSec += edge.timeSec;
        const p = place(edge.to);
        cur.stops!.push(p);
        if (cur.mode === 'metro') {
          const line = net.lines.get(cur.line!.id)!;
          const i = a.seq!;
          const j = b.seq!;
          const seg = j > i ? line.segments[i] : [...line.segments[j]].reverse();
          cur.geometry.push(...seg.slice(1));
        } else cur.geometry.push([p.lat, p.lon]);
        break;
      }
      case 'alight':
        if (cur) {
          cur.to = place(edge.to);
          legs.push(cur);
          cur = null;
        }
        break;
    }
  }
  // Drop zero-length walks (e.g. the origin is the station itself).
  return legs.filter((l) => !(l.mode === 'walk' && !l.interchange && l.distanceM < 15));
}

const MODE_LABEL: Record<LegMode, string> = { walk: 'Walk', metro: 'Metro', bus: 'BMTC Bus', ride: 'Cab / Auto', train: 'Train' };

function assemble(legs: Leg[], net: Network, req: PlanRequest, allowLongWalk = false): Journey | null {
  if (!legs.length) return null;
  const { departAt, prefs } = req;
  const walkLegs = legs.filter((l) => l.mode === 'walk');
  const walkM = walkLegs.reduce((n, l) => n + l.distanceM, 0);
  if (!allowLongWalk && walkM > prefs.maxWalkM * 2) return null;

  let t = departAt.getTime();
  const warnings = new Set<string>();
  for (const l of legs) {
    if (l.mode === 'metro' && l.line) {
      const line = net.lines.get(l.line.id)!;
      const st = net.stations.get(l.from.refId!)!;
      const towardsEnd = line.stations.indexOf(l.to.refId!) > line.stations.indexOf(st.id);
      const state = operatingState(line, st, towardsEnd, new Date(t + l.waitSec * 1000), net.data.metroService);
      if (state === 'closed') return null;
      if (state === 'unknown') warnings.add(`${line.name} hours are not verified — late-night/early trains may not run. Check bmrc.co.in before travelling.`);
      // Last-train warning when boarding within 45 minutes of the estimated last train here.
      const last = lastTrainMinutes(line, st, towardsEnd, net.data.metroService);
      const board = new Date(t + l.waitSec * 1000);
      const boardMin = board.getHours() * 60 + board.getMinutes();
      if (state === 'open' && last != null && last - boardMin <= 45) {
        const towards = net.stations.get(line.stations[towardsEnd ? line.stations.length - 1 : 0])?.name ?? '';
        warnings.add(`Last ${line.name} train from ${st.name} towards ${towards} is around ${clockOfMinutes(last)} (estimated from the reported last departure). Leave on time, or pick a cab option.`);
      }
    }
    if (l.mode === 'bus' && l.route) {
      // Community GTFS gives each route's last trip from its first stop; warn near or after it.
      const last = net.data.busSchedules?.[l.route.id]?.lastDeparture;
      const board = new Date(t + l.waitSec * 1000);
      const boardMin = board.getHours() * 60 + board.getMinutes();
      if (last) {
        const [h, m] = last.split(':').map(Number);
        if (h * 60 + m - boardMin <= 45 && boardMin >= 18 * 60)
          warnings.add(`Bus ${l.route.ref ?? l.route.name}: the last scheduled trip leaves its first stop at ${last} (community timetable). It may already have gone — check the Namma BMTC app.`);
      }
    }
    t += (l.waitSec + l.durationSec) * 1000;
  }

  const fare = applyFares(legs, net.data.fares, prefs.shakti, (leg) => busFareFromTable(net, leg));
  const vehicleLegs = legs.filter((l) => l.mode !== 'walk');
  const modes = [...new Set(legs.map((l) => l.mode))];
  const titleModes = modes.filter((m) => m !== 'walk' || walkM > 100 || modes.length === 1);
  if (modes.includes('train')) warnings.add('Train time is estimated from distance. Tap “See trains & book” on the train step for the real trains, times and fares.');
  if (vehicleLegs.some((l) => l.route?.operator === 'KSRTC')) warnings.add('KSRTC bus time is estimated from distance. KSRTC shows the real departures and fare when you book.');
  if (vehicleLegs.some((l) => l.mode === 'bus' && l.route?.operator !== 'KSRTC')) warnings.add('Bus times use assumptions — BMTC timetables and live positions are not available to this app.');
  if (modes.includes('ride')) warnings.add('Ride times are planning assumptions. Uber, Ola, Rapido and others show the real fare and ETA before you confirm.');

  const durationSec = (t - departAt.getTime()) / 1000;
  return {
    id: '',
    title: titleModes.map((m) => (m === 'bus' && !vehicleLegs.some((l) => l.mode === 'bus' && l.route?.operator !== 'KSRTC') ? 'KSRTC Bus' : MODE_LABEL[m])).join(' + '),
    legs,
    departAt: departAt.getTime(),
    arriveAt: t,
    durationSec,
    walkM,
    walkSec: walkLegs.reduce((n, l) => n + l.durationSec, 0),
    waitSec: legs.reduce((n, l) => n + l.waitSec, 0),
    transfers: Math.max(0, vehicleLegs.length - 1),
    fare,
    modes,
    warnings: [...warnings],
    tags: [],
  };
}

function signature(j: Journey): string {
  const sig = j.legs
    .filter((l) => l.mode !== 'walk')
    .map((l) => `${l.mode}:${l.line?.id ?? l.route?.id ?? ''}:${l.from.refId ?? l.from.name}>${l.to.refId ?? l.to.name}`)
    .join('|');
  const id = sig || 'walk';
  j.id = hash(id);
  return id;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export type { LatLon };
