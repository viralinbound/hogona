import { StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../constants/theme';
import { datasetManifest } from '../services/transport-data';
import type { Basis } from '../types/journey';
import { useAppTheme } from './ui';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown';

/** One-line statement of where the routes, fares and times come from and how old they are. */
export function DataFreshnessLabel({ compact = false }: { compact?: boolean }) {
  const t = useAppTheme();
  const m = datasetManifest.datasets;
  const text = compact
    ? `Static data · metro: OpenStreetMap ${fmt(m.metro.osmSnapshot)} · buses: community BMTC data ${fmt(m.bmtc.importedOn)} · nothing live`
    : `Metro from OpenStreetMap (${fmt(m.metro.osmSnapshot)}). Buses from unofficial community BMTC data, taken from the Namma BMTC app (${fmt(m.bmtc.importedOn)}). Times are planned estimates — nothing here is live.`;
  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={[styles.dot, { backgroundColor: t.ink.faint }]} />
      <Text style={[styles.text, { color: t.ink.muted }]}>{text}</Text>
    </View>
  );
}

const BASIS_TEXT: Record<Basis, string> = {
  estimated: 'est.',
  assumed: 'assumed',
  published: 'published',
  routed: 'routed',
  unknown: 'unknown',
};

/** Tiny italic note saying how a number was obtained. */
export function BasisTag({ basis }: { basis: Basis }) {
  const t = useAppTheme();
  return (
    <Text style={[styles.basis, { color: basis === 'assumed' ? t.ink.warn : t.ink.faint }]} accessibilityLabel={`${BASIS_TEXT[basis]} value`}>
      {BASIS_TEXT[basis]}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  text: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, flex: 1 },
  basis: { fontFamily: FONTS.serifItalic, fontSize: 14 },
});
