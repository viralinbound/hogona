import { StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../constants/theme';
import type { Journey } from '../types/journey';
import { formatClock } from '../utils/format';
import { TransportLeg, type LegActions } from './TransportLeg';
import { Figure, useAppTheme } from './ui';

export function JourneyTimeline({ journey, actions }: { journey: Journey; actions: LegActions }) {
  const t = useAppTheme();
  let clock = journey.departAt;
  const starts = journey.legs.map((l) => {
    const s = clock;
    clock += (l.waitSec + l.durationSec) * 1000;
    return s;
  });
  const last = journey.legs[journey.legs.length - 1];

  return (
    <View accessibilityRole="list">
      {journey.legs.map((leg, i) => (
        <TransportLeg key={i} leg={leg} startAt={starts[i]} actions={actions} />
      ))}
      <View style={styles.end}>
        <View style={styles.gutter}>
          <Figure size={12} colour={t.ink.muted}>
            ~{formatClock(journey.arriveAt).replace(' ', '\n')}
          </Figure>
        </View>
        <View style={styles.rail}>
          <View style={[styles.square, { backgroundColor: t.ink.ink }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: t.ink.muted }]}>ARRIVE</Text>
          <Text style={[styles.title, { color: t.ink.ink }]}>{last.to.name}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  end: { flexDirection: 'row' },
  gutter: { width: 54 },
  rail: { width: 20, marginRight: 12, alignItems: 'center' },
  square: { width: 12, height: 12, marginTop: 2 },
  label: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.4 },
  title: { fontFamily: FONTS.serif, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
});
