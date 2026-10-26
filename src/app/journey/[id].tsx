import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { DataFreshnessLabel } from '../../components/DataFreshnessLabel';
import { fareText } from '../../components/fare-text';
import { JourneyTimeline } from '../../components/JourneyTimeline';
import type { MapLine, MapMarker } from '../../components/map-types';
import TransitMap from '../../components/MapView';
import { Eyebrow, Figure, PillButton, TextAction, useAppTheme } from '../../components/ui';
import { WhatsAppTicketDialog } from '../../components/WhatsAppTicketDialog';
import { FONTS, MODE_COLOURS } from '../../constants/theme';
import { railStation, trainSearchUrl } from '../../algorithms/rail';
import { useStopAlert } from '../../features/alerts/useStopAlert';
import { useHandoff } from '../../features/handoff/useHandoff';
import { tripShareText } from '../../features/share/trip-text';
import { useT } from '../../i18n';
import { RIDE_ASSUMPTIONS } from '../../features/ride/estimate';
import { routePath, type RoutedPath } from '../../services/maps/routing';
import { datasetManifest } from '../../services/transport-data';
import { useLayout } from '../../hooks/useLayout';
import { useAppState } from '../../state/AppState';
import type { Leg } from '../../types/journey';
import { formatClock, formatDistance, formatDuration } from '../../utils/format';

function splitDuration(sec: number) {
  const min = Math.max(1, Math.round(sec / 60));
  return { h: Math.floor(min / 60), m: min % 60 };
}

