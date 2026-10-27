import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommuteCard } from '../../components/CommuteCard';
import { Logo } from '../../components/Logo';
import { LineSwatch } from '../../components/ModeTag';
import { OriginDestinationForm } from '../../components/OriginDestinationForm';
import { KindMark, PlaceRow } from '../../components/PlaceRow';
import { SectionHead, TextAction, Toggle, useAppTheme } from '../../components/ui';
import { WhatsAppTicketDialog } from '../../components/WhatsAppTicketDialog';
import { FONTS } from '../../constants/theme';
import { useHandoff } from '../../features/handoff/useHandoff';
import { LOCATION_MESSAGES, useCurrentLocation } from '../../features/location/useCurrentLocation';
import { lineById, nearbyStations } from '../../services/transport-data';
import { useLayout } from '../../hooks/useLayout';
import { useT } from '../../i18n';
import { useAppState } from '../../state/AppState';
import type { Place } from '../../types/journey';
import { formatDistance } from '../../utils/format';

/** Home: one clear task (where from, where to), then a few simple shortcuts. */
export default function HomeScreen() {
  const t = useAppTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const { wide, gutter } = useLayout();
  const { origin, destination, setOrigin, setDestination, favourites, recents, runPlan } = useAppState();
  const { status, place: here, locate } = useCurrentLocation();
  const handoff = useHandoff();
  const [snack, setSnack] = useState('');
  const [waOpen, setWaOpen] = useState(false);

  const nearbyMetro = useMemo(() => (here ? nearbyStations(here.lat, here.lon, 2000).slice(0, 3) : []), [here]);

  const useMyLocation = async () => {
    const p = await locate();
    if (p) setOrigin(p);
  };

  const search = () => {
    void runPlan();
    router.push('/results');
  };

  const planTrip = (from: Place, to: Place) => {
    setOrigin(from);
    setDestination(to);
    void runPlan(from, to);
    router.push('/results');
  };

  const metroPair = origin?.kind === 'metro' && destination?.kind === 'metro' ? [origin.name, destination.name] : ['', ''];

  return (
    <>
      <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingHorizontal: gutter }, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
        {/* Tablets in landscape: planner on the left, shortcuts on the right. */}
        <View style={wide ? styles.columns : styles.stack}>
        <View style={wide ? styles.colMain : styles.stack}>
        <View style={styles.header}>
          <Logo size={46} tagline />
        </View>
        <Text style={[styles.lead, { color: t.ink.muted }]}>{tr('Where do you want to go today?')}</Text>
        {/* Left-aligned, not in the top-right corner: foldables (iPhone Duo) float the status pill there. */}
        <View style={styles.locate}>
          <TextAction label={status === 'locating' ? tr('Finding you…') : tr('Use my location')} onPress={useMyLocation} tone="accent" />
        </View>

        {status !== 'idle' && status !== 'locating' && status !== 'ok' && (
          <View style={[styles.notice, { backgroundColor: t.ink.warnWash }]} accessibilityLiveRegion="polite">
            <Text style={[styles.small, { color: t.ink.warn }]}>{LOCATION_MESSAGES[status]}</Text>
          </View>
        )}

        <OriginDestinationForm onSearch={search} />
        </View>
        <View style={wide ? styles.colSide : styles.stack}>

        <CommuteCard onPlan={planTrip} />

        {favourites.length > 0 && (
          <View style={styles.block}>
            <SectionHead title={tr('Saved places')} action={{ label: tr('Edit'), onPress: () => router.push('/saved') }} />
            <View style={styles.chips}>
              {favourites.slice(0, 6).map((f) => (
                <Toggle key={f.id} label={f.label} selected={false} onPress={() => setDestination(f.place)} />
              ))}
            </View>
          </View>
        )}

        {recents.length > 0 && (
          <View style={styles.block}>
            <SectionHead title={tr('Recent trips')} />
            {recents.slice(0, 3).map((r) => (
              <PlaceRow
                key={r.searchedAt}
                title={`${r.origin.name} → ${r.destination.name}`}
                onPress={() => planTrip(r.origin, r.destination)}
                hint={tr('Plans this trip again')}
              />
            ))}
          </View>
        )}

        {nearbyMetro.length > 0 && (
          <View style={styles.block}>
            <SectionHead title={tr('Metro near you')} />
            {nearbyMetro.map(({ item, distanceM }) => (
              <PlaceRow
                key={item.id}
                lead={<LineSwatch colour={lineById.get(item.line)?.colour ?? t.ink.ink} width={24} />}
                title={item.name}
                subtitle={formatDistance(distanceM)}
                onPress={() => setOrigin({ name: item.name, lat: item.lat, lon: item.lon, kind: 'metro', refId: item.id, subtitle: lineById.get(item.line)?.name })}
                hint={tr('Starts from this station')}
              />
            ))}
          </View>
        )}

        <View style={styles.block}>
          <SectionHead title={tr('More')} />
          <PlaceRow lead={<KindMark text="MAP" />} title={tr('Metro map')} subtitle={tr('All stations and lines')} onPress={() => router.push('/map')} />
          <PlaceRow lead={<KindMark text="TIME" />} title={tr('Metro timings')} subtitle={tr('First and last trains, frequency, stations')} onPress={() => router.push('/metro-timings')} />
          <PlaceRow lead={<KindMark text="BUS" />} title={tr('Bus route map')} subtitle={tr('Find a bus number and see all its stops')} onPress={() => router.push('/bus-map')} />
          <PlaceRow lead={<KindMark text="KIA" />} title={tr('Airport buses')} subtitle={tr('Vayu Vajra (KIA) routes and how to reach the airport')} onPress={() => router.push('/airport')} />
          <PlaceRow lead={<KindMark text="₹" />} title={tr('Monthly cost calculator')} subtitle={tr('Metro, bus and pass costs for a daily trip')} onPress={() => router.push('/cost')} />
          <PlaceRow lead={<KindMark text="WA" />} title={tr('Buy a metro ticket on WhatsApp')} subtitle={tr('Official Namma Metro chat')} onPress={() => setWaOpen(true)} />
        </View>
        </View>
        </View>
      </ScrollView>

      <WhatsAppTicketDialog
        visible={waOpen}
        fromStation={metroPair[0]}
        toStation={metroPair[1]}
        onDismiss={() => setWaOpen(false)}
        onOpen={async (n) => {
          setWaOpen(false);
          setSnack(await handoff.openMetroWhatsApp(metroPair[0] || 'chosen in chat', metroPair[1] || 'chosen in chat', n));
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={5000}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  contentWide: { maxWidth: 1180 },
  stack: { gap: 22 },
  // Equal halves with a hinge-wide gap: on dual-screen/foldables the fold lands in the gap.
  columns: { flexDirection: 'row', gap: 88, alignItems: 'flex-start' },
  colMain: { flex: 1, gap: 22 },
  colSide: { flex: 1, gap: 22, paddingTop: 8 },
  locate: { alignSelf: 'flex-start', marginTop: -10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  wordmark: { fontFamily: FONTS.serif, fontSize: 44, lineHeight: 48, letterSpacing: -1.2 },
  lead: { fontFamily: FONTS.sans, fontSize: 17, lineHeight: 24, marginTop: -8 },
  notice: { borderRadius: 14, padding: 14 },
  small: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 19 },
  block: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
