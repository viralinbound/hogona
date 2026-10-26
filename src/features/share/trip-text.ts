import type { Journey, Leg } from '../../types/journey';
import { formatClock } from '../../utils/format';

function legLine(l: Leg): string {
  switch (l.mode) {
    case 'walk':
      return `Walk to ${l.to.name}`;
    case 'metro':
      return `Metro ${l.line?.name ?? ''}: ${l.from.name} → ${l.to.name}`;
    case 'bus':
      return `${l.route?.operator === 'KSRTC' ? 'KSRTC bus' : 'BMTC bus'} ${l.route?.ref ?? l.route?.name ?? ''}: ${l.from.name} → ${l.to.name}`;
    case 'train':
      return `Train: ${l.from.name} → ${l.to.name}`;
    case 'ride':
      return `Cab/auto: ${l.from.name} → ${l.to.name}`;
  }
}

/**
 * Plain-text trip summary for WhatsApp/SMS, so someone can follow along.
 * Nothing is uploaded: the system share sheet sends it from the user's own app.
 */
export function tripShareText(j: Journey): string {
  const dest = j.legs[j.legs.length - 1].to;
  // Interchange walks inside a metro station are noise for the reader.
  const steps = j.legs.filter((l) => !l.interchange).map((l, i) => `${i + 1}. ${legLine(l)}`);
  return [
    `I'm on my way to ${dest.name}.`,
    `Leaving about ${formatClock(j.departAt)}, expected around ${formatClock(j.arriveAt)} (planned, not live).`,
    '',
    ...steps,
    '',
    `Destination: https://www.google.com/maps/search/?api=1&query=${dest.lat.toFixed(5)},${dest.lon.toFixed(5)}`,
    'Sent from Hogona',
  ].join('\n');
}
