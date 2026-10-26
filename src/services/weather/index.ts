import { appConfig } from '../config';

export interface RainNotice {
  /** Local hour the rain is expected, as HH:00. */
  time: string;
  probability: number;
  /** The rainy hour has already started. */
  current: boolean;
}

/** Notify from this chance of rain, or any hour with at least 1 mm forecast. */
const MIN_PROBABILITY = 60;

/**
 * Rain expected in the next 3 hours at a point, from the Open-Meteo forecast.
 * Returns null when no rain is likely, the service is off, or the request fails.
 */
export async function rainSoon(lat: number, lon: number, signal?: AbortSignal): Promise<RainNotice | null> {
  if (!appConfig.weatherUrl) return null;
  const url = `${appConfig.weatherUrl}/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=precipitation_probability,precipitation&forecast_hours=3&timezone=Asia%2FKolkata`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: { time: string[]; precipitation_probability: (number | null)[]; precipitation: (number | null)[] } };
    const h = data.hourly;
    if (!h) return null;
    for (let i = 0; i < h.time.length; i++) {
      const p = h.precipitation_probability[i] ?? 0;
      if (p >= MIN_PROBABILITY || (h.precipitation[i] ?? 0) >= 1) return { time: h.time[i].slice(11, 16), probability: p, current: i === 0 };
    }
    return null;
  } catch {
    return null;
  }
}
