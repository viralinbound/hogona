import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../constants/theme';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import type { Place } from '../types/journey';
import { formatClock } from '../utils/format';
import { Figure, PillButton, TextAction, Toggle, useAppTheme } from './ui';

const LEAVE_OPTIONS: { label: string; offsetMin: number | null }[] = [
  { label: 'Leave now', offsetMin: null },
  { label: 'In 30 min', offsetMin: 30 },
  { label: 'In 1 hour', offsetMin: 60 },
];

/** "Ticket stub" form: two lines like a printed From / To, then when, then go. */
export function OriginDestinationForm({ onSearch }: { onSearch: () => void }) {
  const t = useAppTheme();
  const tr = useT();
  const { origin, destination, swap, departAt, setDepartAt } = useAppState();
  const offset = departAt === null ? null : Math.round((departAt - Date.now()) / 60000 / 15) * 15;

  return (
    <View style={[styles.card, { backgroundColor: t.ink.card, borderColor: t.ink.rule }]}>
      <Field label={tr('From')} place={origin} placeholder={tr('Where are you starting?')} field="origin" />
      <View style={styles.divider}>
        <View style={[styles.dash, { borderColor: t.ink.rule }]} />
        <TextAction label={tr('Swap')} onPress={swap} tone="muted" disabled={!origin && !destination} accessibilityHint="Swaps start and destination" />
      </View>
      <Field label={tr('To')} place={destination} placeholder={tr('Where are you going?')} field="destination" />

      <View style={[styles.when, { borderTopColor: t.ink.rule }]}>
        <View style={styles.leaveRow}>
          {LEAVE_OPTIONS.map((o) => (
            <Toggle
              key={o.label}
              label={tr(o.label)}
              selected={o.offsetMin === null ? departAt === null : offset === o.offsetMin}
              onPress={() => setDepartAt(o.offsetMin === null ? null : Date.now() + o.offsetMin * 60000)}
            />
          ))}
        </View>
        {departAt !== null && (
          <Figure size={12} colour={t.ink.muted}>
            {tr('Leaving about {time}', { time: formatClock(departAt) })}
          </Figure>
        )}
      </View>

      <PillButton label={tr('Find journeys')} onPress={onSearch} disabled={!origin || !destination} style={{ minHeight: 52 }} />
    </View>
  );
}

function Field({ label, place, placeholder, field }: { label: string; place: Place | null; placeholder: string; field: 'origin' | 'destination' }) {
  const t = useAppTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/place-search', params: { field } })}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${place ? place.name : 'not set'}. Double tap to change.`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.field, hovered && { opacity: 0.75 }]}
    >
      <Text style={[styles.fieldLabel, { color: t.ink.faint }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.fieldValue, { color: place ? t.ink.ink : t.ink.faint }]} numberOfLines={1}>
        {place ? place.name : placeholder}
      </Text>
      {place?.subtitle && (
        <Text style={[styles.fieldSub, { color: t.ink.muted }]} numberOfLines={1}>
          {place.subtitle}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, gap: 4 },
  field: { paddingVertical: 6, minHeight: 56 },
  fieldLabel: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.6 },
  fieldValue: { fontFamily: FONTS.serif, fontSize: 27, lineHeight: 32, letterSpacing: -0.4 },
  fieldSub: { fontFamily: FONTS.sans, fontSize: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dash: { flex: 1, borderBottomWidth: 1.5, borderStyle: 'dashed' },
  when: { borderTopWidth: StyleSheet.hairlineWidth * 2, marginTop: 10, paddingTop: 12, paddingBottom: 12, gap: 8 },
  leaveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
