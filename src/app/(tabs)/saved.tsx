import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { LineSwatch } from '../../components/ModeTag';
import { KindMark, PlaceRow } from '../../components/PlaceRow';
import { Eyebrow, PillButton, TextAction, useAppTheme } from '../../components/ui';
import { FONTS, LINE_COLOURS } from '../../constants/theme';
import { LOCATION_MESSAGES, useCurrentLocation } from '../../features/location/useCurrentLocation';
import { stationById } from '../../services/transport-data';
import { useAppState } from '../../state/AppState';

export default function SavedScreen() {
  const t = useAppTheme();
  const { favourites, removeFavourite, toggleFavourite, setOrigin, setDestination } = useAppState();
  const { status, locate } = useCurrentLocation();
  const [naming, setNaming] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [label, setLabel] = useState('');

  return (
    <>
      <FlatList
        style={{ backgroundColor: t.ink.paper }}
        data={favourites}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.intro, { color: t.ink.muted }]}>Home, office, the station you always use. Kept only on this phone.</Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <PillButton
                label={status === 'locating' ? 'Finding you…' : 'Save where I am now'}
                variant="outline"
                onPress={async () => {
                  const p = await locate();
                  if (p) {
                    setNaming({ lat: p.lat, lon: p.lon, name: p.name });
                    setLabel('');
                  }
                }}
              />
            </View>
            {(status === 'denied' || status === 'unavailable' || status === 'outside') && <Text style={[styles.intro, { color: t.ink.warn }]}>{LOCATION_MESSAGES[status]}</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const st = item.place.refId ? stationById.get(item.place.refId) : undefined;
          return (
            <PlaceRow
              lead={st ? <LineSwatch colour={LINE_COLOURS[st.line] ?? t.ink.ink} width={24} /> : <KindMark text={item.place.kind === 'bus' ? 'BUS' : 'PIN'} />}
              title={item.label}
              subtitle={item.label !== item.place.name ? item.place.name : item.place.subtitle}
              onPress={() => {
                setDestination(item.place);
                router.push('/');
              }}
              hint="Sets as destination"
              right={
                <View style={styles.actions}>
                  <TextAction
                    label="From"
                    tone="muted"
                    onPress={() => {
                      setOrigin(item.place);
                      router.push('/');
                    }}
                    accessibilityHint={`Start from ${item.label}`}
                  />
                  <TextAction label="Remove" tone="danger" onPress={() => removeFavourite(item.id)} accessibilityHint={`Removes ${item.label}`} />
                </View>
              }
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: t.ink.ink }]}>Nothing saved yet</Text>
            <Text style={[styles.intro, { color: t.ink.muted }]}>Tap “Save” next to a search result, on the map, or on a journey.</Text>
          </View>
        }
      />
      <Portal>
        <Dialog visible={!!naming} onDismiss={() => setNaming(null)} style={[styles.dialog, { backgroundColor: t.ink.card }]}>
          <View style={styles.dialogBody}>
            <Eyebrow>Name this place</Eyebrow>
            <TextInput
              value={label}
              onChangeText={setLabel}
              autoFocus
              placeholder="Home, Office…"
              placeholderTextColor={t.ink.faint}
              style={[styles.input, { color: t.ink.ink, borderBottomColor: t.ink.ink }]}
            />
            <View style={styles.dialogActions}>
              <TextAction label="Cancel" tone="muted" onPress={() => setNaming(null)} />
              <PillButton
                label="Save"
                onPress={() => {
                  if (naming) toggleFavourite({ name: naming.name, lat: naming.lat, lon: naming.lon, kind: 'map', subtitle: 'Saved location' }, label.trim() || naming.name);
                  setNaming(null);
                }}
              />
            </View>
          </View>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { gap: 14, paddingTop: 4, paddingBottom: 14 },
  intro: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 14 },
  empty: { paddingVertical: 40, gap: 8 },
  emptyTitle: { fontFamily: FONTS.serif, fontSize: 28, letterSpacing: -0.4 },
  dialog: { borderRadius: 22, maxWidth: 420, alignSelf: 'center', width: '90%' },
  dialogBody: { padding: 22, gap: 14 },
  input: { fontFamily: FONTS.serif, fontSize: 28, borderBottomWidth: 1.5, paddingVertical: 6, outlineStyle: 'none' } as object,
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18 },
});
