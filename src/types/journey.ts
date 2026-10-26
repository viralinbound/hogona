import type { LatLon } from './transport';

export type PlaceKind = 'address' | 'metro' | 'bus' | 'current' | 'map' | 'favourite';

export interface Place {
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
  /** Station or stop id when the place is a transit node. */
  refId?: string;
  subtitle?: string;
}

export type LegMode = 'walk' | 'metro' | 'bus' | 'ride' | 'train';

/** How a number was obtained. Shown next to every time and fare in the UI. */
export type Basis =
  | 'estimated' // calculated by this app from distance and a stated speed
  | 'assumed' // a planning assumption (e.g. average wait with no published headway)
  | 'published' // taken from a published (but not live) source
  | 'routed' // from a routing service using the real road/path network
  | 'unknown';

export interface FareInfo {
  amount: number | null;
  basis: 'slab-estimate' | 'stage-estimate' | 'unknown' | 'in-app';
  label: string;
}

export interface Leg {
  mode: LegMode;
  from: Place;
  to: Place;
  distanceM: number;
  durationSec: number;
  durationBasis: Basis;
  waitSec: number;
  waitBasis: Basis;
  line?: { id: string; name: string; colour: string };
  route?: { id: string; ref: string | null; name: string; ac: boolean; operator?: string };
  /** All stops/stations from boarding to alighting (inclusive). */
  stops?: Place[];
  geometry: LatLon[];
  /** 'track' = mapped rail track; 'stops' = straight lines between consecutive stops; 'approximate' = straight line. */
  geometryKind: 'track' | 'stops' | 'approximate' | 'routed';
  fare?: FareInfo;
  /** Walk between two metro lines inside the paid area (one ticket continues). */
  interchange?: boolean;
  notes: string[];
}

export interface JourneyFare {
  /** Sum of the fares the app could estimate. */
  known: number;
  /** True when every paid leg has an estimate. */
  complete: boolean;
  unknownParts: string[];
}

export type JourneyTag = 'fastest' | 'cheapest' | 'least-walking' | 'fewest-transfers' | 'recommended';

export interface Journey {
  id: string;
  title: string;
  legs: Leg[];
  departAt: number;
  arriveAt: number;
  durationSec: number;
  walkM: number;
  walkSec: number;
  waitSec: number;
  transfers: number;
  fare: JourneyFare;
  modes: LegMode[];
  warnings: string[];
  tags: JourneyTag[];
  score?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  total: number;
  time: number;
  cost: number;
  walking: number;
  transfers: number;
}

export interface RankingWeights {
  time: number;
  cost: number;
  walking: number;
  transfers: number;
}

export interface PlannerPreferences {
  maxWalkM: number;
  maxTransfers: number;
  modes: { metro: boolean; bus: boolean; ride: boolean };
  weights: RankingWeights;
  /** Applies the Shakti scheme (free non-AC BMTC travel for women resident in Karnataka). */
  shakti: boolean;
  theme: 'system' | 'light' | 'dark';
  /** UI language. Place and route names are data and stay as published. */
  language: 'en' | 'hi' | 'kn';
}

export const DEFAULT_PREFERENCES: PlannerPreferences = {
  maxWalkM: 1200,
  maxTransfers: 3,
  modes: { metro: true, bus: true, ride: true },
  weights: { time: 3, cost: 2, walking: 2, transfers: 1 },
  shakti: false,
  theme: 'system',
  language: 'en',
};

export type SortKey = 'recommended' | 'fastest' | 'cheapest' | 'least-walking' | 'fewest-transfers';
