import type { FareInfo, JourneyFare, Leg } from '../types/journey';
import type { FareSlab, FareTables } from '../types/transport';

export function slabFare(distanceKm: number, slabs: FareSlab[]): number | null {
  for (const s of slabs) if (s.uptoKm === null || distanceKm <= s.uptoKm) return s.fare;
  return null;
}

export function metroFare(distanceM: number, tables: FareTables): FareInfo {
  const km = distanceM / 1000;
  const amount = slabFare(km, tables.metro.slabs);
  return {
    amount,
    basis: amount === null ? 'unknown' : 'slab-estimate',
    label:
      amount === null
        ? 'Metro fare not available'
        : `Token/QR fare for ${km.toFixed(1)} km from BMRCL slab table (from ${tables.metro.effectiveFrom}). Smart card and QR discounts may apply.`,
  };
}

export function busFare(
  distanceM: number,
  tables: FareTables,
  opts: { ac: boolean; shakti: boolean },
): FareInfo {
  if (opts.shakti && !opts.ac)
    return { amount: 0, basis: 'stage-estimate', label: 'Free under the Shakti scheme (non-AC BMTC, women resident in Karnataka).' };
  if (opts.ac) return { amount: null, basis: 'unknown', label: 'AC (Vajra/Vayu Vajra) fares are not bundled. Check with the conductor or Namma BMTC app.' };
  const km = distanceM / 1000;
  if (km > tables.bmtc.ordinaryVerifiedUptoKm)
    return {
      amount: null,
      basis: 'unknown',
      label: `No verified BMTC fare for ${km.toFixed(1)} km. Check with the conductor or Namma BMTC app.`,
    };
  const amount = slabFare(km, tables.bmtc.ordinaryStages);
  return {
    amount,
    basis: amount === null ? 'unknown' : 'stage-estimate',
    label: amount === null ? 'BMTC fare not available' : `Ordinary BMTC stage fare for ${km.toFixed(1)} km (from ${tables.bmtc.effectiveFrom}).`,
  };
}

/** Returns a published fare for a bus leg (e.g. from a GTFS fare matrix), or null. */
export type BusFareLookup = (leg: Leg) => number | null;

/**
 * Assigns a fare to each paid leg and returns the journey total. Consecutive
 * metro legs joined by an interchange share one ticket, priced on the total
 * metro distance. Ride-hailing fares are never estimated here.
 */
export function applyFares(legs: Leg[], tables: FareTables, shakti: boolean, busLookup?: BusFareLookup): JourneyFare {
  let known = 0;
  const unknownParts: string[] = [];

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.mode === 'metro') {
      // Collect metro legs linked by interchanges into one ticket.
      const group = [leg];
      let j = i + 1;
      while (j + 1 < legs.length && legs[j].interchange && legs[j + 1].mode === 'metro') {
        group.push(legs[j + 1]);
        j += 2;
      }
      const fare = metroFare(
        group.reduce((n, l) => n + l.distanceM, 0),
        tables,
      );
      group.forEach((l, k) => (l.fare = k === 0 ? fare : { amount: 0, basis: fare.basis, label: 'Included in the metro ticket from your first station.' }));
      if (fare.amount === null) unknownParts.push('metro');
      else known += fare.amount;
      i = j - 1;
    } else if (leg.mode === 'bus' && leg.route?.operator === 'KSRTC') {
      leg.fare = { amount: null, basis: 'in-app', label: 'KSRTC fare is shown when you book on ksrtc.in or the KSRTC app.' };
      unknownParts.push('KSRTC');
    } else if (leg.mode === 'bus') {
      const published = busLookup?.(leg) ?? null;
      leg.fare =
        published !== null && !(shakti && !leg.route?.ac)
          ? { amount: published, basis: 'stage-estimate', label: `BMTC fare ₹${published} from the Namma BMTC fare table (community data). Pay the conductor or in the Namma BMTC app.` }
          : busFare(leg.distanceM, tables, { ac: leg.route?.ac ?? false, shakti });
      if (leg.fare.amount === null) unknownParts.push(`bus ${leg.route?.ref ?? ''}`.trim());
      else known += leg.fare.amount;
    } else if (leg.mode === 'train') {
      leg.fare = { amount: null, basis: 'in-app', label: 'Train fare depends on the train and class — shown when you search or book.' };
      unknownParts.push('train');
    } else if (leg.mode === 'ride') {
      leg.fare = { amount: null, basis: 'in-app', label: 'Fare shown in the ride app (Uber, Ola, Rapido…) before you confirm.' };
      unknownParts.push('ride');
    }
  }
  return { known, complete: unknownParts.length === 0, unknownParts };
}
