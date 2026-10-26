import { Platform } from 'react-native';
import operators from '../../data/operators.json';
import type { Place } from '../../types/journey';

/**
 * Ride-hailing apps other than Uber, driven entirely by `rideApps` in
 * src/data/operators.json. Add an app there (with verified package ids and,
 * only if officially documented, a pre-fill link template) — no code change.
 */
export interface RideApp {
  id: string;
  name: string;
  androidPackage: string;
  playStore: string;
  iosAppStore: string | null;
  website: string | null;
  /**
   * Officially documented link that pre-fills the trip, with {plat} {plon}
   * {dlat} {dlon} {pname} {dname} placeholders; null when none is documented.
   */
  prefillLink: string | null;
  note: string;
  sources: string[];
}

export const RIDE_APPS: RideApp[] = (operators as unknown as { rideApps: RideApp[] }).rideApps;

export function rideApp(id: string): RideApp | undefined {
  return RIDE_APPS.find((a) => a.id === id);
}

function fill(template: string, pickup: Place, drop: Place): string {
  const v: Record<string, string> = {
    plat: String(pickup.lat),
    plon: String(pickup.lon),
    dlat: String(drop.lat),
    dlon: String(drop.lon),
    pname: encodeURIComponent(pickup.name),
    dname: encodeURIComponent(drop.name),
  };
  return template.replace(/\{(plat|plon|dlat|dlon|pname|dname)\}/g, (_, k: string) => v[k]);
}

/**
 * Targets to try, best first: documented pre-fill link → installed app →
 * store page → website. On web only https links can open.
 */
export function rideAppLinks(app: RideApp, pickup: Place, drop: Place): string[] {
  const prefill = app.prefillLink ? [fill(app.prefillLink, pickup, drop)] : [];
  if (Platform.OS === 'android') return [...prefill, `android-package:${app.androidPackage}`, `market://details?id=${app.androidPackage}`, app.playStore];
  if (Platform.OS === 'ios') return [...prefill, ...(app.iosAppStore ? [app.iosAppStore] : []), ...(app.website ? [app.website] : [])];
  return [...prefill.filter((u) => u.startsWith('https://')), ...(app.website ? [app.website] : []), app.playStore];
}

export function tripText(pickup: Place, drop: Place): string {
  return `Pickup: ${pickup.name} (${pickup.lat.toFixed(5)}, ${pickup.lon.toFixed(5)})\nDrop: ${drop.name} (${drop.lat.toFixed(5)}, ${drop.lon.toFixed(5)})`;
}
