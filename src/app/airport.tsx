import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { KindMark, PlaceRow } from '../components/PlaceRow';
import { Eyebrow, PillButton, useAppTheme } from '../components/ui';
import { FONTS } from '../constants/theme';
import { useLayout } from '../hooks/useLayout';
import { useT } from '../i18n';
import { stopById, transportData } from '../services/transport-data';
import { useAppState } from '../state/AppState';
import type { Place } from '../types/journey';

/** Bus bay at the terminal used by the Vayu Vajra routes in the community BMTC data. */
const AIRPORT_STOP_ID = 'gtfs-23485';

/** Vayu Vajra (KIA-*) routes towards the airport, one row per route number. */
function airportRoutes() {
  const byRef = new Map<string, { ref: string; from: string; trips: number; first: string; last: string; headway: number }>();
  for (const r of transportData.routes) {
    if (!r.ref?.startsWith('KIA') || !/International Airport/.test(r.to ?? '')) continue;
    const s = transportData.busSchedules?.[r.id];
    const cur = byRef.get(r.ref);
    if (cur && cur.trips >= (s?.trips ?? 0)) continue;
    byRef.set(r.ref, { ref: r.ref, from: r.from ?? r.name, trips: s?.trips ?? 0, first: s?.firstDeparture ?? '', last: s?.lastDeparture ?? '', headway: s?.avgHeadwayMin ?? 0 });
  }
  return [...byRef.values()].sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }));
}

export default function AirportScreen() {
  const t = useAppTheme();
  const tr = useT();
  const { gutter } = useLayout();
  const { origin, setOrigin, setDestination, runPlan } = useAppState();
  const routes = useMemo(airportRoutes, []);
  const stop = stopById.get(AIRPORT_STOP_ID);
  const airport: Place | null = stop ? { name: 'Kempegowda International Airport', lat: stop.lat, lon: stop.lon, kind: 'bus', refId: stop.id, subtitle: 'Airport bus bay' } : null;

  const toAirport = () => {
    if (!airport) return;
    setDestination(airport);
    if (origin) {
      void runPlan(origin, airport);
      router.push('/results');
    } else router.push({ pathname: '/place-search', params: { field: 'origin' } });
  };
  const fromAirport = () => {
    if (!airport) return;
    setOrigin(airport);
    router.push({ pathname: '/place-search', params: { field: 'destination' } });
  };

  return (
    <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      <Text style={[styles.title, { color: t.ink.ink }]}>Kempegowda International Airport</Text>
      <Text style={[styles.note, { color: t.ink.muted }]}>
        BMTC Vayu Vajra buses (route numbers starting KIA) run to the airport from across the city. Hogona plans them together with the metro and cabs.
      </Text>
      <View style={styles.actions}>
        <PillButton label={tr('Plan a trip to the airport')} onPress={toAirport} disabled={!airport} />
        <PillButton label={tr('Plan from the airport')} variant="outline" onPress={fromAirport} disabled={!airport} />
      </View>

      <Eyebrow style={{ marginTop: 18 }}>{`${routes.length} Vayu Vajra routes to the airport`}</Eyebrow>
      {routes.map((r) => (
        <PlaceRow
          key={r.ref}
          lead={<KindMark text={r.ref.replace('KIA-', '')} />}
          title={`${r.ref} from ${r.from}`}
          subtitle={r.trips ? `${r.trips} trips a day · ${r.first}–${r.last} · about every ${r.headway} min on average` : 'No timetable in the community data'}
          onPress={() => router.push({ pathname: '/bus-map', params: { q: r.ref } })}
          hint="Shows this route and all its stops on the map"
        />
      ))}
      <Text style={[styles.note, { color: t.ink.faint, marginTop: 14 }]}>
        Timetable from the unofficial community BMTC data (bmtc-gtfs by Vonter, ODbL). It is not live and fares are not shown here — Vayu Vajra fares depend on where you board. Check the Namma BMTC app before you travel.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 56, gap: 6, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontFamily: FONTS.serif, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
});
