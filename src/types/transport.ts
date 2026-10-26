export type LatLon = [number, number];

export interface MetroStation {
  id: string;
  name: string;
  nameKn: string | null;
  lat: number;
  lon: number;
  line: string;
  osmId: string;
  /** Distance along the line's track from the first station, in metres. */
  chainageM: number;
  trackOffsetM: number;
}

export interface MetroLine {
  id: string;
  name: string;
  colour: string;
  osmRelation: number;
  stations: string[];
  trackLengthM: number;
  /** segments[i] is the track polyline from stations[i] to stations[i + 1]. */
  segments: LatLon[][];
}

export interface MetroTransfer {
  from: string;
  to: string;
  walkM: number;
  name: string;
}

export interface BusStop {
  id: string;
  /** BMTC fare zone (GTFS zone_id), when the data source provides it. */
  zone?: string;
  name: string;
  nameKn: string | null;
  lat: number;
  lon: number;
  osmId: string;
}

export interface BusRoute {
  id: string;
  /** Source GTFS route_id, used for route-specific fares. */
  gtfsRouteId?: string;
  ref: string | null;
  name: string;
  from: string | null;
  to: string | null;
  operator: string;
  ac: boolean;
  osmRelation: number;
  stops: string[];
}

export interface FareSlab {
  uptoKm: number | null;
  fare: number;
}

export interface FareTables {
  metro: {
    effectiveFrom: string;
    slabs: FareSlab[];
    discounts: Record<string, unknown>;
    caveats: string[];
    sources: string[];
  };
  bmtc: {
    effectiveFrom: string;
    ordinaryStages: FareSlab[];
    ordinaryVerifiedUptoKm: number;
    acFares: FareSlab[] | null;
    shakti: string;
    caveats: string[];
    sources: string[];
  };
}

export interface MetroLineService {
  hours: {
    weekdayFirst: string;
    sundayFirst: string;
    /** Last departure from line.stations[0] / from the final station. */
    lastFromFirstStation?: string;
    lastFromLastStation?: string;
    terminals?: string;
  } | null;
  headwayMin: { peak: number; offPeak: number } | null;
  status: 'verified' | 'reported' | 'unverified';
  source?: string;
  note: string;
}

export interface MetroService {
  officialTimingsUrl: string;
  officialMapUrl: string;
  lines: Record<string, MetroLineService>;
  planning: {
    metroSpeedKmh: number;
    metroDwellSec: number;
    assumedWaitMinUnknownHeadway: number;
    interchangeWalkMin: number;
    explanation: string;
  };
}

export interface BusPlanning {
  busSpeedKmh: number;
  assumedWaitMin: number;
  explanation: string;
}

/** Per-route average headway, only present when a licensed GTFS feed was imported. */
export interface BusRouteSchedule {
  trips: number;
  firstDeparture: string;
  lastDeparture: string;
  avgHeadwayMin: number;
}

export interface TransportData {
  stations: MetroStation[];
  lines: MetroLine[];
  transfers: MetroTransfer[];
  stops: BusStop[];
  routes: BusRoute[];
  fares: FareTables;
  metroService: MetroService;
  busPlanning: BusPlanning;
  busSchedules?: Record<string, BusRouteSchedule>;
  busFares?: BusFareTable;
}

/** Zone-pair fares ("FROMZONE|TOZONE" → INR) from a GTFS feed's fare rules. */
export interface BusFareTable {
  source: string;
  licence: string;
  general: Record<string, number>;
  byRoute: Record<string, Record<string, number>>;
}
