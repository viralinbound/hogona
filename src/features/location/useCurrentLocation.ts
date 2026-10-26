import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import type { Place } from '../../types/journey';
import { inKarnataka } from '../../utils/geo';
import { reverseGeocode } from '../../services/geocoding';

export type LocationStatus = 'idle' | 'locating' | 'denied' | 'unavailable' | 'outside' | 'ok';

export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [place, setPlace] = useState<Place | null>(null);

  const locate = useCallback(async (): Promise<Place | null> => {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('denied');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = pos.coords;
      if (!inKarnataka(lat, lon)) {
        setStatus('outside');
        return null;
      }
      const name = (await reverseGeocode(lat, lon)) ?? 'Current location';
      const p: Place = { name, lat, lon, kind: 'current', subtitle: 'Your location' };
      setPlace(p);
      setStatus('ok');
      return p;
    } catch {
      setStatus('unavailable');
      return null;
    }
  }, []);

  return { status, place, locate };
}

export const LOCATION_MESSAGES: Record<Exclude<LocationStatus, 'idle' | 'locating' | 'ok'>, string> = {
  denied: 'Location permission was not granted. You can type a start point instead, or allow location in system settings.',
  unavailable: 'Your location could not be determined (GPS off or no signal). Type a start point instead.',
  outside: 'You appear to be outside Karnataka. Hogona plans trips within Karnataka — type a start point.',
};
