import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Dialog, Portal, Snackbar, Switch } from 'react-native-paper';
import { Logo } from '../../components/Logo';
import { Eyebrow, Figure, PillButton, Rule, TextAction, Toggle, useAppTheme } from '../../components/ui';
import { FONTS } from '../../constants/theme';
import { useHandoff } from '../../features/handoff/useHandoff';
import { RIDE_ASSUMPTIONS } from '../../features/ride/estimate';
import { appConfig } from '../../services/config';
import { dataIssues, datasetManifest, transportData } from '../../services/transport-data';
import { LANGUAGES, useT } from '../../i18n';
import { useAppState } from '../../state/AppState';

const WALK_OPTIONS = [500, 800, 1200, 2000];

export default function SettingsScreen() {
  const t = useAppTheme();
  const tr = useT();
  const { prefs, setPrefs, eraseData } = useAppState();
  const handoff = useHandoff();
  const [confirmErase, setConfirmErase] = useState(false);
  const [snack, setSnack] = useState('');
  const issues = dataIssues();
  const m = datasetManifest.datasets;

  return (
    <>
      <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={styles.content}>
        <Section title={tr('Language')}>
          <View style={styles.options}>
            {LANGUAGES.map((l) => (
              <Toggle key={l.id} label={l.label} selected={prefs.language === l.id} onPress={() => setPrefs({ ...prefs, language: l.id })} />
            ))}
          </View>
          <Text style={[styles.note, { color: t.ink.muted }]}>{tr('Station, stop and route names stay as published.')}</Text>
        </Section>

        <Section title={tr('Your travel')}>
          <Label text="Longest walk to a stop" />
          <View style={styles.options}>
            {WALK_OPTIONS.map((v) => (
              <Toggle key={v} label={v >= 1000 ? `${v / 1000} km` : `${v} m`} selected={prefs.maxWalkM === v} onPress={() => setPrefs({ ...prefs, maxWalkM: v })} />
            ))}
          </View>
          <Label text="Most changes" />
          <View style={styles.options}>
            {[0, 1, 2, 3].map((v) => (
              <Toggle key={v} label={v === 0 ? 'Direct only' : String(v)} selected={prefs.maxTransfers === v} onPress={() => setPrefs({ ...prefs, maxTransfers: v })} />
            ))}
          </View>
          <Rule style={{ marginVertical: 6 }} />
          <SwitchRow title="Namma Metro" value={prefs.modes.metro} onChange={(v) => setPrefs({ ...prefs, modes: { ...prefs.modes, metro: v } })} />
          <SwitchRow title="BMTC buses" value={prefs.modes.bus} onChange={(v) => setPrefs({ ...prefs, modes: { ...prefs.modes, bus: v } })} />
          <SwitchRow title="Cabs and autos" note="Uber, Ola, Rapido, Namma Yatri, inDrive, Quick Ride" value={prefs.modes.ride} onChange={(v) => setPrefs({ ...prefs, modes: { ...prefs.modes, ride: v } })} />
          <SwitchRow title="Shakti scheme" note="Free non-AC BMTC travel for women resident in Karnataka" value={prefs.shakti} onChange={(v) => setPrefs({ ...prefs, shakti: v })} />
          <Text style={[styles.note, { color: t.ink.muted }]}>
            Step-free and lift routing isn’t offered — there’s no verified station accessibility data yet. A shorter walk limit helps reduce walking.
          </Text>
        </Section>

        <Section title={tr('Where the data comes from')}>
          <Info label="Metro" value={`${transportData.lines.length} lines, ${transportData.stations.length} stations. ${m.metro.licence}. Snapshot ${m.metro.osmSnapshot?.slice(0, 10) ?? 'n/a'}.`} />
          <Info label="BMTC" value={`${transportData.routes.length} routes, ${transportData.stops.length} stops. ${m.bmtc.coverage}`} />
          <Info label="Timings" value="Yellow Line hours and frequency as reported; Purple and Green unverified. No BMTC timetable." />
          <Info label="Fares" value={`Metro slabs from ${transportData.fares.metro.effectiveFrom}; BMTC stages up to ${transportData.fares.bmtc.ordinaryVerifiedUptoKm} km. Checked ${m.fares.verifiedOn}.`} />
          <Info label="Rides" value={RIDE_ASSUMPTIONS.explanation} />
          <Info label="Online" value={`Address search ${appConfig.geocoderUrl ? 'on' : 'off'}; street paths ${appConfig.walkRoutingUrl ? 'on' : 'off'}. Everything else works offline.`} />
          <Info
            label="Checks"
            value={issues.length === 0 ? 'All dataset checks passed.' : `${issues.filter((i) => i.level === 'error').length} errors, ${issues.filter((i) => i.level === 'warning').length} notes (e.g. ${issues[0].message}).`}
          />
          <View style={styles.links}>
            <TextAction label="Official metro timings" onPress={async () => setSnack(await handoff.openWebsite(transportData.metroService.officialTimingsUrl, 'BMRCL metro timings'))} />
            <TextAction label="Official metro map" onPress={async () => setSnack(await handoff.openWebsite(transportData.metroService.officialMapUrl, 'BMRCL route map'))} />
            <TextAction label="BMTC website" onPress={async () => setSnack(await handoff.openWebsite('https://mybmtc.karnataka.gov.in/', 'BMTC website'))} />
          </View>
        </Section>

        <Section title={tr('Privacy')}>
          <Text style={[styles.note, { color: t.ink.muted }]}>
            No account and no server. Preferences, saved places, searches and the activity log stay on this phone. Address searches go to the geocoder; your location is read only when you ask.
          </Text>
          <TextAction label="Read the full privacy policy" onPress={() => router.push('/about')} />
          <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <PillButton label="Erase everything on this phone" variant="outline" textColour={t.colors.error} onPress={() => setConfirmErase(true)} />
          </View>
        </Section>

        <View style={styles.colophon}>
          <Logo size={36} />
          <Text style={[styles.note, { color: t.ink.faint, textAlign: 'center' }]}>
            Version 1.0 · Map data © OpenStreetMap contributors (ODbL){'\n'}Not affiliated with BMRCL, BMTC or any ride company.
          </Text>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={confirmErase} onDismiss={() => setConfirmErase(false)} style={[styles.dialog, { backgroundColor: t.ink.card }]}>
          <View style={styles.dialogBody}>
            <Text style={[styles.dialogTitle, { color: t.ink.ink }]}>Erase everything?</Text>
            <Text style={[styles.note, { color: t.ink.muted }]}>Removes preferences, saved places, searches and the activity log from this phone. This can’t be undone.</Text>
            <View style={styles.dialogActions}>
              <TextAction label="Keep it" tone="muted" onPress={() => setConfirmErase(false)} />
              <PillButton
                label="Erase"
                colour={t.colors.error}
                onPress={async () => {
                  await eraseData();
                  setConfirmErase(false);
                  setSnack('Everything on this phone was erased.');
                }}
              />
            </View>
          </View>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')}>
        {snack}
      </Snackbar>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.ink.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Eyebrow style={{ marginTop: 6 }}>{text}</Eyebrow>;
}

function SwitchRow({ title, note, value, onChange }: { title: string; note?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useAppTheme();
  return (
    <View style={[styles.switchRow, { borderBottomColor: t.ink.rule }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.ink.ink }]}>{title}</Text>
        {note && <Text style={[styles.note, { color: t.ink.muted }]}>{note}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} color={t.ink.accent} accessibilityLabel={title} />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const t = useAppTheme();
  return (
    <View style={styles.info}>
      <Text style={[styles.infoLabel, { color: t.ink.faint }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.note, { color: t.ink.muted, flex: 1 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 34, paddingBottom: 56, maxWidth: 760, width: '100%', alignSelf: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontFamily: FONTS.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  rowTitle: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  note: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  step: { minHeight: 36, minWidth: 44, paddingHorizontal: 0 },
  weightValue: { width: 24, textAlign: 'center' },
  info: { flexDirection: 'row', gap: 12 },
  infoLabel: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.3, width: 64, paddingTop: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 4 },
  colophon: { alignItems: 'center', gap: 6, paddingTop: 10 },
  colophonName: { fontFamily: FONTS.serifItalic, fontSize: 30 },
  dialog: { borderRadius: 22, maxWidth: 420, alignSelf: 'center', width: '90%' },
  dialogBody: { padding: 22, gap: 12 },
  dialogTitle: { fontFamily: FONTS.serif, fontSize: 28, letterSpacing: -0.4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, marginTop: 4 },
});
