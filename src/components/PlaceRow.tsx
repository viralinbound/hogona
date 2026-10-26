import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS } from '../constants/theme';
import { useAppTheme } from './ui';

/**
 * List row with an optional short leading marker (e.g. a line swatch or a
 * two-letter kind like "MT"), a title, a subtitle and a right-hand action.
 */
export function PlaceRow({
  lead,
  title,
  subtitle,
  onPress,
  hint,
  right,
}: {
  lead?: ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  hint?: string;
  right?: ReactNode;
}) {
  const t = useAppTheme();
  // `right` sits beside the pressable, not inside it: nested buttons are invalid on web.
  return (
    <View style={[styles.wrap, { borderBottomColor: t.ink.rule }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        accessibilityHint={hint}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (pressed || hovered) && { opacity: 0.7 }]}
      >
        {lead !== undefined && <View style={styles.lead}>{lead}</View>}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.ink.ink }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.sub, { color: t.ink.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

/** Two-to-four letter kind marker used as a row lead. */
export function KindMark({ text, colour }: { text: string; colour?: string }) {
  const t = useAppTheme();
  return <Text style={[styles.kind, { color: colour ?? t.ink.faint, borderColor: colour ?? t.ink.rule }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, minHeight: 52 },
  lead: { width: 40, alignItems: 'flex-start' },
  title: { fontFamily: FONTS.sansMedium, fontSize: 15.5, letterSpacing: -0.15 },
  sub: { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 1 },
  kind: { fontFamily: FONTS.sansBold, fontSize: 11, letterSpacing: 1, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, overflow: 'hidden' },
});
