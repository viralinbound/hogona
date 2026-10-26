import { DEFAULT_PREFERENCES, type PlannerPreferences } from '../types/journey';
import { readJson, STORAGE_KEYS, writeJson } from './store';

export async function loadPreferences(): Promise<PlannerPreferences> {
  const stored = await readJson<Partial<PlannerPreferences>>(STORAGE_KEYS.preferences, {});
  // Merge so preferences added in later versions get their defaults.
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    modes: { ...DEFAULT_PREFERENCES.modes, ...stored.modes },
    weights: { ...DEFAULT_PREFERENCES.weights, ...stored.weights },
  };
}

export const savePreferences = (p: PlannerPreferences) => writeJson(STORAGE_KEYS.preferences, p);
