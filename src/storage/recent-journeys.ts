import type { Place } from '../types/journey';
import { readJson, STORAGE_KEYS, writeJson } from './store';

export interface RecentSearch {
  origin: Place;
  destination: Place;
  searchedAt: number;
}

/** Something the user did that left this app (e.g. opened Uber). Never a booking record. */
export interface ActivityEntry {
  id: string;
  at: number;
  kind: 'uber' | 'rapido' | 'whatsapp' | 'maps' | 'website' | 'app';
  title: string;
  detail: string;
}

const MAX_RECENTS = 12;
const MAX_ACTIVITY = 50;

export const loadRecents = () => readJson<RecentSearch[]>(STORAGE_KEYS.recentJourneys, []);

export function addRecent(list: RecentSearch[], origin: Place, destination: Place): RecentSearch[] {
  const key = (p: Place) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
  const next = [
    { origin, destination, searchedAt: Date.now() },
    ...list.filter((r) => !(key(r.origin) === key(origin) && key(r.destination) === key(destination))),
  ].slice(0, MAX_RECENTS);
  void writeJson(STORAGE_KEYS.recentJourneys, next);
  return next;
}

export const saveRecents = (list: RecentSearch[]) => writeJson(STORAGE_KEYS.recentJourneys, list);

export const loadActivity = () => readJson<ActivityEntry[]>(STORAGE_KEYS.activity, []);

export function addActivity(list: ActivityEntry[], entry: Omit<ActivityEntry, 'id' | 'at'>): ActivityEntry[] {
  const next = [{ ...entry, id: `${Date.now()}`, at: Date.now() }, ...list].slice(0, MAX_ACTIVITY);
  void writeJson(STORAGE_KEYS.activity, next);
  return next;
}
