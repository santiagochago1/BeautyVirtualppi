/**
 * Formateadores compartidos (es-CO / COP).
 */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const longDateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export const formatCurrency = (value: unknown): string => currencyFormatter.format(Number(value) || 0);

/**
 * Convierte un valor desconocido en `Date`.
 * Acepta `Date`, `number` (epoch ms) y `string` (ISO / `YYYY-MM-DD`).
 */
const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

/** Fecha local (`YYYY-MM-DD`) interpreted a mediodia para evitar desfases de zona. */
const toLocalDate = (value: unknown): Date | null => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return toDate(value);
};

export const formatLongDate = (value: unknown): string => {
  if (!value) return '';
  const date = toLocalDate(value);
  if (!date) return '';
  return longDateFormatter.format(date);
};

export const formatShortDate = (value: unknown): string => {
  if (!value) return '';
  const date = toLocalDate(value);
  if (!date) return '';
  return shortDateFormatter.format(date);
};

export const formatTime = (value: unknown): string => {
  if (!value) return '';
  const date =
    typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
      ? new Date(`2020-01-01T${value}:00`)
      : toDate(value);
  if (!date) return '';
  return timeFormatter.format(date);
};

/** Formatea la hora de un mensaje del chat. */
export const formatMessageTime = (value: unknown): string => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
};

/** Devuelve la fecha de hoy en formato 'YYYY-MM-DD' (hora local del navegador). */
export const todayISO = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

/** Genera las horas disponibles (cada 30 minutos) dentro de un rango. */
export const buildTimeSlots = (from = '08:00', to = '18:00', stepMinutes = 30): string[] => {
  const slots: string[] = [];
  const [fromHour, fromMinute] = from.split(':').map(Number);
  const [toHour, toMinute] = to.split(':').map(Number);
  let current = fromHour * 60 + fromMinute;
  const end = toHour * 60 + toMinute;

  while (current <= end) {
    const hours = String(Math.floor(current / 60)).padStart(2, '0');
    const minutes = String(current % 60).padStart(2, '0');
    slots.push(`${hours}:${minutes}`);
    current += stepMinutes;
  }

  return slots;
};
