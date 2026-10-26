import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Logo } from '../components/Logo';
import { Eyebrow, TextAction, useAppTheme } from '../components/ui';
import { DISCLAIMER, POLICY_UPDATED, PRIVACY_SECTIONS, SUPPORT_EMAIL } from '../constants/legal';
import { FONTS } from '../constants/theme';
import { useLayout } from '../hooks/useLayout';
import { openFirst } from '../services/external-links/open';

/** Privacy policy, disclaimer, data credits and support — reachable from Settings (store requirement). */
export default function AboutScreen() {
  const t = useAppTheme();
  const { gutter } = useLayout();
  return (
    <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      <Logo size={40} />
      <Eyebrow>Updated {POLICY_UPDATED}</Eyebrow>
      <Text style={[styles.title, { color: t.ink.ink }]} accessibilityRole="header">
        Privacy policy
      </Text>
      {PRIVACY_SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={[styles.h2, { color: t.ink.ink }]} accessibilityRole="header">
            {s.title}
          </Text>
          <Text style={[styles.body, { color: t.ink.muted }]}>{s.body}</Text>
        </View>
      ))}

      <View style={[styles.box, { backgroundColor: t.ink.warnWash }]}>
        <Eyebrow colour={t.ink.warn}>Please note</Eyebrow>
        <Text style={[styles.body, { color: t.ink.warn }]}>{DISCLAIMER}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.h2, { color: t.ink.ink }]}>Data and credits</Text>
        <Text style={[styles.body, { color: t.ink.muted }]}>
          Metro station and map data © OpenStreetMap contributors (ODbL). BMTC and KSRTC bus routes, stops, timetables and fares: unofficial community dataset “bmtc-gtfs” by Vonter (ODbL), taken from the Namma BMTC app — not published or endorsed by BMTC and may contain errors. Fonts: Instrument Serif, Inter and JetBrains Mono (SIL Open Font License).
        </Text>
        <TextAction label="OpenStreetMap copyright" onPress={() => void openFirst(['https://www.openstreetmap.org/copyright'])} />
      </View>

      {SUPPORT_EMAIL ? (
        <View style={styles.section}>
          <Text style={[styles.h2, { color: t.ink.ink }]}>Contact</Text>
          <TextAction label={SUPPORT_EMAIL} onPress={() => void openFirst([`mailto:${SUPPORT_EMAIL}`])} />
        </View>
      ) : null}

      <Text style={[styles.body, { color: t.ink.faint, textAlign: 'center', marginTop: 12 }]}>Hogona 1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 56, gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontFamily: FONTS.serif, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  section: { gap: 6 },
  h2: { fontFamily: FONTS.sansSemi, fontSize: 16 },
  body: { fontFamily: FONTS.sans, fontSize: 14.5, lineHeight: 22 },
  box: { borderRadius: 14, padding: 14, gap: 6 },
});
