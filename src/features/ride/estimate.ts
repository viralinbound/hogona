import { haversineM, ROAD_DETOUR_FACTOR } from '../../utils/geo';

/**
 * Ride-hailing planning assumptions. Uber and Rapido give no public ETA or
 * fare API to this app, so ride legs use these clearly-labelled assumptions
 * for *planning only*; the real price and ETA appear in the provider's app.
 */
export const RIDE_ASSUMPTIONS = {
  avgSpeedKmh: 18,
  pickupWaitMin: 5,
  explanation:
    'Ride time assumes an average 18 km/h city speed over a road distance of 1.35 × straight-line distance, plus a 5-minute pickup wait. No live traffic, driver ETA or fare is used.',
};

export function rideEstimate(aLat: number, aLon: number, bLat: number, bLon: number) {
  const distanceM = haversineM(aLat, aLon, bLat, bLon) * ROAD_DETOUR_FACTOR;
  return {
    distanceM,
    durationSec: distanceM / (RIDE_ASSUMPTIONS.avgSpeedKmh / 3.6),
    waitSec: RIDE_ASSUMPTIONS.pickupWaitMin * 60,
  };
}
