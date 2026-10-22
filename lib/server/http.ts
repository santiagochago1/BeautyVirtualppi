/**
 * Respuestas JSON y manejo centralizado de errores para los Route Handlers.
 *
 * En Express el `errorHandler` terminaba la cadena de middlewares; aqui cada
 * Route Handler envuelve su logica con `handle()`, que produce exactamente el
 * mismo cuerpo JSON: `{ ok: false, error, code }`.
 */
import { NextResponse } from 'next/server';
import { AppError } from '@/lib/server/errors';
import { env } from '@/lib/server/env';
import { createLogger } from '@/lib/server/logger';

const logger = createLogger('http');

/** Errores tipicos de credenciales de Firebase -> 503 con mensaje claro. */
const CREDENTIAL_ERROR_PATTERNS = [
  /could not load the default credentials/i,
  /unable to detect a project id/i,
  /unauthenticated/i,
  /invalid authentication credentials/i,
  /metadata.+unavailable/i,
];

const isCredentialError = (error: unknown): boolean =>
  CREDENTIAL_ERROR_PATTERNS.some((pattern) => pattern.test(String((error as Error)?.message || '')));

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMIT_EXCEEDED',
  502: 'AI_UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
  504: 'AI_TIMEOUT',
};

/** Respuesta JSON successful. */
export const json = (data: unknown, status = 200): NextResponse =>
  NextResponse.json(data, { status });

/** Traduce una excepcion a una `Response` JSON con el codigo HTTP correcto. */
export const errorResponse = (error: unknown): NextResponse => {
  const err = error as { statusCode?: number; status?: number; message?: string; code?: string; expected?: boolean; details?: unknown; stack?: string };

  let statusCode = err?.statusCode || err?.status || 500;

  if (statusCode >= 500 && isCredentialError(error)) {
    statusCode = 503;
  }

  const isExpected = err?.expected === true || statusCode < 500;

  const payload: Record<string, unknown> = {
    ok: false,
    error: isExpected
      ? (err?.message ?? 'Ocurrio un error inesperado. Intenta nuevamente.')
      : 'Ocurrio un error inesperado. Intenta nuevamente.',
    code: err?.code || STATUS_CODES[statusCode] || 'SERVER_ERROR',
  };

  if (statusCode === 503 && isCredentialError(error)) {
    payload.error =
      'La base de datos no esta configurada correctamente. Revisa las credenciales de Firebase en .env.local';
  }

  if (err?.details !== undefined) payload.details = err.details;

  if (!isExpected) {
    logger.error(`Error no controlado -> ${statusCode}`, error);
    if (!env.isProduction) payload.stack = err?.stack;
  } else {
    logger.warn(`Error controlado -> ${statusCode}: ${err?.message}`);
  }

  return NextResponse.json(payload, { status: statusCode });
};

/**
 * Envuelve la logica de un Route Handler.
 *
 * IMPORTANTE (Next.js 16 + Cache Components): la lectura de `request.headers`
 * debe ocurrir FUERA de este wrapper, porque Next la usa para abortar el
 * prerenderizado lanzando una excepcion interna. Un `try/catch` alrededor
 * capturing esa excepcion haria que el Route Handler se prerenderizara.
 */
export const handle = async (fn: () => Promise<Response>): Promise<Response> => {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
};

export { AppError };
