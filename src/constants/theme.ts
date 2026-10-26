import { configureFonts, MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Hogona design language — "printed timetable".
 * Warm paper, ink-black type, one forest-green accent (Bengaluru, the garden
 * city). Instrument Serif for big editorial numbers and headings, Inter for
 * reading, JetBrains Mono for times and fares. No icons: modes are named in
 * small caps and coloured by their line.
 */
export const FONTS = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const MODE_COLOURS = {
  walk: '#8A867C',
  metro: '#7A3E9D',
  bus: '#2F6B3F',
  ride: '#1B1C1F',
  train: '#1F3A6B',
} as const;

export const LINE_COLOURS: Record<string, string> = {
  purple: '#7A3E9D',
  green: '#1E8A47',
  yellow: '#C79300',
};

/** Extra tokens Paper's theme has no slot for. */
export interface Ink {
  paper: string;
  card: string;
  ink: string;
  muted: string;
  faint: string;
  rule: string;
  accent: string;
  accentInk: string;
  accentWash: string;
  warn: string;
  warnWash: string;
}

const LIGHT_INK: Ink = {
  paper: '#F3EFE6',
  card: '#FBF9F4',
  ink: '#17181C',
  muted: '#62605A',
  faint: '#9A968C',
  rule: '#DCD6C9',
  accent: '#1F5A43',
  accentInk: '#FBF9F4',
  accentWash: '#E2ECE5',
  warn: '#8A4B0F',
  warnWash: '#F4E6D3',
};

const DARK_INK: Ink = {
  paper: '#121311',
  card: '#1A1B19',
  ink: '#ECE8DF',
  muted: '#A7A397',
  faint: '#6E6B63',
  rule: '#2C2D29',
  accent: '#8CC5A6',
  accentInk: '#0F1A14',
  accentWash: '#1D2B23',
  warn: '#E8B37A',
  warnWash: '#2E2418',
};

const fonts = configureFonts({
  config: {
    displayLarge: { fontFamily: FONTS.serif, fontWeight: '400', fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
    displayMedium: { fontFamily: FONTS.serif, fontWeight: '400', fontSize: 44, lineHeight: 48, letterSpacing: -1 },
    displaySmall: { fontFamily: FONTS.serif, fontWeight: '400', fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
    headlineLarge: { fontFamily: FONTS.serif, fontWeight: '400', fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
    headlineMedium: { fontFamily: FONTS.serif, fontWeight: '400', fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
    headlineSmall: { fontFamily: FONTS.serif, fontWeight: '400', fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
    titleLarge: { fontFamily: FONTS.sansSemi, fontWeight: '400', fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
    titleMedium: { fontFamily: FONTS.sansSemi, fontWeight: '400', fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
    titleSmall: { fontFamily: FONTS.sansSemi, fontWeight: '400', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    bodyLarge: { fontFamily: FONTS.sans, fontWeight: '400', fontSize: 16, lineHeight: 24, letterSpacing: -0.1 },
    bodyMedium: { fontFamily: FONTS.sans, fontWeight: '400', fontSize: 14, lineHeight: 21, letterSpacing: 0 },
    bodySmall: { fontFamily: FONTS.sans, fontWeight: '400', fontSize: 12.5, lineHeight: 18, letterSpacing: 0.05 },
    labelLarge: { fontFamily: FONTS.sansSemi, fontWeight: '400', fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
    labelMedium: { fontFamily: FONTS.sansMedium, fontWeight: '400', fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
    labelSmall: { fontFamily: FONTS.sansMedium, fontWeight: '400', fontSize: 11, lineHeight: 15, letterSpacing: 0.4 },
    default: { fontFamily: FONTS.sans, fontWeight: '400', letterSpacing: 0, fontSize: 14, lineHeight: 20 },
  },
});

function paperTheme(base: MD3Theme, k: Ink, dark: boolean): MD3Theme & { ink: Ink } {
  return {
    ...base,
    dark,
    roundness: 2,
    fonts,
    ink: k,
    colors: {
      ...base.colors,
      primary: k.ink,
      onPrimary: k.paper,
      primaryContainer: k.accentWash,
      onPrimaryContainer: k.ink,
      secondary: k.accent,
      onSecondary: k.accentInk,
      secondaryContainer: k.accentWash,
      onSecondaryContainer: k.ink,
      tertiary: k.accent,
      background: k.paper,
      surface: k.card,
      surfaceVariant: dark ? '#22231F' : '#ECE7DC',
      onSurface: k.ink,
      onSurfaceVariant: k.muted,
      onBackground: k.ink,
      outline: k.rule,
      outlineVariant: k.rule,
      error: dark ? '#F2A99B' : '#A3341F',
      errorContainer: k.warnWash,
      onErrorContainer: k.warn,
      inverseSurface: k.ink,
      inverseOnSurface: k.paper,
      backdrop: dark ? 'rgba(0,0,0,0.6)' : 'rgba(23,24,28,0.35)',
      elevation: { level0: 'transparent', level1: k.card, level2: k.card, level3: k.card, level4: k.card, level5: k.card },
    },
  };
}

export type AppTheme = MD3Theme & { ink: Ink };
export const lightTheme: AppTheme = paperTheme(MD3LightTheme, LIGHT_INK, false);
export const darkTheme: AppTheme = paperTheme(MD3DarkTheme, DARK_INK, true);
