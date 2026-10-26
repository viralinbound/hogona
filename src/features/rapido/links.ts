import { operatorAppLinks } from '../external-apps/links';
import type { Place } from '../../types/journey';

/**
 * Rapido publishes no deep link for pre-filled pickup/drop (checked 2026-10-22),
 * so this only opens the Rapido app (or its store page / website). The user
 * enters pickup and drop in Rapido; we give them the text to paste.
 */
export const rapidoLinks = () => operatorAppLinks('rapido');

export function rapidoTripText(pickup: Place, drop: Place): string {
  return `Pickup: ${pickup.name} (${pickup.lat.toFixed(5)}, ${pickup.lon.toFixed(5)})\nDrop: ${drop.name} (${drop.lat.toFixed(5)}, ${drop.lon.toFixed(5)})`;
}
