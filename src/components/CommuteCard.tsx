import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../constants/theme';
import { clockOfMinutes, headwayAt, lastTrainMinutes } from '../features/metro/service';
import { useT } from '../i18n';
import { lineById, nearbyStations, transportData } from '../services/transport-data';
import { useAppState } from '../state/AppState';
import type { CommuteKind } from '../storage/commute';
import type { Place } from '../types/journey';
import { LineSwatch } from './ModeTag';
import { PillButton, SectionHead, TextAction, useAppTheme } from './ui';

/** Nearest metro station to a place, within a walkable 1.5 km. */
const nearestStation = (p: Place) => nearbyStations(p.lat, p.lon, 1500)[0]?.item;

/**
 * Home and work, set once. Before 2 pm "Go to work" leads, after it "Go home".
 * Shows the nearest station's published frequency and estimated last train,
 * or says plainly that the line's timings aren't verified.
 */
export function CommuteCard({ onPlan }: { onPlan: (from: Place, to: Place) => void }) {
  const t = useAppTheme();
  const tr = useT();
  const { commute, setCommutePlace } = useAppState();
  const { home, work } = commute;
  const now = new Date();
  const morning = now.getHours() < 14;
  const trips: { label: string; from: Place; to: Place }[] =
    home && work
      ? [
          { label: tr('Go to work'), from: home, to: work },
          { label: tr('Go home'), from: work, to: home },
        ]
      : [];
  if (!morning) trips.reverse();
  const next = trips[0];

  const metro = (() => {
    if (!next) return null;
    const st = nearestStation(next.from);
    if (!st) return null;
    const line = lineById.get(st.line);
    if (!line) return null;
    const headway = headwayAt(line.id, now, transportData.metroService);
    // Direction is known only when the other end is near the same line.
    const end = nearestStation(next.to);
    const last =
      end && end.line === st.line && end.id !== st.id
        ? lastTrainMinutes(line, st, line.stations.indexOf(end.id) > line.stations.indexOf(st.id), transportData.metroService)
        : null;
    return { st, line, headway, last, verified: !!transportData.metroService.lines[line.id]?.hours };
  })();

  const pick = (kind: CommuteKind) => router.push({ pathname: '/place-search', params: { field: kind } });

  return (
    <View style={styles.block}>
      <SectionHead title={tr('Your commute')} />
      {!home || !work ? (
        <Text style={[styles.note, { color: t.ink.muted }]}>{tr('Set your home and work once, then plan the daily trip in one tap.')}</Text>
      ) : null}
      {(['home', 'work'] as const).map((kind) => {
        const place = commute[kind];
        return (
          <View key={kind} style={[styles.row, { borderBottomColor: t.ink.rule }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kind, { color: t.ink.faint }]}>{tr(kind === 'home' ? 'Home' : 'Work').toUpperCase()}</Text>
              <Text style={[styles.place, { color: place ? t.ink.ink : t.ink.faint }]} numberOfLines={1}>
                {place ? place.name : tr('Not set')}
              </Text>
            </View>
            <TextAction label={place ? tr('Change') : tr(kind === 'home' ? 'Set home' : 'Set work')} tone={place ? 'muted' : 'accent'} onPress={() => pick(kind)} />
            {place && <TextAction label={tr('Remove')} tone="muted" onPress={() => setCommutePlace(kind, null)} />}
          </View>
        );
      })}
      {next && (
        <View style={styles.actions}>
          {trips.map((trip, i) => (
            <PillButton key={trip.label} label={trip.label} variant={i === 0 ? undefined : 'outline'} onPress={() => onPlan(trip.from, trip.to)} />
          ))}
        </View>
      )}
      {metro && (
        <View style={styles.metro}>
          <LineSwatch colour={metro.line.colour} width={24} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.note, { color: t.ink.ink }]}>{tr('Nearest metro: {station}', { station: metro.st.name })}</Text>
            <Text style={[styles.note, { color: t.ink.muted }]}>
              {metro.verified
                ? [metro.headway ? tr('Trains about every {n} min', { n: metro.headway }) : null, metro.last != null ? tr('Last train about {time}', { time: clockOfMinutes(metro.last) }) : null]
                    .filter(Boolean)
                    .join(' · ')
                : tr('Timings for this line are not verified yet')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  kind: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.4 },
  place: { fontFamily: FONTS.serif, fontSize: 21, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  metro: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
});
