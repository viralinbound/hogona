import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { LineSwatch } from '../components/ModeTag';
import { KindMark, PlaceRow } from '../components/PlaceRow';
import { Eyebrow, TextAction, useAppTheme } from '../components/ui';
import { FONTS, LINE_COLOURS } from '../constants/theme';
import { LOCATION_MESSAGES, useCurrentLocation } from '../features/location/useCurrentLocation';
import { searchLocal, searchPlaces } from '../services/geocoding';
import { stationById } from '../services/transport-data';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import type { Place } from '../types/journey';

export default function PlaceSearchScreen() {
  const t = useAppTheme();
  const { field } = useLocalSearchParams<{ field: 'origin' | 'destination' | 'home' | 'work' }>();
  const tr = useT();
  const { setOrigin, setDestination, setCommutePlace, favourites, isFavourite, toggleFavourite } = useAppState();
  const { status, locate } = useCurrentLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(true);
  const [onlineError, setOnlineError] = useState<string | undefined>();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOnlineError(undefined);
      return;
    }
    setResults(searchLocal(q));
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const r = await searchPlaces(q, ctrl.signal);
        setResults(r.places);
        setOnlineError(r.onlineError);
      } catch {
        // aborted by a newer query
      } finally {
        if (abort.current === ctrl) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (p: Place) => {
    if (field === 'home' || field === 'work') setCommutePlace(field, p);
    else (field === 'destination' ? setDestination : setOrigin)(p);
    router.back();
  };

  const lead = (p: Place) => {
    if (p.kind === 'metro') {
      const s = p.refId ? stationById.get(p.refId) : undefined;
      return <LineSwatch colour={(s && LINE_COLOURS[s.line]) || t.ink.ink} width={24} />;
    }
    return <KindMark text={p.kind === 'bus' ? 'BUS' : 'MAP'} />;
  };

  const save = (p: Place) => (
    <TextAction
      label={isFavourite(p) ? 'Saved' : 'Save'}
      tone={isFavourite(p) ? 'accent' : 'muted'}
      onPress={() => toggleFavourite(p)}
      accessibilityHint={isFavourite(p) ? `Removes ${p.name} from saved places` : `Saves ${p.name}`}
    />
  );

  const showSuggestions = query.trim().length < 2;

  return (
    <View style={[styles.screen, { backgroundColor: t.ink.paper }]}>
      <Eyebrow>{field === 'home' ? tr('Choose your home') : field === 'work' ? tr('Choose your work place') : field === 'destination' ? 'Going to' : 'Starting from'}</Eyebrow>
      <View style={[styles.inputWrap, { borderBottomColor: focused ? t.ink.ink : t.ink.rule }]}>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={field === 'destination' ? 'Address, landmark, station…' : 'Where are you now?'}
          placeholderTextColor={t.ink.faint}
          style={[styles.input, { color: t.ink.ink }]}
          accessibilityLabel={field === 'destination' ? 'Search destination' : 'Search start point'}
          returnKeyType="search"
        />
        {loading ? (
          <Text style={[styles.status, { color: t.ink.faint }]}>Searching…</Text>
        ) : query ? (
          <TextAction label="Clear" onPress={() => setQuery('')} tone="muted" />
        ) : null}
      </View>
      {onlineError && !showSuggestions && <Text style={[styles.note, { color: t.ink.warn }]}>{onlineError}</Text>}

      {showSuggestions ? (
        <FlatList
          data={favourites}
          keyExtractor={(f) => f.id}
          ListHeaderComponent={
            <>
              <PlaceRow
                lead={<KindMark text="GPS" colour={t.ink.accent} />}
                title={status === 'locating' ? 'Finding you…' : 'Use my current location'}
                subtitle={status === 'denied' || status === 'unavailable' || status === 'outside' ? LOCATION_MESSAGES[status] : 'Asks for location permission once'}
                onPress={async () => {
                  const p = await locate();
                  if (p) choose(p);
                }}
              />
              {favourites.length > 0 && <Eyebrow style={{ marginTop: 22 }}>Saved places</Eyebrow>}
            </>
          }
          renderItem={({ item }) => <PlaceRow lead={lead(item.place)} title={item.label} subtitle={item.place.subtitle ?? item.place.name} onPress={() => choose(item.place)} />}
          ListFooterComponent={
            <Text style={[styles.note, { color: t.ink.muted }]}>Tip: on the Map tab, tap a station or long-press any point to plan from or to it.</Text>
          }
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p, i) => `${p.refId ?? p.name}-${i}`}
          renderItem={({ item }) => <PlaceRow lead={lead(item)} title={item.name} subtitle={item.subtitle} onPress={() => choose(item)} right={save(item)} />}
          ListEmptyComponent={loading ? undefined : <Text style={[styles.note, { color: t.ink.muted }]}>Nothing in Bengaluru matches “{query}”.</Text>}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 6, maxWidth: 760, width: '100%', alignSelf: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, gap: 10, marginBottom: 6 },
  input: { flex: 1, fontFamily: FONTS.serif, fontSize: 30, paddingVertical: 8, outlineStyle: 'none' } as object,
  status: { fontFamily: FONTS.serifItalic, fontSize: 15 },
  note: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18, paddingVertical: 12 },
});
