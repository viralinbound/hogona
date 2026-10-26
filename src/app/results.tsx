import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { sortJourneys } from '../algorithms/journey-ranking';
import { DataFreshnessLabel } from '../components/DataFreshnessLabel';
import { IntercityCard } from '../components/IntercityCard';
import { JourneyCard } from '../components/JourneyCard';
import { RouteFilters } from '../components/RouteFilters';
import { Eyebrow, PillButton, useAppTheme } from '../components/ui';
import { FONTS } from '../constants/theme';
import { useLayout } from '../hooks/useLayout';
import { useT } from '../i18n';
import { rainSoon, type RainNotice } from '../services/weather';
import { useAppState } from '../state/AppState';
import type { SortKey } from '../types/journey';

export default function ResultsScreen() {
  const t = useAppTheme();
  const tr = useT();
  const { wide } = useLayout();
  const { plan, runPlan } = useAppState();
  const [snack, setSnack] = useState('');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [rain, setRain] = useState<RainNotice | null>(null);

  // Rain notice for the start point, only for trips leaving within the next few hours.
  const o = plan.origin;
  useEffect(() => {
    setRain(null);
    if (!o || plan.status !== 'done' || (plan.departAt ?? Date.now()) - Date.now() > 3 * 3600_000) return;
    const ctrl = new AbortController();
    void rainSoon(o.lat, o.lon, ctrl.signal).then(setRain);
    return () => ctrl.abort();
  }, [o, plan.status, plan.departAt]);

  const journeys = useMemo(() => {
    const list = plan.result?.journeys ?? [];
    return sortJourneys(list, sort);
  }, [plan.result, sort]);

  if (plan.status === 'planning' || plan.status === 'idle')
    return (
      <View style={[styles.center, { backgroundColor: t.ink.paper }]}>
        <ActivityIndicator color={t.ink.ink} />
        <Text style={[styles.centerTitle, { color: t.ink.ink }]}>{tr('Working out your options…')}</Text>
        <Text style={[styles.centerSub, { color: t.ink.muted }]}>{tr('Calculated on this phone from bundled metro and bus data.')}</Text>
      </View>
    );

  if (plan.status === 'error')
    return (
      <View style={[styles.center, { backgroundColor: t.ink.paper }]}>
        <Text style={[styles.centerTitle, { color: t.ink.ink }]}>{tr('Couldn’t plan this one')}</Text>
        <Text style={[styles.centerSub, { color: t.ink.muted }]}>{plan.error}</Text>
        <PillButton label={tr('Change places')} onPress={() => router.back()} />
      </View>
    );

  // The intercity card already explains the KSRTC hand-off; don't repeat it as a notice.
  const notices = (plan.result?.notices ?? []).filter((n) => !(plan.result?.intercity && n.startsWith('Buses outside Bengaluru')));

  return (
    <>
    <FlatList
      style={{ backgroundColor: t.ink.paper }}
      data={journeys}
      keyExtractor={(j) => j.id}
      // Two cards per row on tablets; the key forces a re-mount when columns change.
      key={wide ? 'grid' : 'list'}
      numColumns={wide ? 2 : 1}
      columnWrapperStyle={wide ? styles.gridRow : undefined}
      contentContainerStyle={[styles.list, wide && styles.listWide]}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.pad}>
            <Eyebrow>{plan.result?.journeys.length ?? 0} ways to go</Eyebrow>
            <Text style={[styles.route, { color: t.ink.ink }]} numberOfLines={3}>
              {plan.origin?.name}
              <Text style={{ fontFamily: FONTS.serifItalic, color: t.ink.muted }}> to </Text>
              {plan.destination?.name}
            </Text>
          </View>
          {plan.result?.intercity && <IntercityCard
              info={plan.result.intercity}
              onMessage={setSnack}
            />}
          {rain && plan.result?.journeys.some((j) => j.modes.includes('metro')) && (
            <View style={[styles.notice, { backgroundColor: t.ink.card, borderWidth: 1, borderColor: t.ink.rule }]}>
              <Text style={[styles.noticeText, { color: t.ink.ink }]}>
                {rain.current
                  ? tr('Rain likely in the next hour ({p}% chance). The metro avoids flooded roads and jams.', { p: rain.probability })
                  : tr('Rain likely around {time} ({p}% chance). The metro avoids flooded roads and jams.', { time: rain.time, p: rain.probability })}
              </Text>
              <Text style={[styles.noticeText, { color: t.ink.faint }]}>{tr('Forecast from Open-Meteo')}</Text>
            </View>
          )}
          <RouteFilters sort={sort} onSort={setSort} />
          {notices.map((n) => (
            <View key={n} style={[styles.notice, { backgroundColor: t.ink.warnWash }]}>
              <Text style={[styles.noticeText, { color: t.ink.warn }]}>{n}</Text>
            </View>
          ))}
        </View>
      }
      renderItem={({ item }) => <View style={wide ? styles.gridCell : undefined}><JourneyCard journey={item} onPress={() => router.push({ pathname: '/journey/[id]', params: { id: item.id } })} /></View>}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.centerTitle, { color: t.ink.ink }]}>Nothing to show</Text>
          <Text style={[styles.centerSub, { color: t.ink.muted }]}>
            Try a longer walking limit in Settings, or pick places nearer a metro station or bus stop.
          </Text>
          <PillButton label="Search again" variant="outline" onPress={() => void runPlan()} />
        </View>
      }
      ListFooterComponent={
        <View style={[styles.footer, { borderTopColor: t.ink.rule }]}>
          <DataFreshnessLabel />
        </View>
      }
    />
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={5000}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  centerTitle: { fontFamily: FONTS.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, textAlign: 'center' },
  centerSub: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { gap: 14, marginHorizontal: -20, marginBottom: 18 },
  pad: { paddingHorizontal: 20, gap: 6 },
  route: { fontFamily: FONTS.serif, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  notice: { borderRadius: 12, padding: 12, marginHorizontal: 20 },
  noticeText: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  listWide: { maxWidth: 1180 },
  // Fixed half width so an odd last card doesn't stretch across both columns.
  gridCell: { width: '46%' },
  gridRow: { justifyContent: 'space-between' },
  hint: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, paddingHorizontal: 20 },
  empty: { alignItems: 'center', gap: 12, padding: 24 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth * 2, marginTop: 24, paddingTop: 16 },
});
