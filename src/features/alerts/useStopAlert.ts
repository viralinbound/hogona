import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import type { Journey, Place } from '../../types/journey';
import { haversineM } from '../../utils/geo';

/** Vibrate this far before a stop: about one metro station or two bus stops of warning. */
export const ALERT_RADIUS_M = 600;
const KEEP_AWAKE_TAG = 'hogona-stop-alert';

export interface StopAlertState {
  on: boolean;
  /** The next stop to get off at, and the straight-line distance to it (null until GPS answers). */
  target: Place | null;
  distanceM: number | null;
  /** Set when the phone has just vibrated for a stop. */
  alerting: Place | null;
  arrived: boolean;
  denied: boolean;
}

/** Where to get off: the end of every metro and bus ride (cab drivers know where to stop). */
export function alightingStops(journey: Journey): Place[] {
  return journey.legs.filter((l) => l.mode === 'metro' || l.mode === 'bus').map((l) => l.to);
}

/**
 * Foreground-only "get off soon" alert. Watches GPS while the journey screen is
 * open and keeps the screen awake; no background location is requested.
 */
export function useStopAlert(journey: Journey | undefined) {
  const targets = useMemo(() => (journey ? alightingStops(journey) : []), [journey]);
  const [on, setOn] = useState(false);
  const [index, setIndex] = useState(0);
  const [distanceM, setDistance] = useState<number | null>(null);
  const [alerting, setAlerting] = useState<Place | null>(null);
  const [denied, setDenied] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const indexRef = useRef(0);

  const stop = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
    if (Platform.OS !== 'web') deactivateKeepAwake(KEEP_AWAKE_TAG);
    setOn(false);
  }, []);

  const start = useCallback(async () => {
    if (!targets.length) return;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setDenied(true);
      return;
    }
    setDenied(false);
    indexRef.current = 0;
    setIndex(0);
    setAlerting(null);
    setDistance(null);
    setOn(true);
    if (Platform.OS !== 'web') await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 40, timeInterval: 5000 }, (pos) => {
      const i = indexRef.current;
      const target = targets[i];
      if (!target) return;
      const d = haversineM(pos.coords.latitude, pos.coords.longitude, target.lat, target.lon);
      setDistance(d);
      if (d <= ALERT_RADIUS_M) {
        Vibration.vibrate([0, 700, 300, 700, 300, 700]);
        setAlerting(target);
        indexRef.current = i + 1;
        setIndex(i + 1);
      }
    });
  }, [targets]);

  // Stop watching when the screen closes or the journey changes.
  useEffect(() => stop, [stop, journey]);

  const arrived = on && index >= targets.length;
  useEffect(() => {
    if (arrived) stop();
  }, [arrived, stop]);

  const state: StopAlertState = { on, target: targets[index] ?? null, distanceM, alerting, arrived: index >= targets.length && targets.length > 0 && !!alerting, denied };
  return { state, start, stop, available: targets.length > 0, dismiss: () => setAlerting(null) };
}
