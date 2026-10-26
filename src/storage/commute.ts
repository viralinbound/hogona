import type { Place } from '../types/journey';
import { readJson, STORAGE_KEYS, writeJson } from './store';

export type CommuteKind = 'home' | 'work';
export type Commute = Partial<Record<CommuteKind, Place>>;

export const loadCommute = () => readJson<Commute>(STORAGE_KEYS.commute, {});
export const saveCommute = (c: Commute) => writeJson(STORAGE_KEYS.commute, c);
