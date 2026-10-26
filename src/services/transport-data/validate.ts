import type { TransportData } from '../../types/transport';
import { inBengaluru } from '../../utils/geo';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Checks the bundled datasets for structural problems. Errors mean the data
 * cannot be trusted for routing; warnings are surfaced in Settings → Data.
 */
export function validateTransportData(d: TransportData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });

  const stationIds = new Set<string>();
  for (const s of d.stations) {
    if (stationIds.has(s.id)) err(`Duplicate metro station id ${s.id}`);
    stationIds.add(s.id);
    if (!s.name) err(`Metro station ${s.id} has no name`);
    if (!inBengaluru(s.lat, s.lon)) err(`Metro station ${s.id} is outside Bengaluru`);
    if (s.trackOffsetM > 200) warn(`Metro station ${s.name} is ${s.trackOffsetM} m from mapped track`);
  }

  for (const l of d.lines) {
    if (l.stations.length < 2) err(`Metro line ${l.id} has fewer than 2 stations`);
    if (l.segments.length !== l.stations.length - 1) err(`Metro line ${l.id}: segment count does not match stations`);
    let prev = -1;
    for (const id of l.stations) {
      const s = d.stations.find((x) => x.id === id);
      if (!s) {
        err(`Metro line ${l.id} references unknown station ${id}`);
        continue;
      }
      if (s.chainageM <= prev) err(`Metro line ${l.id}: chainage not increasing at ${id}`);
      prev = s.chainageM;
    }
  }

  for (const t of d.transfers) {
    if (!stationIds.has(t.from) || !stationIds.has(t.to)) err(`Interchange ${t.name} references unknown station`);
  }

  const stopIds = new Set<string>();
  for (const s of d.stops) {
    if (stopIds.has(s.id)) err(`Duplicate bus stop id ${s.id}`);
    stopIds.add(s.id);
    if (!inBengaluru(s.lat, s.lon)) warn(`Bus stop ${s.name} lies outside the Bengaluru service box`);
  }

  for (const r of d.routes) {
    if (r.stops.length < 2) err(`Bus route ${r.ref ?? r.id} has fewer than 2 stops`);
    for (const id of r.stops) if (!stopIds.has(id)) err(`Bus route ${r.ref ?? r.id} references unknown stop ${id}`);
  }

  const slabs = d.fares.metro.slabs;
  for (let i = 1; i < slabs.length; i++) {
    if (slabs[i].fare < slabs[i - 1].fare) err('Metro fare slabs are not non-decreasing');
    const a = slabs[i - 1].uptoKm;
    const b = slabs[i].uptoKm;
    if (a === null || (b !== null && b <= a)) err('Metro fare slab distances are not increasing');
  }
  if (slabs[slabs.length - 1]?.uptoKm !== null) warn('Metro fare table has no open-ended final slab');

  return issues;
}
