/**
 * Cliente HTTP del frontend hacia la API (Next.js Route Handlers).
 *
 * - Agrega el token de Firebase Auth (Bearer) cuando la ruta lo requiere.
 * - Normaliza los errores del backend en un `ApiError` con mensaje en espanol.
 */
import type { ApiErrorPayload, ApiRequestOptions } from '@/lib/types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Lee un mensaje de error de cualquier excepcion sin usar `any`. */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
};

/** Extrae `error`/`code` de un cuerpo JSON desconocido. */
const readErrorPayload = (data: unknown): ApiErrorPayload => {
  if (!data || typeof data !== 'object') return { ok: false, error: '', code: null };
  const record = data as Record<string, unknown>;
  return {
    ok: false,
    error: typeof record.error === 'string' ? record.error : '',
    code: typeof record.code === 'string' ? record.code : null,
  };
};

/**
 * Realiza una peticion a la API de la aplicacion.
 *
 * @param path Ruta relativa, por ejemplo `/services`.
 * @param options `{ method, body, token, signal, headers }`
 */
export const apiRequest = async <T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const { method = 'GET', body, token, signal, headers = {} } = options;

  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(
      'No hay conexion con el servidor. Verifica tu internet e intenta de nuevo.',
      0,
      'NETWORK_ERROR',
    );
  }

  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const payload = readErrorPayload(data);
    throw new ApiError(
      payload.error || 'Ocurrio un error inesperado. Intenta nuevamente.',
      response.status,
      payload.code ?? null,
    );
  }

  return data as T;
};

export default apiRequest;
