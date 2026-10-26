import AsyncStorage from '@react-native-async-storage/async-storage';

/** All keys this app writes, so "Erase local data" can remove exactly these. */
export const STORAGE_KEYS = {
  preferences: 'nr:preferences:v1',
  favourites: 'nr:favourites:v1',
  recentJourneys: 'nr:recent-journeys:v1',
  activity: 'nr:activity:v1',
  commute: 'nr:commute:v1',
} as const;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the app keeps working in memory.
  }
}

export async function eraseAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}
