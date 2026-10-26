import { StyleSheet, Text, View } from 'react-native';
import { FONTS, MODE_COLOURS } from '../constants/theme';
import type { Leg, LegMode } from '../types/journey';
import { useAppTheme } from './ui';

export const MODE_NAMES: Record<LegMode, string> = { walk: 'Walk', metro: 'Metro', bus: 'BMTC bus', ride: 'Cab / auto', train: 'Train' };

/** What a leg is called on its tag: the line, the bus number, or the mode. */
export function legTagText(leg: Pick<Leg, 'mode' | 'line' | 'route'>): string {
  if (leg.mode === 'metro') return leg.line?.name.replace(' Line', '') ?? 'Metro';
  if (leg.mode === 'bus' && leg.route?.operator === 'KSRTC') return 'KSRTC';
  if (leg.mode === 'bus') return leg.route?.ref ? `Bus ${leg.route.ref}` : 'Bus';
  if (leg.mode === 'ride') return 'Ride';
  if (leg.mode === 'train') return 'Train';
  return 'Walk';
}

/**
 * Typographic mode marker (the app uses no icons). Vehicles get a solid
 * line-coloured tag; walking is plain muted text.
 */
export function ModeTag({ leg, size = 'md' }: { leg: Pick<Leg, 'mode' | 'line' | 'route'>; size?: 'sm' | 'md' }) {
  const t = useAppTheme();
  const text = legTagText(leg);
  const sm = size === 'sm';
  if (leg.mode === 'walk')
    return (
      <Text style={[styles.walk, { color: t.ink.muted, fontSize: sm ? 10.5 : 11.5 }]} accessibilityLabel="Walk">
        {text.toUpperCase()}
      </Text>
    );
  const bg = leg.line?.colour ?? MODE_COLOURS[leg.mode];
  return (
    <View style={[styles.tag, sm && styles.tagSm, { backgroundColor: leg.mode === 'ride' ? t.ink.ink : bg }]} accessibilityLabel={`${MODE_NAMES[leg.mode]} ${text}`}>
      <Text style={[styles.text, { fontSize: sm ? 10.5 : 11.5, color: leg.mode === 'ride' ? t.ink.paper : '#FFFFFF' }]} numberOfLines={1}>
        {text.toUpperCase()}
      </Text>
    </View>
  );
}

/** Coloured stripe standing in for a metro line or bus route. */
export function LineSwatch({ colour, width = 18 }: { colour: string; width?: number }) {
  return <View style={{ width, height: 4, borderRadius: 2, backgroundColor: colour }} />;
}

const styles = StyleSheet.create({
  tag: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 150 },
  tagSm: { paddingHorizontal: 5, paddingVertical: 2 },
  text: { fontFamily: FONTS.sansBold, letterSpacing: 0.9 },
  walk: { fontFamily: FONTS.sansSemi, letterSpacing: 0.9 },
});
