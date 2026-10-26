import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { FONTS, type AppTheme } from '../constants/theme';

/** Typed access to the app theme including the extra ink tokens. */
export const useAppTheme = () => useTheme<AppTheme>();

/** Small-caps label: the app's replacement for icons. */
export function Eyebrow({ children, colour, style }: { children: ReactNode; colour?: string; style?: StyleProp<TextStyle> }) {
  const t = useAppTheme();
  return <RNText style={[styles.eyebrow, { color: colour ?? t.ink.muted }, style]}>{children}</RNText>;
}

/** Monospaced figures for times, fares and distances. */
export function Figure({ children, size = 13, colour, style }: { children: ReactNode; size?: number; colour?: string; style?: StyleProp<TextStyle> }) {
  const t = useAppTheme();
  return <RNText style={[{ fontFamily: FONTS.mono, fontSize: size, color: colour ?? t.ink.ink, letterSpacing: -0.2 }, style]}>{children}</RNText>;
}

/** Hairline rule, optionally dashed. */
export function Rule({ dashed, style }: { dashed?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useAppTheme();
  return <View style={[{ borderBottomWidth: StyleSheet.hairlineWidth * 2, borderColor: t.ink.rule, borderStyle: dashed ? 'dashed' : 'solid' }, style]} />;
}

/** Text-only action: ink underline on press, no icon. */
export function TextAction({
  label,
  onPress,
  tone = 'ink',
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'accent' | 'muted' | 'danger' | 'inverse';
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const t = useAppTheme();
  const colour = disabled ? t.ink.faint : tone === 'accent' ? t.ink.accent : tone === 'muted' ? t.ink.muted : tone === 'danger' ? t.colors.error : tone === 'inverse' ? t.ink.paper : t.ink.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      // Text is ~20 pt tall; 12 pt slop on each side gives the 44 pt minimum touch target.
      hitSlop={12}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.textAction, (pressed || hovered) && { borderColor: colour }]}
    >
      <RNText style={[styles.textActionLabel, { color: colour }]}>{label}</RNText>
    </Pressable>
  );
}

/** Solid or outlined pill button with typographic label. */
export function PillButton({
  label,
  onPress,
  variant = 'solid',
  disabled,
  colour,
  textColour,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'accent';
  disabled?: boolean;
  colour?: string;
  textColour?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const t = useAppTheme();
  const bg = variant === 'solid' ? (colour ?? t.ink.ink) : variant === 'accent' ? t.ink.accent : 'transparent';
  const fg = textColour ?? (variant === 'solid' ? t.ink.paper : variant === 'accent' ? t.ink.accentInk : t.ink.ink);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.pill,
        { backgroundColor: bg, borderColor: variant === 'outline' ? t.ink.ink : bg, opacity: disabled ? 0.35 : 1 },
        (pressed || hovered) && !disabled && { transform: [{ translateY: -1 }], opacity: 0.88 },
        style,
      ]}
    >
      <RNText style={[styles.pillLabel, { color: fg }]}>{label}</RNText>
    </Pressable>
  );
}

/** Selectable text toggle used for filters and sort options. */
export function Toggle({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.toggle,
        { borderColor: selected ? t.ink.ink : t.ink.rule, backgroundColor: selected ? t.ink.ink : hovered ? t.ink.card : 'transparent' },
      ]}
    >
      <RNText style={[styles.toggleLabel, { color: selected ? t.ink.paper : t.ink.ink }]}>{label}</RNText>
    </Pressable>
  );
}

/** Section heading with an optional right-side text action. */
export function SectionHead({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHead}>
      <Eyebrow>{title}</Eyebrow>
      {action && <TextAction label={action.label} onPress={action.onPress} tone="muted" />}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  textAction: { borderBottomWidth: 1, borderColor: 'transparent', paddingVertical: 2 },
  textActionLabel: { fontFamily: FONTS.sansSemi, fontSize: 13.5, letterSpacing: 0.1 },
  pill: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 18, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pillLabel: { fontFamily: FONTS.sansSemi, fontSize: 14.5, letterSpacing: 0.1 },
  toggle: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7, minHeight: 34, justifyContent: 'center' },
  toggleLabel: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
});
