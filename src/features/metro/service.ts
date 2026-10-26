import type { MetroLine, MetroService, MetroStation } from '../../types/transport';

export type OperatingState = 'open' | 'closed' | 'unknown';

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * BMRCL's weekday off-peak windows (used for its fare discount) are
 * open–08:00, 12:00–16:00 and 21:00–close, so peak is 08–12 and 16–21.
 */
export function isPeak(date: Date): boolean {
  if (date.getDay() === 0) return false;
  const h = date.getHours();
  return (h >= 8 && h < 12) || (h >= 16 && h < 21);
}

/** Expected wait at a metro platform, and how that number was obtained. */
export function metroWait(lineId: string, date: Date, service: MetroService): { sec: number; basis: 'estimated' | 'assumed'; note: string } {
  const headway = service.lines[lineId]?.headwayMin;
  if (headway) {
    const h = isPeak(date) ? headway.peak : headway.offPeak;
    return { sec: (h / 2) * 60, basis: 'estimated', note: `Half the reported ${h}-min ${isPeak(date) ? 'peak' : 'off-peak'} frequency` };
  }
  const assumed = service.planning.assumedWaitMinUnknownHeadway;
  return { sec: assumed * 60, basis: 'assumed', note: `Assumed ${assumed}-min average wait (no published frequency)` };
}

/**
 * Whether a train is scheduled at this station and time. Only lines with
 * published hours can return 'closed'; others return 'unknown' late at night.
 */
export function operatingState(
  line: MetroLine,
  station: MetroStation,
  towardsEnd: boolean,
  date: Date,
  service: MetroService,
): OperatingState {
  const info = service.lines[line.id];
  const mins = date.getHours() * 60 + date.getMinutes();
  if (!info?.hours) return mins >= 23 * 60 || mins < 5 * 60 ? 'unknown' : 'open';

  const first = minutesOf(date.getDay() === 0 ? info.hours.sundayFirst : info.hours.weekdayFirst);
  const last = lastTrainMinutes(line, station, towardsEnd, service);
  if (last == null) return 'unknown';
  return mins >= first && mins <= last ? 'open' : 'closed';
}

/**
 * Estimated minutes after midnight when the last train passes this station in
 * this direction: the published last departure from the terminal plus the run
 * time at the planning speed. null when the line has no published hours.
 */
export function lastTrainMinutes(line: MetroLine, station: MetroStation, towardsEnd: boolean, service: MetroService): number | null {
  const hours = service.lines[line.id]?.hours;
  const lastFromStart = hours && (towardsEnd ? hours.lastFromFirstStation : hours.lastFromLastStation);
  if (!lastFromStart) return null;
  const fromTerminalM = towardsEnd ? station.chainageM : line.trackLengthM - station.chainageM;
  return minutesOf(lastFromStart) + fromTerminalM / 1000 / (service.planning.metroSpeedKmh / 60);
}

/** Published frequency for a line at this time, or null when none is published. */
export function headwayAt(lineId: string, date: Date, service: MetroService): number | null {
  const h = service.lines[lineId]?.headwayMin;
  return h ? (isPeak(date) ? h.peak : h.offPeak) : null;
}

export const clockOfMinutes = (mins: number) => {
  const m = Math.floor(mins) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
