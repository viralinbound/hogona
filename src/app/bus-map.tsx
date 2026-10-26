import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MapLine, MapMarker } from '../components/map-types';
import TransitMap from '../components/MapView';
import { Eyebrow, TextAction, useAppTheme } from '../components/ui';
import { FONTS, MODE_COLOURS } from '../constants/theme';
import { useLayout } from '../hooks/useLayout';
import { stopById, transportData } from '../services/transport-data';
import { useAppState } from '../state/AppState';
import type { BusRoute } from '../types/transport';

const sortRef = (a: BusRoute, b: BusRoute) => (a.ref ?? a.name).localeCompare(b.ref ?? b.name, 'en', { numeric: true });

/** Every BMTC route bundled in the app: search, pick one, see it on the map with all its stops. */
export default function BusMapScreen() {
  const t = useAppTheme();
  const { wide, gutter } = useLayout();
  const { setOrigin, setDestination } = useAppState();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? '');
  const [selected, setSelected] = useState<BusRoute | null>(null);

  const routes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...transportData.routes].sort(sortRef);
    if (!q) return list;
    return list.filter((r) => `${r.ref ?? ''} ${r.name} ${r.from ?? ''} ${r.to ?? ''}`.toLowerCase().includes(q));
  }, [query]);

  const stops = useMemo(() => (selected ? selected.stops.map((id) => stopById.get(id)!).filter(Boolean) : []), [selected]);

  const lines: MapLine[] = useMemo(
    () =>
      selected
        ? [{ id: selected.id, points: stops.map((s) => [s.lat, s.lon] as [number, number]), colour: MODE_COLOURS.bus, width: 5 }]
        : // Overview: every route faintly, so the whole network is visible.
          transportData.routes.map((r) => ({
            id: r.id,
            points: r.stops.map((id) => stopById.get(id)).filter(Boolean).map((s) => [s!.lat, s!.lon] as [number, number]),
            colour: '#2F6B3F55',
            width: 2,
          })),
    [selected, stops],
  );

  const markers: MapMarker[] = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.id,
        lat: s.lat,
        lon: s.lon,
        colour: MODE_COLOURS.bus,
        title: s.name,
        description: `Stop ${i + 1} of ${stops.length}`,
        size: i === 0 || i === stops.length - 1 ? 'station' : 'dot',
      })),
    [stops],
  );

  const map = (
    <TransitMap
      lines={lines}
      markers={markers}
      fit={stops.length ? stops.map((s) => [s.lat, s.lon] as [number, number]) : undefined}
      style={[styles.map, wide ? styles.mapWide : null, { borderColor: t.ink.rule }]}
      accessibilityLabel={selected ? `Map of bus route ${selected.ref}` : 'Map of all bundled BMTC routes'}
    />
  );

  const panel = selected ? (
    <View style={{ flex: 1, gap: 10 }}>
      <TextAction label="All routes" tone="muted" onPress={() => setSelected(null)} />
      <Eyebrow>BMTC route</Eyebrow>
      <Text style={[styles.big, { color: t.ink.ink }]}>{selected.ref ?? 'Bus'}</Text>
      <Text style={[styles.note, { color: t.ink.muted }]}>
        {selected.from && selected.to ? `${selected.from} → ${selected.to}` : selected.name} · {stops.length} stops{selected.ac ? ' · AC' : ''}
      </Text>
      <FlatList
        data={stops}
        keyExtractor={(s, i) => `${s.id}-${i}`}
        renderItem={({ item, index }) => (
          <View style={[styles.stopRow, { borderBottomColor: t.ink.rule }]}>
            <Text style={[styles.stopNum, { color: t.ink.faint }]}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={[styles.stopName, { color: t.ink.ink }]} numberOfLines={1}>
              {item.name}
            </Text>
            <TextAction
              label="Go here"
              tone="muted"
              onPress={() => {
                setDestination({ name: item.name, lat: item.lat, lon: item.lon, kind: 'bus', refId: item.id, subtitle: 'BMTC bus stop' });
                router.push('/');
              }}
            />
            <TextAction
              label="From"
              tone="muted"
              onPress={() => {
                setOrigin({ name: item.name, lat: item.lat, lon: item.lon, kind: 'bus', refId: item.id, subtitle: 'BMTC bus stop' });
                router.push('/');
              }}
            />
          </View>
        )}
      />
    </View>
  ) : (
    <View style={{ flex: 1, gap: 10 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Bus number or place, e.g. 500D, Majestic"
        placeholderTextColor={t.ink.faint}
        style={[styles.input, { color: t.ink.ink, borderBottomColor: t.ink.ink }]}
        accessibilityLabel="Search bus routes"
      />
      <Text style={[styles.note, { color: t.ink.muted }]}>
        {routes.length} of {transportData.routes.length} routes. Only routes mapped in OpenStreetMap are included — BMTC runs more.
      </Text>
      <FlatList
        data={routes}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            accessibilityRole="button"
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.routeRow, { borderBottomColor: t.ink.rule }, hovered && { opacity: 0.7 }]}
          >
            <View style={[styles.ref, { backgroundColor: MODE_COLOURS.bus }]}>
              <Text style={styles.refText} numberOfLines={1}>
                {item.ref ?? '—'}
              </Text>
            </View>
            <Text style={[styles.routeName, { color: t.ink.ink }]} numberOfLines={2}>
              {item.from && item.to ? `${item.from} → ${item.to}` : item.name}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={[styles.note, { color: t.ink.muted }]}>No bundled route matches “{query}”.</Text>}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: t.ink.paper, paddingHorizontal: gutter }, wide && styles.screenWide]}>
      {map}
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 12, gap: 14, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  screenWide: { flexDirection: 'row', paddingBottom: 20, gap: 88 },
  map: { height: 260, borderRadius: 18, borderWidth: 1 },
  mapWide: { flex: 1, height: undefined },
  input: { fontFamily: FONTS.serif, fontSize: 24, borderBottomWidth: 1.5, paddingVertical: 6, outlineStyle: 'none' } as object,
  note: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2, minHeight: 52 },
  ref: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, minWidth: 64, alignItems: 'center' },
  refText: { color: '#fff', fontFamily: FONTS.sansBold, fontSize: 12.5, letterSpacing: 0.5 },
  routeName: { fontFamily: FONTS.sansMedium, fontSize: 14, flex: 1 },
  big: { fontFamily: FONTS.serif, fontSize: 44, lineHeight: 46, letterSpacing: -1 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 4, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  stopNum: { fontFamily: FONTS.mono, fontSize: 12, width: 24 },
  stopName: { fontFamily: FONTS.sans, fontSize: 14, flex: 1 },
});

