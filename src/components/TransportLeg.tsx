import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS, MODE_COLOURS } from '../constants/theme';
import type { Leg } from '../types/journey';
import { formatClock, formatDistance, formatDuration, formatRupees } from '../utils/format';
import { BasisTag } from './DataFreshnessLabel';
import { RIDE_APPS } from '../features/ride/providers';
import { ModeTag } from './ModeTag';
import { Figure, PillButton, TextAction, useAppTheme } from './ui';

export interface LegActions {
  onUber?: (leg: Leg) => void;
  /** Uber's booking page inside Hogona (in-app browser). */
  onUberInApp?: (leg: Leg) => void;
  /** Any other ride app from operators.json `rideApps` (Ola, Rapido, Namma Yatri…). */
  onRideApp?: (leg: Leg, appId: string) => void;
  onWhatsApp?: (leg: Leg) => void;
  /** Opens the official Namma Metro / Namma BMTC app to buy the ticket. */
  onOperatorApp?: (leg: Leg) => void;
  onDirections?: (leg: Leg) => void;
  /** Train list for this leg's stations and date, with times and fares, inside Hogona. */
  onTrains?: (leg: Leg) => void;
  /** IRCTC app with the station codes copied. */
  onIrctc?: (leg: Leg) => void;
}

/**
 * One leg of the timeline. Left gutter: clock time in mono. Centre: a rule
 * in the line's colour (dotted for walking). Right: what to do.
 */
