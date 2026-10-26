import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLon } from '../types/transport';

export interface MapLine {
  id: string;
  points: LatLon[];
  colour: string;
  width?: number;
  /** Dashed = approximate (not a navigable path). */
  dashed?: boolean;
}

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  colour: string;
  title: string;
  description?: string;
  /** Larger markers for origin/destination/stations, small dots for bus stops. */
  size?: 'dot' | 'station' | 'pin';
}

export interface TransitMapProps {
  lines: MapLine[];
  markers: MapMarker[];
  /** Points the camera should frame. */
  fit?: LatLon[];
  style?: StyleProp<ViewStyle>;
  showUserLocation?: boolean;
  onMarkerPress?: (id: string) => void;
  /** Long-press (device) or click (web) on empty map. */
  onMapPress?: (lat: number, lon: number) => void;
  /** Reports the visible area so callers can load markers for it. */
  onRegionChange?: (bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number; zoomedIn: boolean }) => void;
  accessibilityLabel?: string;
}
