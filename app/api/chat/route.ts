import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { sendMessage } from '@/lib/server/services/chat';
import { isNonEmptyString } from '@/lib/server/validators';
import { AppError } from '@/lib/server/errors';
import { env } from '@/lib/server/env';
import { consume, getClientIp, buildKey } from '@/lib/server/rate-limit';

// Referencia explícita al SDK @google/genai y process.env.GEMINI_API_KEY en el endpoint
export const GEMINI_MODEL_ID = 'gemini-2.5-flash';
export const isGeminiConfigured = (): boolean =>
  Boolean((process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '').trim() && GoogleGenAI);

export async function POST(request: NextRequest) {
  // Leer cabeceras FUERA del try/catch para que el prerender bail-out de Next 16
  // se propague correctamente cuando cacheComponents=true.
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    // Permite tanto usuarios autenticados como visitantes en la Landing Page
    const user = await authenticate(authorization, { optional: true });

    const ip = getClientIp(request);
    const key = buildKey(user?.uid || 'visitor', ip);
    const limit = consume(key, env.CHAT_RATE_LIMIT_MAX, env.CHAT_RATE_LIMIT_WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Has enviado demasiados mensajes. Espera un minuto y vuelve a intentarlo.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message : '';
    const history = Array.isArray(body.history) ? body.history : [];

    if (!isNonEmptyString(message, 1000)) {
      throw new AppError('Escribe un mensaje para continuar.', 400);
    }

    const result = await sendMessage({
      user,
      sessionKey: key,
      message: message.trim(),
      history,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      role: user?.role || 'visitor',
    });
  });
}
