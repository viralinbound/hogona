import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useCallback } from 'react';
import { openFirst } from '../../services/external-links/open';
import { externalDirectionsUrl } from '../../services/maps/routing';
import { useAppState } from '../../state/AppState';
import type { Place } from '../../types/journey';
import { operatorApp, operatorAppLinks, type AppOperatorId } from '../external-apps/links';
import { rapidoLinks, rapidoTripText } from '../rapido/links';
import { rideApp, rideAppLinks, tripText } from '../ride/providers';
import { uberLinks } from '../uber/links';
import { whatsappLinks } from '../whatsapp/links';

/**
 * Opens external services and records that the app was *left* (not that
 * anything was booked). Each function resolves to a message for a snackbar.
 */
export function useHandoff() {
  const { logActivity } = useAppState();

  const openUber = useCallback(
    async (pickup: Place, drop: Place) => {
      const { app, universal } = uberLinks(pickup, drop);
      const r = await openFirst([app, universal]);
      if (!r.opened) return 'Could not open Uber on this device.';
      logActivity({ kind: 'uber', title: `Opened Uber: ${pickup.name} → ${drop.name}`, detail: 'Pickup and drop were pre-filled. Fare, driver and booking are shown only in Uber.' });
      return 'Opened Uber. Check the fare and confirm the ride in Uber.';
    },
    [logActivity],
  );

  /**
   * Uber's own mobile booking site in an in-app browser sheet (Chrome Custom
   * Tab / SFSafariViewController), pickup and drop pre-filled. The user signs
   * in to Uber and confirms there; Hogona cannot see or change that page.
   */
  const openUberInApp = useCallback(
    async (pickup: Place, drop: Place) => {
      const { universal } = uberLinks(pickup, drop);
      try {
        if (Platform.OS === 'web') {
          const r = await openFirst([universal]);
          if (!r.opened) return r.error ?? 'Could not open Uber.';
        } else {
          await WebBrowser.openBrowserAsync(universal, { toolbarColor: '#F3EFE6', controlsColor: '#1F5A43', dismissButtonStyle: 'close' });
        }
      } catch {
        return 'Could not open Uber’s booking page.';
      }
      logActivity({ kind: 'uber', title: `Uber inside Hogona: ${pickup.name} → ${drop.name}`, detail: 'Uber’s booking page opened in Hogona with pickup and drop filled. Booking and payment happen on Uber’s page.' });
      return 'Uber’s booking page is open. Sign in to Uber, check the fare and confirm there.';
    },
    [logActivity],
  );

  const openRapido = useCallback(
    async (pickup: Place, drop: Place) => {
      await Clipboard.setStringAsync(rapidoTripText(pickup, drop)).catch(() => undefined);
      const r = await openFirst(rapidoLinks());
      if (!r.opened) return 'Could not open Rapido or its store page.';
      logActivity({
        kind: 'rapido',
        title: `Opened Rapido: ${pickup.name} → ${drop.name}`,
        detail: 'Rapido has no pre-fill link, so pickup and drop were copied to the clipboard. Fare and booking happen only in Rapido.',
      });
      return 'Opened Rapido. Pickup and drop are copied — enter them in Rapido and confirm the fare there.';
    },
    [logActivity],
  );

  const openMetroWhatsApp = useCallback(
    async (fromStation: string, toStation: string, passengers: number) => {
      const r = await openFirst(whatsappLinks());
      if (!r.opened) return 'WhatsApp could not be opened. Buy a QR ticket in the Namma Metro app or at the station instead.';
      logActivity({
        kind: 'whatsapp',
        title: `Opened Namma Metro WhatsApp: ${fromStation} → ${toStation}`,
        detail: `${passengers} passenger(s). Not booked until the official chat sends your QR ticket after payment.`,
      });
      return 'WhatsApp opened with "Hi" typed. Press send, then follow the official Namma Metro chat.';
    },
    [logActivity],
  );

  const openDirections = useCallback(
    async (from: Place, to: Place, mode: 'walking' | 'driving' | 'transit') => {
      const r = await openFirst([externalDirectionsUrl([from.lat, from.lon], [to.lat, to.lon], mode)]);
      if (r.opened) logActivity({ kind: 'maps', title: `Directions: ${from.name} → ${to.name}`, detail: `Opened ${mode} directions in Google Maps.` });
      return r.opened ? 'Opened directions in Google Maps.' : 'Could not open a maps app.';
    },
    [logActivity],
  );

  const openWebsite = useCallback(
    async (url: string, title: string) => {
      const r = await openFirst([url]);
      if (r.opened) logActivity({ kind: 'website', title, detail: url });
      return r.opened ? `Opened ${title}.` : 'Could not open the link.';
    },
    [logActivity],
  );

  /** Opens a web page inside Hogona (in-app browser) so the user can come straight back. */
  const openInApp = useCallback(
    async (url: string, title: string) => {
      try {
        if (Platform.OS === 'web') {
          const r = await openFirst([url]);
          if (!r.opened) return 'Could not open the link.';
        } else await WebBrowser.openBrowserAsync(url, { toolbarColor: '#F3EFE6', controlsColor: '#1F5A43', dismissButtonStyle: 'close' });
      } catch {
        return 'Could not open the link.';
      }
      logActivity({ kind: 'website', title, detail: 'Trains, seats and booking are handled on that site. Nothing was booked here.' });
      return `Opened ${title}.`;
    },
    [logActivity],
  );

  /** Opens Namma Metro / Namma BMTC so the user buys the ticket in the official app. */
  const openOperatorApp = useCallback(
    async (id: AppOperatorId, trip?: { from: Place; to: Place }) => {
      const app = operatorApp(id);
      if (trip) await Clipboard.setStringAsync(`${trip.from.name} → ${trip.to.name}`).catch(() => undefined);
      const r = await openFirst(operatorAppLinks(id));
      if (!r.opened) return `Could not open ${app.name} or its store page.`;
      logActivity({
        kind: 'app',
        title: `Opened ${app.name}${trip ? `: ${trip.from.name} → ${trip.to.name}` : ''}`,
        detail: 'Tickets are bought and paid for in that app. Nothing was booked here.',
      });
      return `Opened ${app.name}.${trip ? ' Stations are copied — select them there and pay in the app.' : ''}`;
    },
    [logActivity],
  );

  /**
   * Any app in operators.json `rideApps`. A documented https pre-fill link
   * opens inside Hogona (in-app browser); otherwise the app opens and the
   * trip is copied for pasting.
   */
  const openRideApp = useCallback(
    async (id: string, pickup: Place, drop: Place) => {
      const app = rideApp(id);
      if (!app) return 'That ride app is not available.';
      const links = rideAppLinks(app, pickup, drop);
      const inApp = links[0]?.startsWith('https://') && app.prefillLink;
      try {
        if (inApp && Platform.OS !== 'web') {
          await WebBrowser.openBrowserAsync(links[0], { toolbarColor: '#F3EFE6', controlsColor: '#1F5A43', dismissButtonStyle: 'close' });
        } else {
          if (!app.prefillLink) await Clipboard.setStringAsync(tripText(pickup, drop)).catch(() => undefined);
          const r = await openFirst(links);
          if (!r.opened) return r.error ?? `Could not open ${app.name}.`;
        }
      } catch {
        return `Could not open ${app.name}.`;
      }
      logActivity({
        kind: 'app',
        title: `${app.name}: ${pickup.name} → ${drop.name}`,
        detail: app.prefillLink ? `${app.name}'s booking page opened with pickup and drop filled. Booking happens there.` : `${app.name} opened; pickup and drop were copied. Booking happens in ${app.name}.`,
      });
      return app.prefillLink
        ? `${app.name} is open with your trip filled in. Sign in, check the fare and confirm there.`
        : `${app.name} opened. Pickup and drop are copied — paste them in ${app.name} and confirm the fare there.`;
    },
    [logActivity],
  );

  return { openInApp, openUber, openUberInApp, openRideApp, openRapido, openMetroWhatsApp, openDirections, openWebsite, openOperatorApp };
}
