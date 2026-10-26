import operators from '../../data/operators.json';

export type OperatorId = keyof typeof operators.operators;

export interface WhatsAppBooking {
  operatorId: 'namma-metro';
  fromStation: string;
  toStation: string;
  passengers: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function whatsappSupport(operatorId: OperatorId) {
  const op = operators.operators[operatorId] as { whatsapp?: { supported: boolean } };
  return op.whatsapp?.supported === true;
}

export function validateBooking(b: WhatsAppBooking): ValidationResult {
  const errors: string[] = [];
  if (!whatsappSupport(b.operatorId)) errors.push('This operator has no verified WhatsApp ticketing.');
  // Stations are optional (they can be chosen in the chat), but not half-filled.
  if (!!b.fromStation !== !!b.toStation) errors.push('Choose both stations, or leave both to pick in the chat.');
  if (b.fromStation && b.fromStation === b.toStation) errors.push('Start and end stations must differ.');
  if (!Number.isInteger(b.passengers) || b.passengers < 1 || b.passengers > 6) errors.push('Passengers must be between 1 and 6.');
  return { ok: errors.length === 0, errors };
}

/**
 * The official Namma Metro chatbot is menu-driven and starts from "Hi", so
 * that is the only text pre-filled: free text with station names would not be
 * understood by the bot. The user presses send and then picks the stations
 * shown in this app from the bot's menus.
 */
export function bookingMessage(): string {
  return operators.operators['namma-metro'].whatsapp.openingMessage;
}

export function whatsappLinks(): string[] {
  const wa = operators.operators['namma-metro'].whatsapp;
  const text = encodeURIComponent(bookingMessage());
  return [`whatsapp://send?phone=${wa.number}&text=${text}`, `https://wa.me/${wa.number}?text=${text}`];
}
