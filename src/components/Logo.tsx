import { Image, StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../constants/theme';
import { useAppTheme } from './ui';

const MARK = require('../../assets/brand/logo-mark.png');

/**
 * Hogona logo: green tile with the italic "h" and marigold stop dot, plus the
 * serif wordmark. `variant="mark"` shows the tile alone (headers, small spaces).
 */
export function Logo({ size = 40, variant = 'full', tagline = false }: { size?: number; variant?: 'full' | 'mark'; tagline?: boolean }) {
  const t = useAppTheme();
  const mark = <Image source={MARK} style={{ width: size, height: size }} accessibilityIgnoresInvertColors resizeMode="contain" />;
  if (variant === 'mark')
    return (
      <View accessible accessibilityRole="image" accessibilityLabel="Hogona">
        {mark}
      </View>
    );
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="Hogona">
      {mark}
      <View>
        {tagline && <Text style={[styles.tag, { color: t.ink.muted, fontSize: Math.max(11, size * 0.2) }]}>BENGALURU · METRO · BUS · RIDES</Text>}
        <Text style={[styles.word, { color: t.ink.ink, fontSize: size * 0.95, lineHeight: size * 1.02 }]}>Hogona</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { fontFamily: FONTS.serif, letterSpacing: -1 },
  tag: { fontFamily: FONTS.sansSemi, letterSpacing: 1.2 },
});
