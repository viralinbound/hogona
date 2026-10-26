import { StyleSheet, Text, View } from 'react-native';
import type { IntercityInfo } from '../algorithms/intercity';
import { FONTS } from '../constants/theme';
import { useHandoff } from '../features/handoff/useHandoff';
import { Eyebrow, PillButton, useAppTheme } from './ui';

/**
 * Header for a trip that leaves Bengaluru. The journeys below are door to door
 * (city part + KSRTC bus or train + the other end); this card only says how the
 * intercity part is worked out and offers the operators' own apps.
 */
export function IntercityCard({ info, onMessage, compact = false }: { info: IntercityInfo; onMessage: (m: string) => void; compact?: boolean }) {
  const t = useAppTheme();
  const handoff = useHandoff();

  return (
    <View style={[styles.card, { backgroundColor: t.ink.card, borderColor: t.ink.rule }]}>
      <Eyebrow>{info.rail ? 'Intercity · KSRTC and Indian Railways' : 'Intercity · KSRTC'}</Eyebrow>
      <Text style={[compact ? styles.titleSm : styles.title, { color: t.ink.ink }]}>
        {info.from.name} → {info.to.name}
      </Text>
      {!compact && (
        <Text style={[styles.body, { color: t.ink.muted }]}>
          Every option is door to door{info.rail ? `, by KSRTC bus or by train (${info.rail.from.code} → ${info.rail.to.code})` : ' by KSRTC bus'}. City parts use the real metro and bus
          network; intercity times are estimated from distance. The bus and train steps open the real departures, fares and booking.
        </Text>
      )}
      <View style={styles.actions}>
        <PillButton label="KSRTC app" variant="outline" onPress={async () => onMessage(await handoff.openOperatorApp('ksrtc'))} />
        {info.rail && <PillButton label="IRCTC app" variant="outline" onPress={async () => onMessage(await handoff.openOperatorApp('irctc'))} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10, marginHorizontal: 20 },
  title: { fontFamily: FONTS.serif, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  titleSm: { fontFamily: FONTS.serif, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
