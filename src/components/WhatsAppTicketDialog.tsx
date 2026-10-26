import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { FONTS } from '../constants/theme';
import operators from '../data/operators.json';
import { validateBooking } from '../features/whatsapp/links';
import { Eyebrow, Figure, PillButton, Rule, TextAction, useAppTheme } from './ui';

const wa = operators.operators['namma-metro'].whatsapp;

/**
 * Pre-flight screen for the official Namma Metro WhatsApp ticket chat.
 * Shows what will happen, validates the trip, then opens WhatsApp with "Hi"
 * typed. Nothing is booked by this app.
 */
export function WhatsAppTicketDialog({
  visible,
  fromStation,
  toStation,
  onDismiss,
  onOpen,
}: {
  visible: boolean;
  fromStation: string;
  toStation: string;
  onDismiss: () => void;
  onOpen: (passengers: number) => void;
}) {
  const t = useAppTheme();
  const [passengers, setPassengers] = useState(1);
  useEffect(() => {
    if (visible) setPassengers(1);
  }, [visible]);
  const check = validateBooking({ operatorId: 'namma-metro', fromStation, toStation, passengers });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: t.ink.card }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Eyebrow>Namma Metro · official WhatsApp</Eyebrow>
          <Text style={[styles.title, { color: t.ink.ink }]}>Metro ticket</Text>

          <View style={styles.stub}>
            <Row label="From" value={fromStation || 'Choose in the chat'} />
            <Rule dashed />
            <Row label="To" value={toStation || 'Choose in the chat'} />
            <Rule dashed />
            <Row label="Ticket" value={passengers > 1 ? 'Group QR' : 'Single-journey QR'} />
            <Rule dashed />
            <View style={styles.row}>
              <Text style={[styles.label, { color: t.ink.faint }]}>PEOPLE</Text>
              <View style={styles.stepper}>
                <PillButton label="−" variant="outline" onPress={() => setPassengers((p) => Math.max(1, p - 1))} style={styles.step} accessibilityHint="Fewer passengers" />
                <Figure size={18} style={{ minWidth: 22, textAlign: 'center' }}>
                  {passengers}
                </Figure>
                <PillButton label="+" variant="outline" onPress={() => setPassengers((p) => Math.min(6, p + 1))} style={styles.step} accessibilityHint="More passengers" />
              </View>
            </View>
          </View>

          {check.errors.map((e) => (
            <Text key={e} style={[styles.note, { color: t.colors.error }]}>
              {e}
            </Text>
          ))}

          <Eyebrow style={{ marginTop: 6 }}>What happens next</Eyebrow>
          {wa.flow.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Figure size={12} colour={t.ink.faint}>
                0{i + 1}
              </Figure>
              <Text style={[styles.note, { color: t.ink.muted, flex: 1 }]}>{step}</Text>
            </View>
          ))}
          <View style={[styles.warn, { backgroundColor: t.ink.warnWash }]}>
            <Text style={[styles.note, { color: t.ink.warn }]}>
              WhatsApp can’t send for you, and nothing is booked until the official chat sends your QR after payment. Chat number {wa.display}.
            </Text>
          </View>

          <View style={styles.actions}>
            <TextAction label="Cancel" onPress={onDismiss} tone="muted" />
            <PillButton label="Open WhatsApp" variant="accent" disabled={!check.ok} onPress={() => onOpen(passengers)} />
          </View>
        </ScrollView>
      </Dialog>
    </Portal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.ink.faint }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color: t.ink.ink }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { maxWidth: 480, alignSelf: 'center', width: '92%', borderRadius: 22, maxHeight: '90%' },
  content: { paddingHorizontal: 24, paddingVertical: 22, gap: 10 },
  title: { fontFamily: FONTS.serif, fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  stub: { gap: 8, marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  label: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.4, width: 62 },
  value: { fontFamily: FONTS.sansMedium, fontSize: 15, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { minHeight: 36, minWidth: 44, paddingHorizontal: 0 },
  stepRow: { flexDirection: 'row', gap: 10 },
  note: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  warn: { borderRadius: 12, padding: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, marginTop: 6 },
});
