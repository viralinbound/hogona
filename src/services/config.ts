/**
 * Public, client-side configuration. Everything here ships inside the app
 * bundle and must be treated as public — never put secrets in EXPO_PUBLIC_*.
 * Set a value to an empty string to disable that online service.
 *
 * Expo only inlines `process.env.EXPO_PUBLIC_*` when accessed statically, so
 * each variable is referenced by its full name below.
 */
const pick = (v: string | undefined, fallback: string) => (v === undefined ? fallback : v);

export const appConfig = {
  /** Photon-compatible geocoder base URL (OpenStreetMap data). */
  geocoderUrl: pick(process.env.EXPO_PUBLIC_GEOCODER_URL, 'https://photon.komoot.io'),
  /** OSRM-compatible routing server for walking geometry ('' disables). */
  walkRoutingUrl: pick(process.env.EXPO_PUBLIC_WALK_ROUTING_URL, 'https://routing.openstreetmap.de/routed-foot'),
  /** OSRM-compatible routing server for driving geometry ('' disables). */
  driveRoutingUrl: pick(process.env.EXPO_PUBLIC_DRIVE_ROUTING_URL, 'https://routing.openstreetmap.de/routed-car'),
  /** Raster tiles for the web map. */
  tileUrl: pick(process.env.EXPO_PUBLIC_MAP_TILE_URL, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  /** Open-Meteo-compatible forecast API for the rain notice ('' disables). Free tier is non-commercial. */
  weatherUrl: pick(process.env.EXPO_PUBLIC_WEATHER_URL, 'https://api.open-meteo.com'),
  /** Optional Uber client id (public) added to Uber deep links for attribution. */
  uberClientId: pick(process.env.EXPO_PUBLIC_UBER_CLIENT_ID, ''),
};