export function TransportLeg({ leg, startAt, actions }: { leg: Leg; startAt: number; actions: LegActions }) {
  const t = useAppTheme();
  const [showStops, setShowStops] = useState(false);
  const colour = leg.mode === 'walk' ? t.ink.faint : leg.mode === 'ride' ? t.ink.ink : (leg.line?.colour ?? MODE_COLOURS[leg.mode]);
  const boardAt = startAt + leg.waitSec * 1000;
  const intermediate = leg.stops ? leg.stops.slice(1, -1) : [];

  const title =
    leg.mode === 'walk'
      ? leg.interchange
        ? `Change lines at ${leg.to.name}`
        : `Walk to ${leg.to.name}`
      : leg.mode === 'metro'
        ? `Towards ${leg.to.name}`
        : leg.mode === 'bus'
          ? leg.route?.name ?? 'BMTC bus'
          : leg.mode === 'train'
            ? `Train to ${leg.to.name}`
            : `Ride to ${leg.to.name}`;

  const fareLine = leg.fare
    ? leg.fare.amount === null
      ? leg.fare.basis === 'in-app'
        ? leg.mode === 'train' || leg.route?.operator === 'KSRTC'
          ? 'Fare shown when you book'
          : 'Fare shown in the app'
        : 'Fare not verified'
      : leg.fare.amount === 0
        ? 'Included'
        : formatRupees(leg.fare.amount)
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.gutter}>
        <Figure size={12} colour={t.ink.muted}>
          {formatClock(startAt).replace(' ', '\n')}
        </Figure>
      </View>
      <View style={styles.rail}>
        <View style={[styles.node, { borderColor: colour, backgroundColor: t.ink.card }]} />
        <View style={[styles.line, leg.mode === 'walk' ? { borderLeftWidth: 2, borderStyle: 'dotted', borderColor: colour } : { backgroundColor: colour, width: 4 }]} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.from, { color: t.ink.muted }]} numberOfLines={1}>
          {leg.from.name}
        </Text>
        <View style={styles.titleRow}>
          <ModeTag leg={leg} />
        </View>
        <Text style={[styles.title, { color: t.ink.ink }]}>{title}</Text>

        <View style={[styles.facts, { borderColor: t.ink.rule }]}>
          {leg.waitSec > 0 && (
            <Fact label="Wait" value={`~${formatDuration(leg.waitSec)}`}>
              <BasisTag basis={leg.waitBasis} />
            </Fact>
          )}
          {leg.mode !== 'walk' && leg.mode !== 'ride' && <Fact label="Board" value={`~${formatClock(boardAt)}`} />}
          <Fact label={leg.mode === 'walk' ? 'Walk' : leg.mode === 'train' ? 'Train' : 'Ride'} value={`${formatDuration(leg.durationSec)} · ${formatDistance(leg.distanceM)}`}>
            <BasisTag basis={leg.durationBasis} />
          </Fact>
          {fareLine && (
            <Fact label="Fare" value={fareLine} strong>
              {leg.fare!.amount !== null && leg.fare!.amount > 0 && <BasisTag basis="estimated" />}
            </Fact>
          )}
        </View>
        {leg.fare && <Text style={[styles.note, { color: t.ink.muted }]}>{leg.fare.label}</Text>}

        {leg.stops && leg.stops.length > 1 && (
          <Text style={[styles.note, { color: t.ink.ink }]}>
            Get off at <Text style={{ fontFamily: FONTS.sansSemi }}>{leg.to.name}</Text> — {leg.stops.length - 1} stop{leg.stops.length === 2 ? '' : 's'}
          </Text>
        )}
        {intermediate.length > 0 && (
          <View style={{ alignSelf: 'flex-start' }}>
            <TextAction
              label={showStops ? 'Hide stops' : `Show ${intermediate.length} stop${intermediate.length === 1 ? '' : 's'} in between`}
              onPress={() => setShowStops((s) => !s)}
              tone="muted"
            />
          </View>
        )}
        {showStops && (
          <View style={[styles.stops, { borderColor: colour }]}>
            {intermediate.map((s, i) => (
              <Text key={`${s.refId}-${i}`} style={[styles.stop, { color: t.ink.ink }]}>
                {s.name}
              </Text>
            ))}
          </View>
        )}

        {leg.mode === 'walk' && leg.geometryKind === 'approximate' && !leg.interchange && (
          <Text style={[styles.note, { color: t.ink.faint }]}>Dashed on the map: a straight line, not the walking path.</Text>
        )}

        <View style={styles.actions}>
          {leg.mode === 'ride' && actions.onUberInApp && (
            <PillButton label="Book Uber inside Hogona" onPress={() => actions.onUberInApp!(leg)} accessibilityHint="Opens Uber's booking page here with pickup and drop filled in" />
          )}
          {leg.mode === 'ride' && actions.onUber && <PillButton label="Open Uber app" variant="outline" onPress={() => actions.onUber!(leg)} accessibilityHint="Opens Uber with pickup and drop filled in" />}
          {leg.mode === 'ride' &&
            actions.onRideApp &&
            RIDE_APPS.map((app) => (
              <PillButton
                key={app.id}
                label={app.prefillLink ? `${app.name} inside Hogona` : app.name}
                variant={app.prefillLink ? 'solid' : 'outline'}
                onPress={() => actions.onRideApp!(leg, app.id)}
                accessibilityHint={app.note}
              />
            ))}
          {leg.mode === 'train' && actions.onTrains && <PillButton label="See trains & book" onPress={() => actions.onTrains!(leg)} accessibilityHint="Opens the train list for these stations and your travel date, with times and fares" />}
          {leg.mode === 'train' && actions.onIrctc && <PillButton label="IRCTC app" variant="outline" onPress={() => actions.onIrctc!(leg)} />}
          {leg.mode === 'metro' && actions.onOperatorApp && <PillButton label="Namma Metro app" variant="outline" onPress={() => actions.onOperatorApp!(leg)} />}
          {leg.mode === 'metro' && actions.onWhatsApp && <PillButton label="Ticket on WhatsApp" variant="outline" onPress={() => actions.onWhatsApp!(leg)} />}
          {leg.mode === 'bus' && actions.onOperatorApp && (
            <PillButton label={leg.route?.operator === 'KSRTC' ? 'Book on KSRTC app' : 'Namma BMTC app'} variant="outline" onPress={() => actions.onOperatorApp!(leg)} />
          )}
          {(leg.mode === 'walk' || leg.mode === 'ride') && !leg.interchange && actions.onDirections && (
            <TextAction label="Directions in Maps" onPress={() => actions.onDirections!(leg)} tone="muted" />
          )}
        </View>
      </View>
    </View>
  );
}

function Fact({ label, value, strong, children }: { label: string; value: string; strong?: boolean; children?: React.ReactNode }) {
  const t = useAppTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: t.ink.faint }]}>{label}</Text>
      <Figure size={13} colour={t.ink.ink} style={strong ? { fontFamily: FONTS.monoMedium } : undefined}>
        {value}
      </Figure>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  gutter: { width: 54, paddingTop: 1 },
  rail: { alignItems: 'center', width: 20, marginRight: 12 },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, marginTop: 2 },
  line: { flex: 1, marginTop: 3, minHeight: 28, borderRadius: 2 },
  body: { flex: 1, paddingBottom: 26, gap: 6 },
  from: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  titleRow: { flexDirection: 'row' },
  title: { fontFamily: FONTS.serif, fontSize: 23, lineHeight: 27, letterSpacing: -0.3 },
  facts: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: StyleSheet.hairlineWidth * 2, paddingVertical: 8, gap: 6, marginTop: 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  factLabel: { fontFamily: FONTS.sansSemi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', width: 44 },
  note: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18 },
  stops: { borderLeftWidth: 2, paddingLeft: 12, gap: 4, marginLeft: 2 },
  stop: { fontFamily: FONTS.sans, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 },
});
