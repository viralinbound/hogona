import { planTrip } from '../algorithms/intercity';
import { buildNetwork } from '../algorithms/multimodal-router';
import { alightingStops } from '../features/alerts/useStopAlert';
import { clockOfMinutes, lastTrainMinutes } from '../features/metro/service';
import { tripShareText } from '../features/share/trip-text';
import { translate } from '../i18n/translate';
import { hi } from '../i18n/hi';
import { kn } from '../i18n/kn';
import { lineById, transportData } from '../services/transport-data';
import { DEFAULT_PREFERENCES, type Place } from '../types/journey';

const net = buildNetwork(transportData);
const yellow = lineById.get('yellow')!;
const station = (id: string) => transportData.stations.find((s) => s.id === id)!;
const first = station(yellow.stations[0]);
const last = station(yellow.stations[yellow.stations.length - 1]);
const asPlace = (s: typeof first): Place => ({ name: s.name, lat: s.lat, lon: s.lon, kind: 'metro', refId: s.id });

describe('last metro', () => {
  it('estimates the last train at the first station as the published last departure', () => {
    const m = lastTrainMinutes(yellow, first, true, transportData.metroService)!;
    expect(clockOfMinutes(m)).toBe(transportData.metroService.lines.yellow.hours!.lastFromFirstStation);
  });

  it('is null for lines without published hours', () => {
    const purple = lineById.get('purple')!;
    expect(lastTrainMinutes(purple, station(purple.stations[0]), true, transportData.metroService)).toBeNull();
  });

  it('warns on a late Yellow Line trip and not on a morning one', () => {
    const plan = (h: number, m: number) =>
      planTrip(net, { origin: asPlace(first), destination: asPlace(last), departAt: new Date(2026, 9, 21, h, m), prefs: { ...DEFAULT_PREFERENCES, modes: { metro: true, bus: false, ride: false } } });
    const late = plan(23, 30).journeys.find((j) => j.modes.includes('metro'));
    expect(late?.warnings.some((w) => w.startsWith('Last Yellow'))).toBe(true);
    const morning = plan(9, 0).journeys.find((j) => j.modes.includes('metro'));
    expect(morning?.warnings.some((w) => w.startsWith('Last '))).toBe(false);
  });
});

describe('stop alert and share', () => {
  const j = planTrip(net, { origin: asPlace(first), destination: asPlace(last), departAt: new Date(2026, 9, 21, 9, 0), prefs: DEFAULT_PREFERENCES }).journeys.find((x) => x.modes.includes('metro'))!;

  it('alerts at the end of each ride', () => {
    const stops = alightingStops(j);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1].name).toBe(last.name);
  });

  it('shares a readable summary with a map link and no app data', () => {
    const text = tripShareText(j);
    expect(text).toContain(last.name);
    expect(text).toMatch(/google\.com\/maps\/search\/\?api=1&query=\d+\.\d+,\d+\.\d+/);
    expect(text).toContain('planned, not live');
  });
});

describe('translations', () => {
  it('falls back to English and fills variables', () => {
    expect(translate('hi', 'Find journeys')).toBe('रास्ते ढूंढें');
    expect(translate('kn', 'No such string')).toBe('No such string');
    expect(translate('en', 'Leaving about {time}', { time: '09:30' })).toBe('Leaving about 09:30');
    expect(translate('kn', 'Trains about every {n} min', { n: 7 })).toContain('7');
  });

  it('Hindi and Kannada cover the same strings with the same placeholders', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(kn).sort());
    for (const [key, value] of [...Object.entries(hi), ...Object.entries(kn)]) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(value)).toEqual(vars(key));
    }
  });
});
