/**
 * Sanitizadores y validadores compartidos por los Route Handlers.
 */

export const cleanString = (value: unknown, maxLength = 500): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

/** Normaliza texto para busquedas (minusculas, sin tildes). */
export const normalize = (value: unknown = ''): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const isValidEmail = (value: unknown): boolean =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

const SYNTHETIC_EMAIL_DOMAIN = 'telefono.beautyvirtual.local';

/** Normaliza un numero de telefono dejando solo los digitos locales (ej. 3001234567). */
export const normalizePhone = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) {
    return digits.slice(2);
  }
  return digits;
};

/** Valida que el numero de telefono tenga entre 7 y 15 digitos. */
export const isValidPhone = (value: unknown): boolean => {
  const clean = normalizePhone(value);
  return /^\d{7,15}$/.test(clean);
};

/** Convierte un numero de telefono en un correo sintetico para Firebase Auth. */
export const phoneToAuthEmail = (phoneOrEmail: unknown): string => {
  const raw = String(phoneOrEmail ?? '').trim();
  if (raw.includes('@')) return raw.toLowerCase();
  const clean = normalizePhone(raw);
  return `${clean}@${SYNTHETIC_EMAIL_DOMAIN}`;
};

/** Extrae el telefono si el email es sintetico. */
export const extractPhoneFromAuthEmail = (email: unknown): string | null => {
  if (typeof email !== 'string') return null;
  const lower = email.trim().toLowerCase();
  if (lower.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) {
    return lower.split('@')[0] || null;
  }
  return null;
};

export const isNonEmptyString = (value: unknown, maxLength = 1000): boolean =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

/** Convierte un valor a numero finito o devuelve `fallback`. */
export const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Convierte un valor a entero dentro de un rango. */
export const toIntInRange = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};
