import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { railStation, trainSearchUrl } from '../../algorithms/rail';
import { Eyebrow, PillButton, TextAction, useAppTheme } from '../../components/ui';
import { WhatsAppTicketDialog } from '../../components/WhatsAppTicketDialog';
import { FONTS } from '../../constants/theme';
import { bookingSteps, type BookingStep } from '../../features/handoff/booking-steps';
import { useHandoff } from '../../features/handoff/useHandoff';
import { RIDE_APPS } from '../../features/ride/providers';
import { useLayout } from '../../hooks/useLayout';
import { useAppState } from '../../state/AppState';
import { formatClock } from '../../utils/format';

/**
 * Guided booking: walks the user through every ticket/ride the journey needs,
 * in order, opening the right official app for each. Nothing is booked here;
 * the user ticks each step once they've done it in the other app.
 */
export default function BookJourneyScreen() {
  const t = useAppTheme();
  const { gutter } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJourney } = useAppState();
  const journey = getJourney(id);
  const handoff = useHandoff();
  const steps = useMemo(() => (journey ? bookingSteps(journey) : []), [journey]);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [snack, setSnack] = useState('');
  const [waStep, setWaStep] = useState<BookingStep | null>(null);

  if (!journey)
    return (
      <View style={[styles.center, { backgroundColor: t.ink.paper }]}>
        <Text style={[styles.title, { color: t.ink.ink }]}>This journey has gone</Text>
        <PillButton label="Plan a journey" onPress={() => router.replace('/')} />
      </View>
    );

  const doneCount = steps.filter((_, i) => done[i]).length;
  const next = steps.findIndex((_, i) => !done[i]);
  const legStart = (legIndex: number) => journey.departAt + journey.legs.slice(0, legIndex).reduce((n, l) => n + (l.waitSec + l.durationSec) * 1000, 0);

  return (
    <>
      <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <Eyebrow>Book the whole journey</Eyebrow>
        <Text style={[styles.title, { color: t.ink.ink }]}>
          {steps.length === 0 ? 'Nothing to book' : `${doneCount} of ${steps.length} booked`}
        </Text>
        <Text style={[styles.note, { color: t.ink.muted }]}>
          {steps.length === 0
            ? 'This journey is on foot — no tickets needed.'
            : 'Each step opens the official app for that part of the trip. Tick it once you’ve booked or paid there. Hogona never books or charges you itself.'}
        </Text>

        <View style={[styles.progress, { backgroundColor: t.ink.rule }]}>
          <View style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 100}%`, height: '100%', backgroundColor: t.ink.accent, borderRadius: 3 }} />
        </View>

        {steps.map((s, i) => {
          const isDone = !!done[i];
          const isNext = i === next;
          return (
            <View key={i} style={[styles.step, { backgroundColor: t.ink.card, borderColor: isNext ? t.ink.ink : t.ink.rule, opacity: isDone ? 0.6 : 1 }]}>
              <View style={styles.stepHead}>
                <Text style={[styles.num, { color: isDone ? t.ink.accent : t.ink.faint }]}>{isDone ? 'OK' : String(i + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Eyebrow>
                    {s.kind === 'metro' ? 'Namma Metro' : s.kind === 'bus' ? 'BMTC bus' : s.kind === 'ksrtc' ? 'KSRTC bus' : s.kind === 'train' ? 'Train' : 'Cab / auto'} · around {formatClock(legStart(s.legIndex))}
                  </Eyebrow>
                  <Text style={[styles.stepTitle, { color: t.ink.ink }]}>{s.title}</Text>
                  <Text style={[styles.note, { color: t.ink.muted }]}>{s.detail}</Text>
                </View>
              </View>

              {!isDone && (
                <View style={styles.actions}>
                  {s.kind === 'metro' && (
                    <>
                      <PillButton label="Namma Metro app" onPress={async () => setSnack(await handoff.openOperatorApp('namma-metro', { from: s.from, to: s.to }))} />
                      <PillButton label="WhatsApp ticket" variant="outline" onPress={() => setWaStep(s)} />
                    </>
                  )}
                  {s.kind === 'train' && (
                    <>
                      <PillButton
                        label="See trains & book"
                        onPress={async () => {
                          const a = s.from.refId && railStation(s.from.refId.slice(5));
                          const b = s.to.refId && railStation(s.to.refId.slice(5));
                          if (a && b) setSnack(await handoff.openInApp(trainSearchUrl(a, b, new Date(legStart(s.legIndex))), `Trains ${a.code} → ${b.code}`));
                        }}
                      />
                      <PillButton label="IRCTC app" variant="outline" onPress={async () => setSnack(await handoff.openOperatorApp('irctc', { from: s.from, to: s.to }))} />
                    </>
                  )}
                  {s.kind === 'ksrtc' && <PillButton label="Book on KSRTC app" onPress={async () => setSnack(await handoff.openOperatorApp('ksrtc'))} />}
                  {s.kind === 'bus' && <PillButton label="Namma BMTC app" variant="outline" onPress={async () => setSnack(await handoff.openOperatorApp('bmtc', { from: s.from, to: s.to }))} />}
                  {s.kind === 'ride' && (
                    <>
                      <PillButton label="Uber inside Hogona" onPress={async () => setSnack(await handoff.openUberInApp(s.from, s.to))} />
                      <PillButton label="Uber app" variant="outline" onPress={async () => setSnack(await handoff.openUber(s.from, s.to))} />
                      {RIDE_APPS.map((app) => (
                        <PillButton
                          key={app.id}
                          label={app.prefillLink ? `${app.name} inside Hogona` : app.name}
                          variant="outline"
                          onPress={async () => setSnack(await handoff.openRideApp(app.id, s.from, s.to))}
                        />
                      ))}
                    </>
                  )}
                </View>
              )}

              <Pressable
                onPress={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                style={[styles.tick, { borderTopColor: t.ink.rule }]}
              >
                <View style={[styles.box, { borderColor: isDone ? t.ink.accent : t.ink.ink, backgroundColor: isDone ? t.ink.accent : 'transparent' }]} />
                <Text style={[styles.tickLabel, { color: t.ink.ink }]}>
                  {s.kind === 'bus' ? 'I’ll pay on the bus / paid in app' : 'I’ve booked this'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {steps.length > 0 && doneCount === steps.length && (
          <View style={[styles.allDone, { backgroundColor: t.ink.accentWash }]}>
            <Text style={[styles.stepTitle, { color: t.ink.ink }]}>All set. Have a good trip.</Text>
            <Text style={[styles.note, { color: t.ink.muted }]}>Your tickets and ride details are in each app. Check them for confirmation and receipts.</Text>
          </View>
        )}

        <View style={{ alignSelf: 'flex-start' }}>
          <TextAction label="Back to journey" tone="muted" onPress={() => router.back()} />
        </View>
      </ScrollView>

      <WhatsAppTicketDialog
        visible={!!waStep}
        fromStation={waStep?.from.name ?? ''}
        toStation={waStep?.to.name ?? ''}
        onDismiss={() => setWaStep(null)}
        onOpen={async (n) => {
          const s = waStep!;
          setWaStep(null);
          setSnack(await handoff.openMetroWhatsApp(s.from.name, s.to.name, n));
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={6000}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 14, paddingBottom: 56, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  title: { fontFamily: FONTS.serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.8 },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 4 },
  step: { borderRadius: 18, borderWidth: 1.2, padding: 16, gap: 12 },
  stepHead: { flexDirection: 'row', gap: 12 },
  num: { fontFamily: FONTS.mono, fontSize: 15, width: 26, paddingTop: 1 },
  stepTitle: { fontFamily: FONTS.serif, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 38 },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 12, minHeight: 44 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5 },
  tickLabel: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  allDone: { borderRadius: 16, padding: 16, gap: 6 },
});
