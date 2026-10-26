import type { Place } from '../types/journey';
import { readJson, STORAGE_KEYS, writeJson } from './store';

export interface Favourite {
  id: string;
  label: string;
  place: Place;
  createdAt: number;
}

export const loadFavourites = () => readJson<Favourite[]>(STORAGE_KEYS.favourites, []);
export const saveFavourites = (list: Favourite[]) => writeJson(STORAGE_KEYS.favourites, list);

export function samePlace(a: Place, b: Place): boolean {
  if (a.refId && b.refId) return a.refId === b.refId;
  return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
}
