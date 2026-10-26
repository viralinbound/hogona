/**
 * Privacy policy shown in-app (Settings → Privacy & about) and mirrored in
 * docs/PRIVACY_POLICY.md for the store listings. Keep the two in sync.
 */
export const POLICY_UPDATED = '24 October 2026';

export const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The short version',
    body: 'Hogona has no accounts, no ads, no analytics and no server of its own. We don’t collect, sell or share your personal data, and we don’t track you across apps or websites.',
  },
  {
    title: 'What stays on your phone',
    body: 'Your preferences, language, home and work places, saved places, recent searches and the list of apps you opened from Hogona are stored only on this device. You can erase all of it any time in Settings → Erase everything on this phone, or by uninstalling the app.',
  },
  {
    title: 'Location',
    body: 'Hogona asks for location only when you tap “Use my location” or turn on a stop alert. “Use my location” sets your start point and finds nearby stations; to name the spot, the coordinates are sent once to the address-search service below. A stop alert watches your position on the phone while the journey screen is open, to vibrate before your stop; it stops when you leave the screen and nothing is sent anywhere. Location is never stored, tracked in the background or shared with us.',
  },
  {
    title: 'Online services Hogona talks to',
    body: 'Address search: Photon (komoot, OpenStreetMap data) receives what you type and, if you use your location, the coordinates. Street paths: the OSRM routing service (FOSSGIS) receives the start and end of a walking or driving leg. Web map tiles: OpenStreetMap. Rain notice: Open-Meteo receives the rounded coordinates (about 100 m) of your trip’s start point to return a 3-hour forecast. These requests are made only to answer your request and carry no account or identifier from us. Each service has its own privacy policy.',
  },
  {
    title: 'Other apps',
    body: 'When you tap Uber, Ola, Rapido, Namma Yatri, inDrive, Quick Ride, Namma Metro, Namma BMTC, WhatsApp or Google Maps, Hogona opens that app with your trip details (for example pickup and drop). Anything you do there — booking, payment, chat — is governed by that company’s own terms and privacy policy. Hogona never books, pays or reads anything inside those apps.',
  },
  {
    title: 'Children',
    body: 'Hogona is a general travel tool and does not knowingly collect information from anyone, including children.',
  },
  {
    title: 'Changes',
    body: 'If this policy changes, the new version will be shown here with a new date.',
  },
];

export const DISCLAIMER =
  'Routes, times and fares are planning estimates from public data (OpenStreetMap and published fare tables) and may be wrong or out of date. Nothing is live. Always follow official signs and staff. Hogona is not affiliated with BMRCL, BMTC, any ride company, WhatsApp or Google.';

/** Public support contact for the store listing; set EXPO_PUBLIC_SUPPORT_EMAIL. Hidden when empty. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
