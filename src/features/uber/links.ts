import { appConfig } from '../../services/config';
import type { Place } from '../../types/journey';

/**
 * Builds Uber deep links following
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 * (checked 2026-10-22):
 *  - Universal link: https://m.uber.com/looking?pickup=<json>&drop[0]=<json>[&client_id=]
 *  - App link:       uber://?action=setPickup&pickup[latitude]=..&dropoff[latitude]=..
 * The link only pre-fills Uber; Uber shows the real fare and handles booking.
 */
export function uberLinks(pickup: Place, drop: Place): { universal: string; app: string } {
  const clientId = appConfig.uberClientId;
  const loc = (p: Place) =>
    encodeURIComponent(JSON.stringify({ latitude: p.lat, longitude: p.lon, addressLine1: p.name, addressLine2: p.subtitle ?? 'Bengaluru' }));
  const universal =
    `https://m.uber.com/looking?pickup=${loc(pickup)}&drop%5B0%5D=${loc(drop)}` + (clientId ? `&client_id=${encodeURIComponent(clientId)}` : '');

  const q = (k: string, v: string | number) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
  const app =
    'uber://?' +
    [
      q('action', 'setPickup'),
      q('pickup[latitude]', pickup.lat),
      q('pickup[longitude]', pickup.lon),
      q('pickup[nickname]', pickup.name),
      q('dropoff[latitude]', drop.lat),
      q('dropoff[longitude]', drop.lon),
      q('dropoff[nickname]', drop.name),
      ...(clientId ? [q('client_id', clientId)] : []),
    ].join('&');
  return { universal, app };
}