export default function JourneyScreen() {
  const t = useAppTheme();
  const { wide, gutter } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJourney, toggleFavourite, isFavourite } = useAppState();
  const journey = getJourney(id);
  const tr = useT();
  const alert = useStopAlert(journey);
  const handoff = useHandoff();
  const [snack, setSnack] = useState('');
  const [routed, setRouted] = useState<Record<number, RoutedPath | null>>({});
  const [waLeg, setWaLeg] = useState<Leg | null>(null);

  // Fetch real street geometry for walk and ride legs (on demand, this screen only).
  useEffect(() => {
    if (!journey) return;
    const ctrl = new AbortController();
    journey.legs.forEach((l, i) => {
      if (l.interchange || (l.mode !== 'walk' && l.mode !== 'ride')) return;
      if (l.mode === 'walk' && l.distanceM > 4000) return;
      void routePath(l.mode === 'walk' ? 'walk' : 'drive', [l.from.lat, l.from.lon], [l.to.lat, l.to.lon], ctrl.signal).then((r) =>
        setRouted((cur) => ({ ...cur, [i]: r })),
      );
    });
    return () => ctrl.abort();
  }, [journey]);

  const map = useMemo(() => {
    if (!journey) return { lines: [] as MapLine[], markers: [] as MapMarker[], fit: [] as [number, number][] };
    const lines: MapLine[] = journey.legs.map((l, i) => {
      const r = routed[i];
      const colour = l.mode === 'ride' ? t.ink.ink : l.mode === 'walk' ? t.ink.muted : (l.line?.colour ?? MODE_COLOURS[l.mode]);
      return { id: `leg-${i}`, points: r ? r.geometry : l.geometry, colour, width: l.mode === 'walk' ? 3 : 5, dashed: !r && l.geometryKind === 'approximate' };
    });
    const first = journey.legs[0].from;
    const last = journey.legs[journey.legs.length - 1].to;
    const markers: MapMarker[] = [
      { id: 'origin', lat: first.lat, lon: first.lon, colour: t.ink.ink, title: first.name, description: 'Start', size: 'pin' },
      { id: 'destination', lat: last.lat, lon: last.lon, colour: t.ink.accent, title: last.name, description: 'Destination', size: 'pin' },
      ...journey.legs.slice(1).map<MapMarker>((l, i) => ({
        id: `x-${i}`,
        lat: l.from.lat,
        lon: l.from.lon,
        colour: l.line?.colour ?? MODE_COLOURS[l.mode],
        title: l.from.name,
        description: l.mode === 'walk' ? 'Get off here' : `Board: ${l.mode === 'metro' ? l.line?.name : l.mode === 'bus' ? `bus ${l.route?.ref ?? ''}` : 'ride'}`,
        size: 'station',
      })),
    ];
    return { lines, markers, fit: journey.legs.flatMap((l) => [[l.from.lat, l.from.lon] as [number, number], [l.to.lat, l.to.lon] as [number, number]]) };
  }, [journey, routed, t]);

  if (!journey)
    return (
      <View style={[styles.center, { backgroundColor: t.ink.paper }]}>
        <Text style={[styles.bigTitle, { color: t.ink.ink }]}>This journey has gone</Text>
        <Text style={[styles.small, { color: t.ink.muted, textAlign: 'center' }]}>Only the latest search is kept in memory.</Text>
        <PillButton label="Plan a journey" onPress={() => router.replace('/')} />
      </View>
    );

  const fare = fareText(journey.fare, journey.modes);
  const dest = journey.legs[journey.legs.length - 1].to;
  const routedCount = Object.values(routed).filter(Boolean).length;
  const routable = journey.legs.filter((l) => !l.interchange && (l.mode === 'walk' || l.mode === 'ride')).length;
  // One metro ticket covers interchanges, so a ticket ends at the last metro station of that ride.
  const metroTicketEnd = (leg: Leg) => {
    let end = leg;
    for (let j = journey.legs.indexOf(leg) + 1; j + 1 < journey.legs.length && journey.legs[j].interchange && journey.legs[j + 1].mode === 'metro'; j += 2) end = journey.legs[j + 1];
    return end.to;
  };
  const waTo = waLeg ? metroTicketEnd(waLeg).name : '';
  const d = splitDuration(journey.durationSec);

  return (
    <>
      <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }, wide && styles.contentWide]}>
        <View style={styles.hero}>
          <Eyebrow>{journey.title}</Eyebrow>
          <View style={styles.heroRow}>
            <Text style={[styles.duration, { color: t.ink.ink }]} accessibilityLabel={formatDuration(journey.durationSec)}>
              {d.h > 0 ? (
                <>
                  {d.h}
                  <Text style={styles.unit}>h </Text>
                  {d.m.toString().padStart(2, '0')}
                </>
              ) : (
                <>
                  {d.m}
                  <Text style={styles.unit}> min</Text>
                </>
              )}
            </Text>
            <View style={styles.fareBox}>
              <Text style={[fare.main.startsWith('₹') ? styles.fare : styles.fareWords, { color: t.ink.ink }]}>{fare.main}</Text>
              {fare.sub && <Text style={[styles.fareSub, { color: t.ink.muted }]}>{fare.sub}</Text>}
            </View>
          </View>
          <View style={[styles.stats, { borderColor: t.ink.rule }]}>
            <Stat label={tr('Leave')} value={formatClock(journey.departAt)} />
            <Stat label={tr('Arrive')} value={`~${formatClock(journey.arriveAt)}`} />
            <Stat label={tr('Walk')} value={formatDistance(journey.walkM)} />
            <Stat label={tr('Changes')} value={String(journey.transfers)} />
          </View>
        </View>

        {journey.modes.some((m) => m !== 'walk') && (
          <PillButton label={tr('Book whole journey')} onPress={() => router.push({ pathname: '/book/[id]', params: { id: journey.id } })} style={{ minHeight: 52 }} />
        )}

        <View style={styles.row}>
          {alert.available && !alert.state.on && <PillButton label={tr('Alert me before my stop')} variant="outline" onPress={() => void alert.start()} />}
          <PillButton label={tr('Share trip')} variant="outline" onPress={() => void Share.share({ message: tripShareText(journey) })} />
        </View>

        {(alert.state.on || alert.state.alerting || alert.state.denied) && (
          <View
            style={[styles.alertBox, { backgroundColor: alert.state.alerting ? t.ink.ink : t.ink.card, borderColor: t.ink.rule }]}
            accessibilityLiveRegion="assertive"
          >
            {alert.state.denied ? (
              <Text style={[styles.small, { color: t.ink.warn }]}>{tr('Location permission is needed for the stop alert.')}</Text>
            ) : alert.state.alerting ? (
              <>
                <Text style={[styles.alertTitle, { color: t.ink.paper }]}>
                  {alert.state.arrived ? tr('You have arrived.') : tr('Get off soon: {stop}', { stop: alert.state.alerting.name })}
                </Text>
                <View style={styles.row}>
                  <TextAction label="OK" onPress={alert.dismiss} tone="inverse" />
                  {alert.state.on && <TextAction label={tr('Turn off alert')} onPress={alert.stop} tone="inverse" />}
                </View>
              </>
            ) : (
              <>
                <Eyebrow>{tr('Stop alert is on')}</Eyebrow>
                {alert.state.target && (
                  <Text style={[styles.alertTitle, { color: t.ink.ink }]}>{tr('Next stop to get off: {stop}', { stop: alert.state.target.name })}</Text>
                )}
                <Text style={[styles.small, { color: t.ink.muted }]}>
                  {alert.state.distanceM == null ? tr('Waiting for GPS…') : tr('{distance} to go', { distance: formatDistance(alert.state.distanceM) })}
                </Text>
                <Text style={[styles.small, { color: t.ink.muted }]}>
                  {tr('Keep Hogona open on screen. The phone vibrates about 600 m before each stop where you change or get off.')}
                </Text>
                <TextAction label={tr('Turn off alert')} tone="muted" onPress={alert.stop} />
              </>
            )}
          </View>
        )}

        <View style={wide ? styles.columns : styles.stack}>
        <View style={wide ? styles.colMap : styles.stack}>
        <TransitMap lines={map.lines} markers={map.markers} fit={map.fit} style={[styles.map, wide && styles.mapWide, { borderColor: t.ink.rule }]} accessibilityLabel={`Map of the journey: ${journey.title}`} />
        <Text style={[styles.small, { color: t.ink.faint }]}>
          Solid lines follow the metro track or bus stops{routedCount ? ' or a routed street path' : ''}; dashed lines are straight, not walkable paths.
          {routable > routedCount && ' Street paths appear when the routing service responds.'}
        </Text>

        {journey.warnings.length > 0 && (
          <View style={[styles.warn, { backgroundColor: t.ink.warnWash }]}>
            <Eyebrow colour={t.ink.warn}>{tr('Good to know')}</Eyebrow>
            {journey.warnings.map((w) => (
              <Text key={w} style={[styles.small, { color: t.ink.warn }]}>
                {w}
              </Text>
            ))}
          </View>
        )}

        </View>
        <View style={wide ? styles.colMain : styles.stack}>
        <View style={{ marginTop: 8 }}>
          <JourneyTimeline
            journey={journey}
            actions={{
              onUber: async (l) => setSnack(await handoff.openUber(l.from, l.to)),
              onUberInApp: async (l) => setSnack(await handoff.openUberInApp(l.from, l.to)),
              onRideApp: async (l, id) => setSnack(await handoff.openRideApp(id, l.from, l.to)),
              onWhatsApp: (l) => setWaLeg(l),
              onOperatorApp: async (l) =>
                setSnack(await handoff.openOperatorApp(l.mode === 'metro' ? 'namma-metro' : l.route?.operator === 'KSRTC' ? 'ksrtc' : 'bmtc', { from: l.from, to: l.mode === 'metro' ? metroTicketEnd(l) : l.to })),
              onTrains: async (l) => {
                const a = l.from.refId && railStation(l.from.refId.slice(5));
                const b = l.to.refId && railStation(l.to.refId.slice(5));
                if (a && b) setSnack(await handoff.openInApp(trainSearchUrl(a, b, new Date(journey.departAt)), `Trains ${a.code} → ${b.code}`));
              },
              onIrctc: async (l) => setSnack(await handoff.openOperatorApp('irctc', { from: l.from, to: l.to })),
              onDirections: async (l) => setSnack(await handoff.openDirections(l.from, l.to, l.mode === 'ride' ? 'driving' : 'walking')),
            }}
          />
        </View>

        <View style={styles.row}>
          <PillButton label={isFavourite(dest) ? tr('Destination saved') : tr('Save destination')} variant="outline" onPress={() => toggleFavourite(dest)} />
          <TextAction label={tr('Compare in Google Maps')} tone="muted" onPress={async () => setSnack(await handoff.openDirections(journey.legs[0].from, dest, 'transit'))} />
        </View>

        <View style={[styles.sources, { borderTopColor: t.ink.rule }]}>
          <Text style={[styles.sourcesTitle, { color: t.ink.ink }]}>How we worked this out</Text>
          {[
            `Metro stations and track: ${datasetManifest.datasets.metro.licence}, snapshot ${datasetManifest.datasets.metro.osmSnapshot?.slice(0, 10)}. Buses: unofficial community BMTC data (bmtc-gtfs by Vonter, ODbL) from the Namma BMTC app.`,
            'Metro run time: track distance at an average 34 km/h plus 30 s per stop. Not live.',
            'Bus time: an assumed average speed and wait. No BMTC timetable or live tracking is available.',
            `Rides: ${RIDE_ASSUMPTIONS.explanation}`,
            `Fares: BMRCL slab table and published BMTC stages, checked ${datasetManifest.datasets.fares.verifiedOn}. You pay what the operator charges.`,
          ].map((line, i) => (
            <View key={i} style={styles.sourceRow}>
              <Figure size={11} colour={t.ink.faint}>
                {String(i + 1).padStart(2, '0')}
              </Figure>
              <Text style={[styles.small, { color: t.ink.muted, flex: 1 }]}>{line}</Text>
            </View>
          ))}
          <DataFreshnessLabel compact />
        </View>
        </View>
        </View>
      </ScrollView>

      <WhatsAppTicketDialog
        visible={!!waLeg}
        fromStation={waLeg?.from.name ?? ''}
        toStation={waTo}
        onDismiss={() => setWaLeg(null)}
        onOpen={async (n) => {
          const from = waLeg!.from.name;
          setWaLeg(null);
          setSnack(await handoff.openMetroWhatsApp(from, waTo, n));
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={6000}>
        {snack}
      </Snackbar>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useAppTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: t.ink.faint }]}>{label.toUpperCase()}</Text>
      <Figure size={14}>{value}</Figure>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 16, paddingBottom: 56, maxWidth: 680, width: '100%', alignSelf: 'center' },
  contentWide: { maxWidth: 1240 },
  stack: { gap: 16 },
  // Hinge-wide gap so dual-screen devices split exactly between map and timeline.
  columns: { flexDirection: 'row', gap: 88, alignItems: 'flex-start' },
  colMap: { flex: 1, gap: 16 },
  colMain: { flex: 1, gap: 16 },
  mapWide: { height: 520 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  bigTitle: { fontFamily: FONTS.serif, fontSize: 30, letterSpacing: -0.5 },
  hero: { gap: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  duration: { fontFamily: FONTS.serif, fontSize: 64, lineHeight: 66, letterSpacing: -2 },
  unit: { fontFamily: FONTS.serifItalic, fontSize: 32, letterSpacing: 0 },
  fareBox: { alignItems: 'flex-end', maxWidth: '45%', paddingBottom: 6 },
  fare: { fontFamily: FONTS.monoMedium, fontSize: 24, letterSpacing: -0.6 },
  fareWords: { fontFamily: FONTS.serifItalic, fontSize: 24, letterSpacing: -0.2, textAlign: 'right' },
  fareSub: { fontFamily: FONTS.sans, fontSize: 11.5, textAlign: 'right' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10, marginTop: 8 },
  stat: { flex: 1, gap: 3 },
  statLabel: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.3 },
  map: { height: 280, borderRadius: 20, borderWidth: 1 },
  small: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  warn: { borderRadius: 14, padding: 14, gap: 6 },
  alertBox: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  alertTitle: { fontFamily: FONTS.serif, fontSize: 24, lineHeight: 28, letterSpacing: -0.3 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'center' },
  sources: { borderTopWidth: 1, paddingTop: 18, gap: 10, marginTop: 8 },
  sourcesTitle: { fontFamily: FONTS.serif, fontSize: 24, letterSpacing: -0.3 },
  sourceRow: { flexDirection: 'row', gap: 10 },
});
