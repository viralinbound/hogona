import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import type { MapLine, MapMarker } from '../components/map-types';
import TransitMap from '../components/MapView';
import { Eyebrow, Figure, TextAction, Toggle, useAppTheme } from '../components/ui';
import { FONTS } from '../constants/theme';
import { useHandoff } from '../features/handoff/useHandoff';
import { isPeak } from '../features/metro/service';
import { useLayout } from '../hooks/useLayout';
import { stationById, transportData } from '../services/transport-data';
import { useAppState } from '../state/AppState';

const { planning } = transportData.metroService;

/** Estimated minutes from a line's first station (track distance + dwell), not a timetable. */
function minutesFromStart(chainageM: number, index: number) {
  return Math.round((chainageM / 1000 / planning.metroSpeedKmh) * 60 + (index * planning.metroDwellSec) / 60);
}

export default function MetroTimingsScreen() {
  const t = useAppTheme();
  const { wide, gutter } = useLayout();
  const { setOrigin, setDestination } = useAppState();
  const handoff = useHandoff();
  const [lineId, setLineId] = useState(transportData.lines[0].id);
  const [snack, setSnack] = useState('');
  const line = transportData.lines.find((l) => l.id === lineId)!;
  const service = transportData.metroService.lines[lineId];
  const stations = line.stations.map((id) => stationById.get(id)!);
  const first = stations[0];
  const last = stations[stations.length - 1];
  const peakNow = isPeak(new Date());

  const lines: MapLine[] = useMemo(() => [{ id: line.id, points: line.segments.flatMap((s, i) => (i ? s.slice(1) : s)), colour: line.colour, width: 5 }], [line]);
  const markers: MapMarker[] = useMemo(
    () => stations.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, colour: line.colour, title: s.name, size: 'station' as const })),
    [stations, line],
  );

  const header = (
    <View style={{ gap: 12 }}>
      <View style={styles.tabs}>
        {transportData.lines.map((l) => (
          <Toggle key={l.id} label={l.name.replace(' Line', '')} selected={l.id === lineId} onPress={() => setLineId(l.id)} />
        ))}
      </View>
      <View style={[styles.swatch, { backgroundColor: line.colour }]} />
      <Text style={[styles.big, { color: t.ink.ink }]}>{line.name}</Text>
      <Text style={[styles.note, { color: t.ink.muted }]}>
        {first.name} ↔ {last.name} · {stations.length} stations · {(line.trackLengthM / 1000).toFixed(1)} km · about{' '}
        {minutesFromStart(last.chainageM, stations.length - 1)} min end to end
      </Text>

      <View style={[styles.card, { backgroundColor: t.ink.card, borderColor: t.ink.rule }]}>
        <Eyebrow>Service hours</Eyebrow>
        {service?.hours ? (
          <View style={styles.hoursGrid}>
            <Hours label="First train Mon–Sat" value={service.hours.weekdayFirst} />
            <Hours label="First train Sunday" value={service.hours.sundayFirst} />
            {service.hours.lastFromFirstStation && <Hours label={`Last from ${first.name}`} value={service.hours.lastFromFirstStation} />}
            {service.hours.lastFromLastStation && <Hours label={`Last from ${last.name}`} value={service.hours.lastFromLastStation} />}
          </View>
        ) : (
          <Text style={[styles.note, { color: t.ink.warn }]}>Not verified. BMRCL’s timings page gave no timetable when we checked, so we don’t show guessed times.</Text>
        )}
        <Eyebrow style={{ marginTop: 6 }}>How often</Eyebrow>
        {service?.headwayMin ? (
          <Text style={[styles.note, { color: t.ink.ink }]}>
            Every <Text style={styles.strong}>{service.headwayMin.peak} min</Text> at peak, every <Text style={styles.strong}>{service.headwayMin.offPeak} min</Text> off-peak.
            {'  '}Right now: {peakNow ? 'peak' : 'off-peak'}.
          </Text>
        ) : (
          <Text style={[styles.note, { color: t.ink.warn }]}>Not published in a source we could verify.</Text>
        )}
        <Text style={[styles.note, { color: t.ink.faint }]}>{service?.note}</Text>
        <TextAction label="Official BMRCL timings" onPress={async () => setSnack(await handoff.openWebsite(transportData.metroService.officialTimingsUrl, 'BMRCL metro timings'))} />
      </View>

      {!wide && (
        <TransitMap lines={lines} markers={markers} fit={stations.map((s) => [s.lat, s.lon] as [number, number])} style={[styles.map, { borderColor: t.ink.rule }]} />
      )}

      <View style={styles.listHead}>
        <Eyebrow>Stations</Eyebrow>
        <Eyebrow>Min from {first.name.split(' ')[0]} (est.)</Eyebrow>
      </View>
    </View>
  );

  return (
    <>
      <View style={[styles.screen, { backgroundColor: t.ink.paper }, wide && styles.screenWide, { paddingHorizontal: gutter }]}>
        {wide && (
          <TransitMap lines={lines} markers={markers} fit={stations.map((s) => [s.lat, s.lon] as [number, number])} style={[styles.mapWide, { borderColor: t.ink.rule }]} />
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
          {header}
          {stations.map((s, i) => (
            <View key={s.id} style={[styles.row, { borderBottomColor: t.ink.rule }]}>
              <View style={[styles.dot, { borderColor: line.colour, backgroundColor: i === 0 || i === stations.length - 1 ? line.colour : t.ink.card }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: t.ink.ink }]} numberOfLines={1}>
                  {s.name}
                </Text>
                {transportData.transfers.some((x) => x.from === s.id || x.to === s.id) && <Text style={[styles.change, { color: t.ink.accent }]}>Change here for another line</Text>}
              </View>
              <TextAction
                label="Go"
                tone="muted"
                onPress={() => {
                  setDestination({ name: s.name, lat: s.lat, lon: s.lon, kind: 'metro', refId: s.id, subtitle: line.name });
                  router.push('/');
                }}
              />
              <TextAction
                label="From"
                tone="muted"
                onPress={() => {
                  setOrigin({ name: s.name, lat: s.lat, lon: s.lon, kind: 'metro', refId: s.id, subtitle: line.name });
                  router.push('/');
                }}
              />
              <Figure size={13} colour={t.ink.muted} style={{ width: 34, textAlign: 'right' }}>
                {minutesFromStart(s.chainageM, i)}
              </Figure>
            </View>
          ))}
          <Text style={[styles.note, { color: t.ink.faint, marginTop: 12 }]}>
            Minutes are estimates from track distance at {planning.metroSpeedKmh} km/h plus {planning.metroDwellSec} s per stop — not a timetable.
          </Text>
        </ScrollView>
      </View>
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')}>
        {snack}
      </Snackbar>
    </>
  );
}

function Hours({ label, value }: { label: string; value: string }) {
  const t = useAppTheme();
  return (
    <View style={styles.hours}>
      <Figure size={22}>{value}</Figure>
      <Text style={[styles.note, { color: t.ink.muted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 12, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  screenWide: { flexDirection: 'row', gap: 88, paddingBottom: 20 },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 40, height: 6, borderRadius: 3, marginTop: 6 },
  big: { fontFamily: FONTS.serif, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
  strong: { fontFamily: FONTS.sansSemi },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  hours: { width: '50%', gap: 2, paddingRight: 8 },
  map: { height: 240, borderRadius: 18, borderWidth: 1 },
  mapWide: { flex: 1, borderRadius: 18, borderWidth: 1 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth * 2, minHeight: 48 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  name: { fontFamily: FONTS.sansMedium, fontSize: 14.5 },
  change: { fontFamily: FONTS.sansMedium, fontSize: 11.5, marginTop: 1 },
});
