import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { KindMark, PlaceRow } from '../../components/PlaceRow';
import { Figure, SectionHead, useAppTheme } from '../../components/ui';
import { FONTS } from '../../constants/theme';
import { useAppState } from '../../state/AppState';
import type { ActivityEntry } from '../../storage/recent-journeys';
import { formatDateTime } from '../../utils/format';

const KIND: Record<ActivityEntry['kind'], string> = {
  uber: 'UBER',
  rapido: 'RPDO',
  whatsapp: 'WA',
  maps: 'MAPS',
  website: 'WEB',
  app: 'APP',
};

export default function ActivityScreen() {
  const t = useAppTheme();
  const { recents, activity, clearRecents, setOrigin, setDestination, runPlan } = useAppState();

  return (
    <ScrollView style={{ backgroundColor: t.ink.paper }} contentContainerStyle={styles.content}>
      <View>
        <SectionHead title="Searches" action={recents.length ? { label: 'Clear', onPress: clearRecents } : undefined} />
        {recents.length === 0 && <Text style={[styles.empty, { color: t.ink.muted }]}>No searches yet.</Text>}
        {recents.map((r) => (
          <PlaceRow
            key={r.searchedAt}
            title={`${r.origin.name} → ${r.destination.name}`}
            subtitle={formatDateTime(r.searchedAt)}
            onPress={() => {
              setOrigin(r.origin);
              setDestination(r.destination);
              void runPlan(r.origin, r.destination);
              router.push('/results');
            }}
            hint="Plans this journey again"
          />
        ))}
      </View>

      <View>
        <SectionHead title="Opened elsewhere" />
        <Text style={[styles.note, { color: t.ink.muted }]}>
          A log of hand-offs, not bookings. Your tickets, rides and receipts live in Uber, Rapido, Namma Metro, Namma BMTC or the WhatsApp chat.
        </Text>
        {activity.length === 0 && <Text style={[styles.empty, { color: t.ink.muted }]}>Nothing yet.</Text>}
        {activity.map((a) => (
          <View key={a.id} style={[styles.entry, { borderBottomColor: t.ink.rule }]}>
            <View style={{ width: 46 }}>
              <KindMark text={KIND[a.kind]} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.title, { color: t.ink.ink }]}>{a.title}</Text>
              <Text style={[styles.note, { color: t.ink.muted }]}>{a.detail}</Text>
              <Figure size={11} colour={t.ink.faint}>
                {formatDateTime(a.at)}
              </Figure>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 28, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  empty: { fontFamily: FONTS.sans, fontSize: 13, paddingVertical: 8 },
  note: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  entry: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 14.5 },
});
