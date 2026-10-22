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
