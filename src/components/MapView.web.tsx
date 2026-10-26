import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { appConfig } from '../services/config';
import { BENGALURU_CENTER } from '../utils/geo';
import type { TransitMapProps } from './map-types';

/** Web map using Leaflet + OpenStreetMap raster tiles (no API key). */
export default function TransitMap({ lines, markers, fit, style, onMarkerPress, onMapPress, onRegionChange, accessibilityLabel }: TransitMapProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const handlers = useRef({ onMarkerPress, onMapPress, onRegionChange });
  handlers.current = { onMarkerPress, onMapPress, onRegionChange };

  useEffect(() => {
    if (!host.current || map.current) return;
    // Smooth movement: canvas drawing, momentum, half-step zoom, no edge bounce.
    const m = L.map(host.current, { zoomControl: false, attributionControl: true, preferCanvas: true, zoomSnap: 0.5, zoomDelta: 0.5, inertia: true, inertiaDeceleration: 2200, bounceAtZoomLimits: false, tapTolerance: 20 }).setView([BENGALURU_CENTER.lat, BENGALURU_CENTER.lon], 11);
    L.tileLayer(appConfig.tileUrl, {
      maxZoom: 19,
      keepBuffer: 4,
      updateWhenZooming: false,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    L.control.zoom({ position: 'topleft' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    const report = () => {
      const b = m.getBounds();
      handlers.current.onRegionChange?.({ minLat: b.getSouth(), maxLat: b.getNorth(), minLon: b.getWest(), maxLon: b.getEast(), zoomedIn: m.getZoom() >= 14 });
    };
    m.on('moveend', report);
    m.on('click', (e: L.LeafletMouseEvent) => handlers.current.onMapPress?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    // The container may get its size after mount.
    setTimeout(() => {
      m.invalidateSize();
      report();
    }, 100);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const l of lines)
      L.polyline(l.points, { color: l.colour, weight: l.width ?? 4, dashArray: l.dashed ? '6 8' : undefined, opacity: 0.9 }).addTo(g);
    for (const mk of markers) {
      const radius = mk.size === 'dot' ? 4 : mk.size === 'pin' ? 9 : 6;
      L.circleMarker([mk.lat, mk.lon], {
        radius,
        color: mk.colour,
        weight: mk.size === 'dot' ? 1 : 3,
        fillColor: mk.size === 'dot' || mk.size === 'pin' ? mk.colour : '#ffffff',
        fillOpacity: 1,
      })
        .bindTooltip(mk.description ? `<b>${escapeHtml(mk.title)}</b><br/>${escapeHtml(mk.description)}` : escapeHtml(mk.title))
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          handlers.current.onMarkerPress?.(mk.id);
        })
        .addTo(g);
    }
  }, [lines, markers]);

  const fitKey = fit?.map((p) => p.join(',')).join(';');
  useEffect(() => {
    if (map.current && fit?.length) map.current.fitBounds(L.latLngBounds(fit), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <View style={[{ overflow: 'hidden' }, style]} accessibilityLabel={accessibilityLabel}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
