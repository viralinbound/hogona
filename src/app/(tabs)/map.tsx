import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { sortJourneys } from '../../algorithms/journey-ranking';
import { fareText } from '../../components/fare-text';
import { IntercityCard } from '../../components/IntercityCard';
import type { MapLine, MapMarker } from '../../components/map-types';
import TransitMap from '../../components/MapView';
import { LineSwatch, ModeTag } from '../../components/ModeTag';
import { Eyebrow, Figure, PillButton, TextAction, Toggle, useAppTheme } from '../../components/ui';
import { FONTS, MODE_COLOURS } from '../../constants/theme';
import { lineById, routesAtStop, stationById, stopById, transportData } from '../../services/transport-data';
import { useAppState } from '../../state/AppState';
import type { Journey, Place } from '../../types/journey';
import { formatDuration } from '../../utils/format';

type Bounds = { minLat: number; maxLat: number; minLon: number; maxLon: number; zoomedIn: boolean };
const MAX_STOP_MARKERS = 250;

/**
 * Map tab doubles as a planner: pick a start and a destination on the map
 * (station, stop or long-press anywhere), find journeys, and see the chosen
 * option's full route drawn leg by leg.
 */
export default function ExploreMapScreen() {
  const t = useAppTheme();
  const params = useLocalSearchParams<{ layer?: string }>();
  const { origin, destination, setOrigin, setDestination, isFavourite, toggleFavourite, plan, runPlan } = useAppState();
  const [showBus, setShowBus] = useState(params.layer === 'bus');
  const [showMetro, setShowMetro] = useState(true);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [planned, setPlanned] = useState(false);
  const [pick, setPick] = useState(0);
  const [snack, setSnack] = useState('');

  const journeys: Journey[] = useMemo(() => (planned && plan.status === 'done' ? sortJourneys(plan.result?.journeys ?? [], 'recommended') : []), [planned, plan]);
  const chosen = journeys[pick];

  // A new start or destination invalidates the drawn journeys.
  useEffect(() => {
    setPlanned(false);
    setPick(0);
  }, [origin, destination]);

  const lines: MapLine[] = useMemo(() => {
    const base: MapLine[] = showMetro
      ? transportData.lines.map((l) => ({ id: l.id, points: l.segments.flatMap((s, i) => (i ? s.slice(1) : s)), colour: chosen ? `${l.colour}40` : l.colour, width: chosen ? 3 : 5 }))
      : [];
    if (!chosen) return base;
    return [
      ...base,
      ...chosen.legs.map((l, i) => ({
        id: `leg-${i}`,
        points: l.geometry,
        colour: l.mode === 'ride' ? t.ink.ink : l.mode === 'walk' ? t.ink.muted : (l.line?.colour ?? MODE_COLOURS[l.mode]),
        width: l.mode === 'walk' ? 3 : 6,
        dashed: l.geometryKind === 'approximate',
      })),
    ];
  }, [showMetro, chosen, t]);

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    if (showMetro && !chosen)
      for (const s of transportData.stations)
        out.push({ id: `s:${s.id}`, lat: s.lat, lon: s.lon, colour: lineById.get(s.line)!.colour, title: s.name, description: lineById.get(s.line)!.name, size: 'station' });
    if (showBus && bounds?.zoomedIn && !chosen) {
      const inView = transportData.stops.filter((s) => s.lat >= bounds.minLat && s.lat <= bounds.maxLat && s.lon >= bounds.minLon && s.lon <= bounds.maxLon);
      for (const s of inView.slice(0, MAX_STOP_MARKERS)) out.push({ id: `b:${s.id}`, lat: s.lat, lon: s.lon, colour: MODE_COLOURS.bus, title: s.name, description: 'BMTC stop', size: 'dot' });
    }
    if (chosen)
      chosen.legs.slice(1).forEach((l, i) =>
        out.push({ id: `x-${i}`, lat: l.from.lat, lon: l.from.lon, colour: l.line?.colour ?? MODE_COLOURS[l.mode], title: l.from.name, description: 'Change here', size: 'station' }),
      );
    if (origin) out.push({ id: 'origin', lat: origin.lat, lon: origin.lon, colour: t.ink.ink, title: origin.name, description: 'Start', size: 'pin' });
    if (destination) out.push({ id: 'destination', lat: destination.lat, lon: destination.lon, colour: t.ink.accent, title: destination.name, description: 'Destination', size: 'pin' });
    if (selected && selected.kind === 'map') out.push({ id: 'picked', lat: selected.lat, lon: selected.lon, colour: t.ink.warn, title: selected.name, size: 'pin' });
    return out;
  }, [showMetro, showBus, bounds, selected, chosen, origin, destination, t]);

  const fit = useMemo(() => (chosen ? chosen.legs.flatMap((l) => l.geometry) : undefined), [chosen]);

  const onMarker = (id: string) => {
    const [kind, ref] = [id.slice(0, 1), id.slice(2)];
    if (kind === 's') {
      const s = stationById.get(ref)!;
      setSelected({ name: s.name, lat: s.lat, lon: s.lon, kind: 'metro', refId: s.id, subtitle: lineById.get(s.line)?.name });
    } else if (kind === 'b') {
      const s = stopById.get(ref)!;
      setSelected({ name: s.name, lat: s.lat, lon: s.lon, kind: 'bus', refId: s.id, subtitle: `Buses: ${routesAtStop(s.id).slice(0, 8).join(', ') || 'none mapped'}` });
    }
  };

  const setAs = (as: 'origin' | 'destination') => {
    if (!selected) return;
    (as === 'origin' ? setOrigin : setDestination)(selected);
    setSelected(null);
  };

  const find = async () => {
    setPlanned(true);
    setPick(0);
    await runPlan();
  };

  return (
    <View style={styles.screen}>
      <TransitMap
        lines={lines}
        markers={markers}
        fit={fit}
        style={StyleSheet.absoluteFill}
        showUserLocation
        onMarkerPress={onMarker}
        onMapPress={(lat, lon) => setSelected({ name: 'Pinned point', lat, lon, kind: 'map', subtitle: `${lat.toFixed(4)}, ${lon.toFixed(4)}` })}
        onRegionChange={setBounds}
        accessibilityLabel="Map of Namma Metro lines and BMTC stops"
      />

      {/* Trip bar: start and destination, editable from the map or by search. */}
      <View style={[styles.trip, { backgroundColor: t.ink.paper, borderColor: t.ink.rule }]}>
        <TripField label="From" place={origin} onPress={() => router.push({ pathname: '/place-search', params: { field: 'origin' } })} />
        <View style={[styles.tripRule, { backgroundColor: t.ink.rule }]} />
        <TripField label="To" place={destination} onPress={() => router.push({ pathname: '/place-search', params: { field: 'destination' } })} />
        <View style={styles.tripActions}>
          <View style={styles.layerRow}>
            <Toggle label="Metro" selected={showMetro} onPress={() => setShowMetro((v) => !v)} />
            <Toggle label="Bus stops" selected={showBus} onPress={() => setShowBus((v) => !v)} />
          </View>
          {origin && destination && !planned && <PillButton label="Find journeys" onPress={find} style={styles.findBtn} />}
          {planned && <TextAction label="Clear route" tone="muted" onPress={() => setPlanned(false)} />}
        </View>
        {!origin || !destination ? (
          <Text style={[styles.hint, { color: t.ink.faint }]}>Tap a station or stop, or long-press anywhere on the map, then choose Start or Destination.</Text>
        ) : null}
        {showBus && !bounds?.zoomedIn && !chosen && <Text style={[styles.hint, { color: t.ink.faint }]}>Zoom in to see bus stops.</Text>}
      </View>

      {selected && (
        <View style={[styles.sheet, { backgroundColor: t.ink.paper, borderColor: t.ink.rule }]}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Eyebrow>{selected.kind === 'metro' ? 'Metro station' : selected.kind === 'bus' ? 'Bus stop' : 'Pinned'}</Eyebrow>
              <Text style={[styles.sheetTitle, { color: t.ink.ink }]} numberOfLines={2}>
                {selected.name}
              </Text>
              {selected.subtitle && (
                <Text style={[styles.sheetSub, { color: t.ink.muted }]} numberOfLines={2}>
                  {selected.subtitle}
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 10 }}>
              <TextAction label="Close" tone="muted" onPress={() => setSelected(null)} />
              <TextAction label={isFavourite(selected) ? 'Saved' : 'Save'} tone={isFavourite(selected) ? 'accent' : 'ink'} onPress={() => toggleFavourite(selected)} />
            </View>
          </View>
          <View style={styles.sheetActions}>
            <PillButton label="Start here" variant="outline" onPress={() => setAs('origin')} style={{ flex: 1 }} />
            <PillButton label="Destination" onPress={() => setAs('destination')} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {!selected && planned && (
        <View style={styles.results}>
          {plan.status === 'planning' && <Text style={[styles.status, { backgroundColor: t.ink.paper, color: t.ink.ink }]}>Working out your options…</Text>}
          {plan.status === 'done' && plan.result?.intercity && (
            <ScrollView style={{ maxHeight: 330 }} contentContainerStyle={{ paddingBottom: 4 }}>
              <IntercityCard
                info={plan.result.intercity}
                onMessage={setSnack}
                compact
              />
            </ScrollView>
          )}
          {plan.status === 'done' && journeys.length === 0 && !plan.result?.intercity && (
            <Text style={[styles.status, { backgroundColor: t.ink.paper, color: t.ink.ink }]}>{plan.result?.notices[0] ?? 'No journey found for these places.'}</Text>
          )}
          {journeys.length > 0 && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
                {journeys.map((j, i) => (
                  <OptionCard key={j.id} journey={j} active={i === pick} onPress={() => setPick(i)} />
                ))}
              </ScrollView>
              {chosen && (
                <View style={styles.cardActions}>
                  <PillButton label="Details" variant="outline" onPress={() => router.push({ pathname: '/journey/[id]', params: { id: chosen.id } })} style={{ flex: 1 }} />
                  {chosen.modes.some((m) => m !== 'walk') && (
                    <PillButton label="Book whole journey" onPress={() => router.push({ pathname: '/book/[id]', params: { id: chosen.id } })} style={{ flex: 1.4 }} />
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {!selected && !planned && showMetro && (
        <View style={[styles.legend, { backgroundColor: t.ink.paper, borderColor: t.ink.rule }]}>
          {transportData.lines.map((l) => (
            <View key={l.id} style={styles.legendRow}>
              <LineSwatch colour={l.colour} width={24} />
              <Text style={[styles.legendName, { color: t.ink.ink }]}>{l.name}</Text>
              <Text style={[styles.legendMeta, { color: t.ink.muted }]}>
                {l.stations.length} stops · {(l.trackLengthM / 1000).toFixed(1)} km
              </Text>
            </View>
          ))}
        </View>
      )}
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={5000}>
        {snack}
      </Snackbar>
    </View>
  );
}

function TripField({ label, place, onPress }: { label: string; place: Place | null; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${place?.name ?? 'not set'}`} style={styles.field}>
      <Text style={[styles.fieldLabel, { color: t.ink.faint }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.fieldValue, { color: place ? t.ink.ink : t.ink.faint }]} numberOfLines={1}>
        {place?.name ?? 'Pick on map or search'}
      </Text>
    </Pressable>
  );
}

function OptionCard({ journey, active, onPress }: { journey: Journey; active: boolean; onPress: () => void }) {
  const t = useAppTheme();
  const fare = fareText(journey.fare, journey.modes);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${journey.title}, ${formatDuration(journey.durationSec)}, fare ${fare.main}`}
      style={[styles.card, { backgroundColor: t.ink.paper, borderColor: active ? t.ink.ink : t.ink.rule, borderWidth: active ? 2 : 1 }]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardDur, { color: t.ink.ink }]}>{formatDuration(journey.durationSec)}</Text>
        <Figure size={13}>{fare.main}</Figure>
      </View>
      <View style={styles.cardModes}>
        {journey.legs
          .filter((l) => l.mode !== 'walk')
          .slice(0, 4)
          .map((l, i) => (
            <ModeTag key={i} leg={l} size="sm" />
          ))}
        {journey.modes.length === 1 && journey.modes[0] === 'walk' && <ModeTag leg={journey.legs[0]} size="sm" />}
      </View>
      {journey.tags[0] && <Text style={[styles.cardTag, { color: t.ink.accent }]}>{journey.tags[0] === 'recommended' ? 'Best option' : journey.tags[0].replace('-', ' ')}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  trip: { position: 'absolute', top: 10, left: 56, right: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, gap: 2, maxWidth: 560 },
  field: { paddingVertical: 4, minHeight: 40, justifyContent: 'center' },
  fieldLabel: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.4 },
  fieldValue: { fontFamily: FONTS.serif, fontSize: 20, lineHeight: 24 },
  tripRule: { height: StyleSheet.hairlineWidth * 2 },
  tripActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  layerRow: { flexDirection: 'row', gap: 6 },
  findBtn: { minHeight: 38, paddingHorizontal: 14 },
  hint: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, marginTop: 4 },
  legend: { position: 'absolute', left: 12, bottom: 12, borderRadius: 16, borderWidth: 1, padding: 14, gap: 8, maxWidth: 340 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendName: { fontFamily: FONTS.sansSemi, fontSize: 13, width: 92 },
  legendMeta: { fontFamily: FONTS.mono, fontSize: 11.5 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 22, borderWidth: 1, padding: 18, gap: 14, maxWidth: 560, alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', gap: 12 },
  sheetTitle: { fontFamily: FONTS.serif, fontSize: 28, lineHeight: 31, letterSpacing: -0.5, marginTop: 2 },
  sheetSub: { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
  sheetActions: { flexDirection: 'row', gap: 10 },
  results: { position: 'absolute', left: 0, right: 0, bottom: 10, gap: 8 },
  status: { fontFamily: FONTS.sansMedium, fontSize: 13.5, marginHorizontal: 12, padding: 14, borderRadius: 14, overflow: 'hidden' },
  cards: { gap: 10, paddingHorizontal: 12 },
  card: { width: 200, borderRadius: 16, padding: 12, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 },
  cardDur: { fontFamily: FONTS.serif, fontSize: 22, letterSpacing: -0.4 },
  cardModes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cardTag: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  cardActions: { flexDirection: 'row', gap: 10, marginHorizontal: 12, maxWidth: 560 },
});
