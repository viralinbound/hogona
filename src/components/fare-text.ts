import type { JourneyFare } from '../types/journey';
import { formatRupees } from '../utils/format';

/** Human text for a journey fare that never presents an unknown part as ₹0. */
export function fareText(f: JourneyFare, modes: string[]): { main: string; sub?: string } {
  const paid = modes.some((m) => m !== 'walk');
  if (!paid) return { main: 'Free', sub: 'Walking' };
  if (f.complete) return { main: formatRupees(f.known), sub: 'Estimate' };
  const parts = f.unknownParts.map((p) => (p === 'ride' ? 'ride fare in app' : p === 'train' || p === 'KSRTC' ? `${p} fare when booking` : `${p} fare not verified`));
  const unique = [...new Set(parts)];
  if (f.known > 0) return { main: `${formatRupees(f.known)} +`, sub: unique.join(' · ') };
  // Only ride legs are priced "in app"; an unverified bus fare is just unknown.
  const onlyRide = f.unknownParts.every((p) => p === 'ride');
  return { main: onlyRide ? 'Fare in app' : 'Not verified', sub: unique.join(' · ') };
}
