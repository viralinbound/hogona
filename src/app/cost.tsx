import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Figure, PillButton, Toggle, useAppTheme } from '../components/ui';
import { FONTS } from '../constants/theme';
import passes from '../data/passes.json';
import { useLayout } from '../hooks/useLayout';
import { useAppState } from '../state/AppState';
import type { Journey } from '../types/journey';
import { formatRupees } from '../utils/format';

const DAYS = [20, 22, 26, 30];

interface Row {
  title: string;
  monthly: number | null;
  detail: string;
}

/** Monthly cost of each planned option, plus the BMTC pass where a bus-only trip makes it relevant. */
function rows(journeys: Journey[], tripsPerMonth: number, shakti: boolean): Row[] {
  const out: Row[] = [];
  for (const j of journeys) {
    const ride = j.modes.includes('ride');
    if (!j.fare.complete) {
      out.push({ title: j.title, monthly: null, detail: ride ? 'Ride fares are shown only in the ride apps, so a monthly total isn’t possible.' : `Fare not verified for: ${j.fare.unknownParts.join(', ')}.` });
      continue;
    }
    const monthly = j.fare.known * tripsPerMonth;
    const metro = j.modes.includes('metro');
    out.push({
      title: j.title,
      monthly,
      detail: `${formatRupees(j.fare.known)} a trip × ${tripsPerMonth} trips (estimated fare).${metro ? ` A metro smart card is reported to take ${passes.metroSmartCard.discountPeakPct}% off at peak and ${passes.metroSmartCard.discountOffPeakPct}% off-peak.` : ''}`,
    });
    const busOnly = j.modes.every((m) => m === 'walk' || m === 'bus');
    if (busOnly) {
      const ac = j.legs.some((l) => l.mode === 'bus' && l.route?.ac);
      if (!ac && shakti) continue;
      const pass = ac ? passes.bmtc.vajraMonthly : passes.bmtc.monthlyNonAc;
      out.push({
        title: ac ? 'BMTC Vajra (AC) monthly pass' : 'BMTC monthly pass (non-AC)',
        monthly: pass,
        detail: `${monthly > pass ? `Saves about ${formatRupees(monthly - pass)} a month over single tickets` : 'Single tickets are cheaper for this trip'}. Pass price as reported in the press (from ${passes.bmtc.effectiveFrom}) — confirm at a BMTC counter.`,
      });
    }
  }
  // Same title can repeat across options; keep the first.
  return out.filter((r, i) => out.findIndex((o) => o.title === r.title && o.monthly === r.monthly) === i);
}

export default function CostScreen() {
  const t = useAppTheme();
  const { gutter } = useLayout();
  const { plan, commute, prefs, setOrigin, setDestination, runPlan } = useAppState();
  const [days, setDays] = useState(22);
  const [perDay, setPerDay] = useState(2);
  const journeys = plan.status === 'done' ? (plan.result?.journeys ?? []) : [];
  const list = rows(journeys, days * perDay, prefs.shakti);

  const planCommute = () => {
    if (!commute.home || !commute.work) return;
    setOrigin(commute.home);
    setDestination(commute.work);
    void runPlan(commute.home, commute.work);
  };

  return (
    <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      {plan.origin && plan.destination && journeys.length > 0 ? (
        <Text style={[styles.note, { color: t.ink.muted }]}>
          {plan.origin.name} → {plan.destination.name}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={[styles.note, { color: t.ink.muted }]}>Plan your daily trip first, then come back here to compare monthly costs.</Text>
          <View style={styles.options}>
            {commute.home && commute.work && <PillButton label="Use home → work" onPress={planCommute} />}
            <PillButton label="Plan a trip" variant="outline" onPress={() => router.replace('/')} />
          </View>
        </View>
      )}

      <Eyebrow style={{ marginTop: 14 }}>Trips a day</Eyebrow>
      <View style={styles.options}>
        <Toggle label="One way" selected={perDay === 1} onPress={() => setPerDay(1)} />
        <Toggle label="There and back" selected={perDay === 2} onPress={() => setPerDay(2)} />
      </View>
      <Eyebrow style={{ marginTop: 8 }}>Days a month</Eyebrow>
      <View style={styles.options}>
        {DAYS.map((d) => (
          <Toggle key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />
        ))}
      </View>

      <View style={{ marginTop: 14 }}>
        {list.map((r) => (
          <View key={r.title + r.monthly} style={[styles.row, { borderBottomColor: t.ink.rule }]}>
            <View style={styles.rowHead}>
              <Text style={[styles.rowTitle, { color: t.ink.ink }]}>{r.title}</Text>
              <Figure size={18}>{r.monthly == null ? '—' : formatRupees(r.monthly)}</Figure>
            </View>
            <Text style={[styles.note, { color: t.ink.muted }]}>{r.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.note, { color: t.ink.faint, marginTop: 12 }]}>
        Estimates from the fares Hogona uses for planning. {passes.note} You pay what the operator charges.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 56, gap: 6, maxWidth: 760, width: '100%', alignSelf: 'center' },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { paddingVertical: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  rowTitle: { fontFamily: FONTS.sansSemi, fontSize: 15, flex: 1 },
});
