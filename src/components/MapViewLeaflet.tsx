import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import type { ComponentType, Ref } from 'react';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { appConfig } from '../services/config';
import { BENGALURU_CENTER } from '../utils/geo';
import type { TransitMapProps } from './map-types';

// The class component's typings clash with React 19's JSX types; this is the same component.
type WebViewHandle = { injectJavaScript: (js: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

/**
 * Key-free native map: Leaflet + OpenStreetMap tiles inside a WebView.
 * Used on Android when no Google Maps key is configured. Same props and
 * behaviour as the other map implementations.
 */
const HTML = (tileUrl: string) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{margin:0;height:100%;background:#F3EFE6}.leaflet-bar a{width:44px!important;height:44px!important;line-height:44px!important;font-size:22px!important}.hg-fit{font:600 13px sans-serif;padding:0 12px!important;width:auto!important}</style>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script></head>
<body><div id="m"></div><script>
var post=function(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))};
// Smooth movement: canvas drawing, momentum, half-step zoom, no edge bounce.
var map=L.map('m',{zoomControl:false,preferCanvas:true,zoomSnap:0.5,zoomDelta:0.5,inertia:true,inertiaDeceleration:2200,bounceAtZoomLimits:false,tapTolerance:20,worldCopyJump:false}).setView([${BENGALURU_CENTER.lat},${BENGALURU_CENTER.lon}],11);
L.tileLayer(${JSON.stringify(tileUrl)},{maxZoom:19,keepBuffer:4,updateWhenZooming:false,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.control.zoom({position:'topleft'}).addTo(map);
var lastFit=null,fitPts=null;
var FitCtl=L.Control.extend({options:{position:'topleft'},onAdd:function(){var a=L.DomUtil.create('a','hg-fit');var w=L.DomUtil.create('div','leaflet-bar');w.appendChild(a);a.href='#';a.textContent='Fit route';a.style.display='none';L.DomEvent.on(a,'click',function(e){L.DomEvent.preventDefault(e);if(fitPts)map.fitBounds(L.latLngBounds(fitPts),{padding:[40,40],maxZoom:16});});this.a=a;return w;}});
var fitCtl=new FitCtl().addTo(map);
var layer=L.layerGroup().addTo(map);
function report(){var b=map.getBounds();post({t:'region',minLat:b.getSouth(),maxLat:b.getNorth(),minLon:b.getWest(),maxLon:b.getEast(),zoomedIn:map.getZoom()>=14})}
map.on('moveend',report);
map.on('contextmenu',function(e){post({t:'press',lat:e.latlng.lat,lon:e.latlng.lng})});
window.render=function(d){layer.clearLayers();
 d.lines.forEach(function(l){L.polyline(l.points,{color:l.colour,weight:l.width||4,dashArray:l.dashed?'6 8':null,opacity:.9}).addTo(layer)});
 d.markers.forEach(function(m){var r=m.size==='dot'?4:m.size==='pin'?9:6;
  L.circleMarker([m.lat,m.lon],{radius:r,color:m.colour,weight:m.size==='dot'?1:3,fillColor:(m.size==='dot'||m.size==='pin')?m.colour:'#fff',fillOpacity:1})
   .bindTooltip(m.title).on('click',function(){post({t:'marker',id:m.id})}).addTo(layer)});
 // Re-fit only when the route itself changes, never while the user is moving the map.
 var k=d.fit&&d.fit.length?JSON.stringify(d.fit):null;fitPts=k?d.fit:null;fitCtl.a.style.display=k?'block':'none';
 if(k&&k!==lastFit)map.fitBounds(L.latLngBounds(d.fit),{padding:[40,40],maxZoom:16});lastFit=k;};
setTimeout(report,300);post({t:'ready'});
</script></body></html>`;

export default function TransitMapLeaflet({ lines, markers, fit, style, onMarkerPress, onMapPress, onRegionChange, accessibilityLabel }: TransitMapProps) {
  const web = useRef<WebViewHandle>(null);
  const ready = useRef(false);
  const html = useMemo(() => HTML(appConfig.tileUrl), []);
  const payload = JSON.stringify({ lines, markers, fit: fit ?? null });

  const push = () => web.current?.injectJavaScript(`window.render && window.render(${payload}); true;`);
  useEffect(() => {
    if (ready.current) push();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.t === 'ready') {
      ready.current = true;
      push();
    } else if (m.t === 'marker') onMarkerPress?.(m.id);
    else if (m.t === 'press') onMapPress?.(m.lat, m.lon);
    else if (m.t === 'region') onRegionChange?.(m);
  };

  return (
    <View style={[{ overflow: 'hidden' }, style]} accessibilityLabel={accessibilityLabel}>
      <WebView ref={web} originWhitelist={['*']} source={{ html, baseUrl: 'https://hogona.app/' }} onMessage={onMessage} javaScriptEnabled style={{ flex: 1, backgroundColor: '#F3EFE6' }} />
    </View>
  );
}
