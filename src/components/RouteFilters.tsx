import { ScrollView, StyleSheet } from 'react-native';
import type { SortKey } from '../types/journey';
import { Toggle } from './ui';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'Best' },
  { key: 'fastest', label: 'Fastest' },
  { key: 'cheapest', label: 'Cheapest' },
  { key: 'least-walking', label: 'Less walking' },
];

/** One row of plain sort choices. */
export function RouteFilters({ sort, onSort }: { sort: SortKey; onSort: (k: SortKey) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel="Sort journeys">
      {SORTS.map((s) => (
        <Toggle key={s.key} label={s.label} selected={sort === s.key} onPress={() => onSort(s.key)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
});
