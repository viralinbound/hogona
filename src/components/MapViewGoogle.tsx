import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import RNMapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { BENGALURU_CENTER } from '../utils/geo';
import type { TransitMapProps } from './map-types';

/** Native map (Google Maps on Android, Apple Maps on iOS) via react-native-maps. */
export default function TransitMap({ lines, markers, fit, style, showUserLocation, onMarkerPress, onMapPress, onRegionChange, accessibilityLabel }: TransitMapProps) {
  const ref = useRef<RNMapView>(null);
  const fitKey = fit?.map((p) => p.join(',')).join(';');

  useEffect(() => {
    if (!fit?.length || !ref.current) return;
    const t = setTimeout(
      () =>
        ref.current?.fitToCoordinates(
          fit.map(([latitude, longitude]) => ({ latitude, longitude })),
          { edgePadding: { top: 60, right: 40, bottom: 60, left: 40 }, animated: true },
        ),
      250,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const report = (r: Region) =>
    onRegionChange?.({
      minLat: r.latitude - r.latitudeDelta / 2,
      maxLat: r.latitude + r.latitudeDelta / 2,
      minLon: r.longitude - r.longitudeDelta / 2,
      maxLon: r.longitude + r.longitudeDelta / 2,
      zoomedIn: r.latitudeDelta < 0.04,
    });

  return (
    <View style={[styles.wrap, style]} accessibilityLabel={accessibilityLabel}>
      <RNMapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: BENGALURU_CENTER.lat, longitude: BENGALURU_CENTER.lon, latitudeDelta: 0.25, longitudeDelta: 0.25 }}
        showsUserLocation={showUserLocation}
        toolbarEnabled={false}
        onLongPress={(e) => onMapPress?.(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
        onRegionChangeComplete={report}
      >
        {lines.map((l) => (
          <Polyline
            key={l.id}
            coordinates={l.points.map(([latitude, longitude]) => ({ latitude, longitude }))}
            strokeColor={l.colour}
            strokeWidth={l.width ?? 4}
            lineDashPattern={l.dashed ? [8, 8] : undefined}
          />
        ))}
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lon }}
            title={m.title}
            description={m.description}
            onPress={() => onMarkerPress?.(m.id)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            {m.size === 'pin' ? undefined : (
              <View
                style={[
                  m.size === 'dot' ? styles.dot : styles.station,
                  { borderColor: m.colour, backgroundColor: m.size === 'dot' ? m.colour : '#fff' },
                ]}
              />
            )}
          </Marker>
        ))}
      </RNMapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  station: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
});
