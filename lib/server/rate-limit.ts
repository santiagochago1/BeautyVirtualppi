/**
 * Limitador de peticiones en memoria (control de abuso y costos del chat).
 *
 * Sustituye a `express-rate-limit` (que no existe en Next.js). Se mantiene un
 * `Map` por clave con ventana deslizante simple.
 *
 * Nota: el estado vive en memoria del proceso. En despliegues serverless cada
 * instancia tiene su propio contador (igual que el backend Express original).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const cleanup = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

const timer = setInterval(cleanup, 5 * 60 * 1000);
if (typeof timer.unref === 'function') timer.unref();

export interface RateLimitResult {
  ok: boolean;
  /** Segundos restantes para volver a intentarlo (0 si no hay limite). */
  retryAfter: number;
  remaining: number;
}

/** Registra un intento y decide si supera el limite. */
export const consume = (key: string, max: number, windowMs: number): RateLimitResult => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: Math.max(max - 1, 0) };
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0, remaining: Math.max(max - bucket.count, 0) };
};

/** IP real del cliente (detras de un proxy se toma `x-forwarded-for`). */
export const getClientIp = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
};

/** Clave de limitacion: uid + IP cuando hay sesion, solo IP si no. */
export const buildKey = (uid: string | null | undefined, ip: string): string =>
  uid ? `${uid}:${ip}` : `ip:${ip}`;
