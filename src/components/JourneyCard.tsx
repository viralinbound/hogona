import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, MODE_COLOURS } from '../constants/theme';
import type { Journey, JourneyTag } from '../types/journey';
import { formatClock, formatDistance, formatDuration } from '../utils/format';
import { fareText } from './fare-text';
import { legTagText, ModeTag } from './ModeTag';
import { Figure, useAppTheme } from './ui';

const TAG_LABEL: Record<JourneyTag, string> = {
  recommended: 'Best option',
  fastest: 'Fastest',
  cheapest: 'Cheapest',
  'least-walking': 'Least walking',
  'fewest-transfers': 'Fewest changes',
};

/** Big serif duration split into hours and minutes, e.g. "1h 23". */
function DurationDisplay({ sec, colour }: { sec: number; colour: string }) {
  const min = Math.max(1, Math.round(sec / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (
    <Text style={[styles.duration, { color: colour }]} accessibilityLabel={formatDuration(sec)}>
      {h > 0 ? (
        <>
          {h}
          <Text style={styles.unit}>h </Text>
          {m.toString().padStart(2, '0')}
        </>
      ) : (
        <>
          {m}
          <Text style={styles.unit}> min</Text>
        </>
      )}
    </Text>
  );
}

export function JourneyCard({ journey, onPress }: { journey: Journey; onPress: () => void }) {
  const t = useAppTheme();
  const fare = fareText(journey.fare, journey.modes);
  const pick = journey.tags.includes('recommended');
  const total = journey.legs.reduce((n, l) => n + l.waitSec + l.durationSec, 0) || 1;
  const route = journey.legs.filter((l) => l.mode !== 'walk' || l.distanceM > 150);
  const label = `${journey.title}. ${formatDuration(journey.durationSec)}, arrive about ${formatClock(journey.arriveAt)}. Fare ${fare.main}. Walk ${formatDistance(journey.walkM)}. ${journey.transfers} changes.`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        { backgroundColor: t.ink.card, borderColor: pick ? t.ink.ink : t.ink.rule },
        pick && styles.pickCard,
        (pressed || hovered) && { transform: [{ translateY: -2 }], borderColor: t.ink.ink },
      ]}
    >
      {journey.tags.length > 0 && (
        <Text style={[styles.tag, { color: pick ? t.ink.accent : t.ink.muted }]}>
          {pick ? '● ' : ''}
          {TAG_LABEL[journey.tags[0]]}
        </Text>
      )}

      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <DurationDisplay sec={journey.durationSec} colour={t.ink.ink} />
          <Figure size={12} colour={t.ink.muted}>
            {formatClock(journey.departAt)} — {formatClock(journey.arriveAt)}
          </Figure>
        </View>
        <View style={styles.fareBox}>
          <Text style={[fare.main.startsWith('₹') ? styles.fare : styles.fareWords, { color: t.ink.ink }]}>{fare.main}</Text>
          {fare.sub && (
            <Text style={[styles.fareSub, { color: t.ink.muted }]} numberOfLines={2}>
              {fare.sub}
            </Text>
          )}
        </View>
      </View>

      {/* Proportional bar: each leg's share of the total time, in its line colour. */}
      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {journey.legs.map((l, i) => (
          <View
            key={i}
            style={{
              flex: (l.waitSec + l.durationSec) / total,
              height: l.mode === 'walk' ? 2 : 6,
              alignSelf: 'center',
              borderRadius: 3,
              backgroundColor: l.mode === 'walk' ? t.ink.faint : l.mode === 'ride' ? t.ink.ink : (l.line?.colour ?? MODE_COLOURS[l.mode]),
            }}
          />
        ))}
      </View>

      <View style={styles.legs}>
        {route.map((l, i) => (
          <View key={i} style={styles.legItem}>
            {i > 0 && <Text style={[styles.sep, { color: t.ink.faint }]}>›</Text>}
            {l.mode === 'walk' ? (
              <Text style={[styles.walkText, { color: t.ink.muted }]}>Walk {Math.max(1, Math.round(l.durationSec / 60))}′</Text>
            ) : (
              <ModeTag leg={l} size="sm" />
            )}
          </View>
        ))}
      </View>

      <View style={[styles.meta, { borderTopColor: t.ink.rule }]}>
        <Text style={[styles.metaText, { color: t.ink.muted }]} numberOfLines={1}>
          {route.find((l) => l.mode !== 'walk') ? `Board at ${route.find((l) => l.mode !== 'walk')!.from.name}` : legTagText(journey.legs[0])}
        </Text>
        <Figure size={11.5} colour={t.ink.muted}>
          {formatDistance(journey.walkM)} walk · {journey.transfers}× change
        </Figure>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, gap: 10 },
  pickCard: { borderWidth: 1.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2 },
  tag: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' },
  top: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  duration: { fontFamily: FONTS.serif, fontSize: 44, lineHeight: 46, letterSpacing: -1.2 },
  unit: { fontFamily: FONTS.serifItalic, fontSize: 24, letterSpacing: 0 },
  fareBox: { alignItems: 'flex-end', maxWidth: '48%', paddingBottom: 2 },
  fare: { fontFamily: FONTS.monoMedium, fontSize: 20, letterSpacing: -0.5 },
  fareWords: { fontFamily: FONTS.serifItalic, fontSize: 21, letterSpacing: -0.2 },
  fareSub: { fontFamily: FONTS.sans, fontSize: 11, textAlign: 'right', marginTop: 2 },
  bar: { flexDirection: 'row', gap: 3, height: 8, marginTop: 2 },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 6 },
  legItem: { flexDirection: 'row', alignItems: 'center' },
  sep: { fontFamily: FONTS.sans, fontSize: 16, marginHorizontal: 6 },
  walkText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 10, marginTop: 2 },
  metaText: { fontFamily: FONTS.sans, fontSize: 12.5, flex: 1 },
});
