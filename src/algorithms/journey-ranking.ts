import type { Journey, JourneyTag, RankingWeights, ScoreBreakdown, SortKey } from '../types/journey';

/**
 * Balanced score (lower is better). Each factor is a ratio to the best
 * alternative in the same result set, so 1.0 means "as good as the best":
 *
 *   time      = duration / fastest duration
 *   cost      = (known fare + 20) / (cheapest fare + 20)   [× penalty below]
 *   walking   = (walk m + 500) / (least walk m + 500)
 *   transfers = 1 + 0.5 × (transfers − fewest transfers)
 *
 * total = Σ weightᵢ × factorᵢ / Σ weightᵢ
 *
 * Fares the app cannot verify are never assumed to be cheap:
 *  - a journey with an unverified bus/metro fare gets its cost factor × 1.25;
 *  - a journey with a ride-hailing leg gets the worst non-ride cost factor × 1.5.
 * These are ranking penalties only; no ride or bus fare is ever displayed from them.
 * The offsets (+20, +500) stop tiny values dominating the ratios.
 */
export function scoreJourneys(journeys: Journey[], weights: RankingWeights): void {
  if (!journeys.length) return;
  const minDur = Math.min(...journeys.map((j) => j.durationSec));
  const complete = journeys.filter((j) => j.fare.complete);
  const minFare = Math.min(...(complete.length ? complete : journeys).map((j) => j.fare.known));
  const minWalk = Math.min(...journeys.map((j) => j.walkM));
  const minTransfers = Math.min(...journeys.map((j) => j.transfers));
  const hasRide = (j: Journey) => j.modes.includes('ride');
  const transitCost = (j: Journey) => ((j.fare.known + 20) / (minFare + 20)) * (j.fare.complete ? 1 : 1.25);
  const nonRide = journeys.filter((j) => !hasRide(j)).map(transitCost);
  const rideCost = (nonRide.length ? Math.max(...nonRide) : 1) * 1.5;
  const wSum = weights.time + weights.cost + weights.walking + weights.transfers || 1;

  for (const j of journeys) {
    const s: ScoreBreakdown = {
      time: j.durationSec / minDur,
      cost: hasRide(j) ? rideCost : transitCost(j),
      walking: (j.walkM + 500) / (minWalk + 500),
      transfers: 1 + 0.5 * (j.transfers - minTransfers),
      total: 0,
    };
    s.total = (weights.time * s.time + weights.cost * s.cost + weights.walking * s.walking + weights.transfers * s.transfers) / wSum;
    j.score = s;
  }
}

const fareKey = (j: Journey) => (j.fare.complete ? j.fare.known : Number.POSITIVE_INFINITY);

export function sortJourneys(journeys: Journey[], key: SortKey): Journey[] {
  const by: Record<SortKey, (a: Journey, b: Journey) => number> = {
    recommended: (a, b) => (a.score?.total ?? 0) - (b.score?.total ?? 0),
    fastest: (a, b) => a.durationSec - b.durationSec,
    cheapest: (a, b) => fareKey(a) - fareKey(b) || a.fare.known - b.fare.known || a.durationSec - b.durationSec,
    'least-walking': (a, b) => a.walkM - b.walkM || a.durationSec - b.durationSec,
    'fewest-transfers': (a, b) => a.transfers - b.transfers || a.durationSec - b.durationSec,
  };
  return [...journeys].sort(by[key]);
}

/** Marks the best journey for each criterion. "Cheapest" is only claimed when every fare is known. */
export function tagJourneys(journeys: Journey[]): void {
  journeys.forEach((j) => (j.tags = []));
  if (!journeys.length) return;
  const mark = (tag: JourneyTag, list: Journey[]) => list[0]?.tags.push(tag);
  mark('recommended', sortJourneys(journeys, 'recommended'));
  mark('fastest', sortJourneys(journeys, 'fastest'));
  const complete = journeys.filter((j) => j.fare.complete && j.modes.some((m) => m !== 'walk'));
  if (complete.length) mark('cheapest', sortJourneys(complete, 'cheapest'));
  const nonWalk = journeys.filter((j) => j.modes.some((m) => m !== 'walk'));
  mark('least-walking', sortJourneys(nonWalk, 'least-walking'));
  mark('fewest-transfers', sortJourneys(nonWalk, 'fewest-transfers'));
}
