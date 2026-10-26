import type { Journey, Leg, Place } from '../../types/journey';

export type BookingStepKind = 'metro' | 'bus' | 'ksrtc' | 'ride' | 'train';

/** One thing the user has to book (or pay for) to make the whole journey. */
export interface BookingStep {
  kind: BookingStepKind;
  from: Place;
  to: Place;
  /** Leg index in the journey where this step starts. */
  legIndex: number;
  title: string;
  detail: string;
}

/**
 * Turns a journey into the bookings it needs, in travel order. Metro legs
 * joined by an in-station interchange are one ticket, so they become one step.
 * Walking needs no booking and is skipped.
 */
export function bookingSteps(journey: Journey): BookingStep[] {
  const steps: BookingStep[] = [];
  const legs = journey.legs;
  for (let i = 0; i < legs.length; i++) {
    const leg: Leg = legs[i];
    if (leg.mode === 'metro') {
      let end = leg;
      let j = i + 1;
      while (j + 1 < legs.length && legs[j].interchange && legs[j + 1].mode === 'metro') {
        end = legs[j + 1];
        j += 2;
      }
      const lines = [leg, ...legs.slice(i + 1, j).filter((l) => l.mode === 'metro')].map((l) => l.line?.name.replace(' Line', '')).join(' → ');
      steps.push({
        kind: 'metro',
        from: leg.from,
        to: end.to,
        legIndex: i,
        title: `Metro ticket: ${leg.from.name} → ${end.to.name}`,
        detail: `One QR ticket covers ${lines}. Buy it in the Namma Metro app or on the official WhatsApp chat.`,
      });
      i = j - 1;
    } else if (leg.mode === 'bus' && leg.route?.operator === 'KSRTC') {
      steps.push({
        kind: 'ksrtc',
        from: leg.from,
        to: leg.to,
        legIndex: i,
        title: `KSRTC bus: ${leg.from.name} → ${leg.to.name}`,
        detail: 'Book this intercity seat on ksrtc.in or the KSRTC AWATAR app; the fare is shown there.',
      });
    } else if (leg.mode === 'bus') {
      steps.push({
        kind: 'bus',
        from: leg.from,
        to: leg.to,
        legIndex: i,
        title: `Bus ${leg.route?.ref ?? ''}: ${leg.from.name} → ${leg.to.name}`.replace('Bus :', 'Bus:'),
        detail: 'BMTC tickets are bought on the bus from the conductor (cash or UPI), or in the Namma BMTC app.',
      });
    } else if (leg.mode === 'train') {
      steps.push({
        kind: 'train',
        from: leg.from,
        to: leg.to,
        legIndex: i,
        title: `Train: ${leg.from.name} → ${leg.to.name}`,
        detail: 'See the trains for your date with times and fares, then book on that page or in the IRCTC app.',
      });
    } else if (leg.mode === 'ride') {
      steps.push({
        kind: 'ride',
        from: leg.from,
        to: leg.to,
        legIndex: i,
        title: `Ride: ${leg.from.name} → ${leg.to.name}`,
        detail: 'Uber and Ola open with pickup and drop filled in; Rapido, Namma Yatri, inDrive and Quick Ride open with the trip copied. Compare fares there and confirm in one.',
      });
    }
  }
  return steps;
}
