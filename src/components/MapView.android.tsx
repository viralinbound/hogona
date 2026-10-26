import Constants from 'expo-constants';
import TransitMapGoogle from './MapViewGoogle';
import TransitMapLeaflet from './MapViewLeaflet';

/**
 * Android: Google Maps needs an API key (it crashes without one), so the
 * key-free OpenStreetMap map is used unless GOOGLE_MAPS_ANDROID_API_KEY was
 * set at build time.
 */
const hasGoogleKey = Boolean(Constants.expoConfig?.extra?.hasGoogleMapsKey);

export default hasGoogleKey ? TransitMapGoogle : TransitMapLeaflet;
