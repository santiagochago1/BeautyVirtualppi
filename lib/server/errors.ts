/**
 * Errores de aplicacion (controlados) del backend.
 *
 * En Next.js no hay `next(error)` como en Express: cada Route Handler envuelve
 * su logica con `handle()` (ver `lib/server/http.ts`), que traduce cualquier
 * excepcion a una `Response` JSON con el codigo HTTP correspondiente.
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expected = true;

  /**
   * @param message Mensaje orientado al usuario final (espanol).
   * @param statusCode Codigo HTTP.
   * @param options `details` con informacion adicional.
   */
  constructor(message: string, statusCode = 500, options: { details?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = options.details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }
}

export default AppError;
