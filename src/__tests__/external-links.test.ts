import { operatorApp } from '../features/external-apps/links';
import { rapidoLinks, rapidoTripText } from '../features/rapido/links';
import { uberLinks } from '../features/uber/links';
import { bookingMessage, validateBooking, whatsappLinks, whatsappSupport } from '../features/whatsapp/links';
import type { Place } from '../types/journey';

const a: Place = { name: 'Indiranagar', lat: 12.9783, lon: 77.6386, kind: 'metro' };
const b: Place = { name: 'Koramangala & Co', lat: 12.9352, lon: 77.6245, kind: 'address' };

describe('Uber deep links', () => {
  it('builds the documented universal link with JSON pickup/drop', () => {
    const { universal } = uberLinks(a, b);
    expect(universal.startsWith('https://m.uber.com/looking?pickup=')).toBe(true);
    const url = new URL(universal);
    const pickup = JSON.parse(url.searchParams.get('pickup')!);
    const drop = JSON.parse(url.searchParams.get('drop[0]')!);
    expect(pickup).toMatchObject({ latitude: 12.9783, longitude: 77.6386, addressLine1: 'Indiranagar' });
    expect(drop.addressLine1).toBe('Koramangala & Co');
  });

  it('builds an app link with setPickup and encoded names', () => {
    const { app } = uberLinks(a, b);
    expect(app.startsWith('uber://?action=setPickup')).toBe(true);
    expect(app).toContain(encodeURIComponent('dropoff[nickname]') + '=' + encodeURIComponent('Koramangala & Co'));
  });
});

describe('Rapido', () => {
  it('only opens Rapido (no invented deep-link parameters)', () => {
    for (const url of rapidoLinks()) {
      expect(url).not.toMatch(/pickup|drop|lat/i);
    }
  });

  it('prepares pickup/drop text for the user to paste', () => {
    expect(rapidoTripText(a, b)).toContain('Pickup: Indiranagar');
  });
});

describe('WhatsApp ticketing', () => {
  it('is enabled only for the verified operator', () => {
    expect(whatsappSupport('namma-metro')).toBe(true);
    expect(whatsappSupport('bmtc')).toBe(false);
  });

  it('opens the official number with the chatbot opening word', () => {
    expect(bookingMessage()).toBe('Hi');
    expect(whatsappLinks()).toEqual(['whatsapp://send?phone=918105556677&text=Hi', 'https://wa.me/918105556677?text=Hi']);
  });

  it('validates passenger count and station choice', () => {
    expect(validateBooking({ operatorId: 'namma-metro', fromStation: 'A', toStation: 'B', passengers: 2 }).ok).toBe(true);
    expect(validateBooking({ operatorId: 'namma-metro', fromStation: '', toStation: '', passengers: 1 }).ok).toBe(true);
    expect(validateBooking({ operatorId: 'namma-metro', fromStation: 'A', toStation: 'A', passengers: 1 }).ok).toBe(false);
    expect(validateBooking({ operatorId: 'namma-metro', fromStation: 'A', toStation: '', passengers: 1 }).ok).toBe(false);
    expect(validateBooking({ operatorId: 'namma-metro', fromStation: 'A', toStation: 'B', passengers: 0 }).ok).toBe(false);
    expect(validateBooking({ operatorId: 'namma-metro', fromStation: 'A', toStation: 'B', passengers: 7 }).ok).toBe(false);
  });
});

describe('official operator apps', () => {
  it('uses the verified Play Store packages', () => {
    expect(operatorApp('namma-metro').androidPackage).toBe('com.aum.nammametro');
    expect(operatorApp('bmtc').androidPackage).toBe('com.bmtc.bmtcavls');
    expect(operatorApp('rapido').androidPackage).toBe('com.rapido.passenger');
  });
});

describe('other ride apps', () => {
  const { RIDE_APPS, rideApp, rideAppLinks } = jest.requireActual('../features/ride/providers') as typeof import('../features/ride/providers');

  it('includes only verified, operating Bengaluru ride apps', () => {
    expect(RIDE_APPS.map((r) => r.id)).toEqual(['ola', 'rapido', 'namma-yatri', 'indrive', 'quick-ride']);
  });

  it('pre-fills Ola with its documented web booking link', () => {
    const [first] = rideAppLinks(rideApp('ola')!, a, b);
    const url = new URL(first);
    expect(url.origin).toBe('https://book.olacabs.com');
    expect(url.searchParams.get('lat')).toBe('12.9783');
    expect(url.searchParams.get('drop_lng')).toBe('77.6245');
    expect(url.searchParams.get('drop_name')).toBe('Koramangala & Co');
  });

  it('never invents pre-fill parameters for apps without documented links', () => {
    for (const id of ['rapido', 'namma-yatri', 'indrive', 'quick-ride']) {
      expect(rideApp(id)!.prefillLink).toBeNull();
      for (const u of rideAppLinks(rideApp(id)!, a, b)) expect(u).not.toMatch(/lat=|drop/);
    }
  });
});
