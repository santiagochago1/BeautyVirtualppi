/**
 * Utilidades de fecha/hora.
 *
 * El salon opera en America/Bogota (UTC-5, sin horario de verano). Las citas
 * se almacenan como:
 *  - date: 'YYYY-MM-DD'  (dia local del salon)
 *  - time: 'HH:mm'       (hora local del salon)
 *  - startsAt: ISO 8601 UTC (para ordenar y comparar sin ambiguedad)
 */

export const SALON_TIMEZONE = 'America/Bogota';
export const SALON_UTC_OFFSET = '-05:00';

const pad = (value: number) => String(value).padStart(2, '0');

/** Devuelve 'YYYY-MM-DD' de una fecha ISO o Date en hora local del salon. */
export const toSalonDate = (value: Date | string = new Date()): string | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Construimos la fecha usando el offset del salon (-05:00).
  const local = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
};

/** Devuelve 'HH:mm' de una fecha ISO o Date en hora local del salon. */
export const toSalonTime = (value: Date | string = new Date()): string | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
};

/** ISO UTC a partir del dia y hora locales del salon. */
export const salonStartToIso = (date: string, time: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return null;
  const parsed = new Date(`${date}T${time}:00${SALON_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

/** Fecha actual del salon en formato 'YYYY-MM-DD'. */
export const todaySalon = (): string | null => toSalonDate(new Date());

/** Valida que un string sea una fecha ISO valida (YYYY-MM-DD). */
export const isValidDate = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Valida que un string sea una hora valida (HH:mm). */
export const isValidTime = (value: unknown): boolean =>
  typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

/** Devuelve la fecha de hoy + N dias (formato 'YYYY-MM-DD'). */
export const addDays = (date: string | Date, days: number): string => {
  const base = date instanceof Date ? date : new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};
