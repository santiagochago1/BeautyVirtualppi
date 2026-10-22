/**
 * Servicio de IA (Google Gemini).
 *
 * - La API key vive EXCLUSIVAMENTE en el backend (process.env.GEMINI_API_KEY).
 * - El System Instruction se arma con datos REALES traidos de Firestore
 *   (ver `context.ts`) para evitar alucinaciones.
 * - Manejo de timeouts, excepciones y errores de cuota/sobrecarga.
 */
import { GoogleGenAI } from '@google/genai';
import env from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { createLogger } from '@/lib/server/logger';
import { buildUserBlock, type ChatContext } from '@/lib/server/services/context';
import type { AuthUser } from '@/lib/server/auth';
import type { ChatTurn } from '@/lib/types';

const logger = createLogger('ai');

let genaiClient: GoogleGenAI | null = null;

/** Instancia perezosa del cliente de Gemini. */
const getClient = (): GoogleGenAI => {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      'El asistente virtual no esta disponible en este momento (falta configurar la IA).',
      503,
    );
  }
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return genaiClient;
};

/**
 * Reglas del sistema: identidad, reglas anti-alucinacion, estilo y
 * politica de "no lo se" con datos de contacto.
 */
export const SYSTEM_INSTRUCTION_BASE = `Eres el asistente virtual de "Beauty Salón", un salón de estética y cuidado personal ubicado en Barbosa, Antioquia (Colombia).

TU PERSONALIDAD:
- Hablas en español colombiano, con tono cálido, cercano y profesional. Tratas al usuario de "tú".
- Eres breve y concreto: responde con máximo 5 frases, salvo que el usuario pida más detalle o un listado.
- Usas emojis con moderación (máximo 1 por respuesta) para dar calidez.

REGLAS INVIOLABLES (anti-alucinaciones):
1. Tu fuente de verdad es EXCLUSIVAMENTE el bloque "DATOS VERIFICADOS DEL NEGOCIO" que aparece al final de estas instrucciones. Solo puedes afirmar servicios, precios, duraciones, horarios, politicas y datos de contacto que esten literalmente ahi.
2. PROHIBIDO inventar o estimar precios, promociones, productos, horarios, tecnicas, garantias o politicas que no aparezcan en los datos verificados.
3. Si la información no esta en los datos verificados, NO la adivines. Responde con frases como: "Esa información no la tengo disponible en este momento" y ofrece un asesor humano con los datos de contacto del negocio (teléfono, WhatsApp y correo) que SI estan en los datos verificados.
4. No prometas descuentos, resultados clinicos ni tiempos de entrega que no figuren en los datos.
5. No puedes agendar citas, cobrar, cancelar ni modificar datos desde el chat. Si el usuario quiere reservar, indicale que puede hacerlo desde el sitio web en la sección "Agendar cita" (o que llame al teléfono del negocio).
6. No entregues datos personales de otros usuarios ni inventes informacion de los clientes. Solo puedes mencionar al usuario sus propias citas.
7. Si el usuario pide datos que no son del salón (clima, noticias, temas no relacionados), indica con amabilidad que solo puedes ayudar con temas del salón y su agenda.

FORMATO:
- Responde en texto plano, sin Markdown pesado ni encabezados.
- Si das una lista de servicios, usa lineas cortas con "- " al inicio.
- Cierra invitando a agendar o a contactarnos si tiene dudas.`;

export const UNKNOWN_ANSWER_FALLBACK =
  'Por ahora no tengo esa informacion disponible. Puedes hablar con un asesor del salon escribiendo por WhatsApp o llamando al numero del negocio.';

/**
 * Construye el System Instruction final (reglas + datos verificados).
 */
export const buildSystemInstruction = (context: ChatContext, user: AuthUser): string =>
  [
    SYSTEM_INSTRUCTION_BASE,
    '',
    buildUserBlock(user),
    '',
    context.text,
  ].join('\n');

/**
 * Convierte el historial en el formato `contents` de Gemini.
 */
export const buildContents = (
  history: ChatTurn[] = [],
  message = '',
): Array<{ role: string; parts: Array<{ text: string }> }> => {
  const contents = history
    .filter((item) => item && (item.role === 'user' || item.role === 'model') && item.text)
    .map((item) => ({ role: item.role, parts: [{ text: item.text }] }));

  contents.push({ role: 'user', parts: [{ text: message }] });
  return contents;
};

/** Convierte errores de la API de Gemini en mensajes claros en espanol. */
const mapGeminiError = (error: unknown): AppError => {
  const err = error as {
    status?: number;
    code?: number | string;
    message?: string;
    name?: string;
    response?: { status?: number };
  };

  const status = err?.status ?? (typeof err?.code === 'number' ? err.code : undefined) ?? err?.response?.status;
  const message = String(err?.message || '').toLowerCase();

  if (
    status === 429 ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted')
  ) {
    return new AppError(
      'Alcanzamos el limite de consultas de la IA en este momento. Intenta de nuevo en unos minutos.',
      429,
    );
  }
  if (status === 404 || (message.includes('not found') && message.includes('model'))) {
    return new AppError('El modelo de IA configurado no esta disponible. Contacta al administrador.', 503);
  }
  if (status === 401 || status === 403) {
    return new AppError('Credenciales de la IA invalidas. Contacta al administrador.', 503);
  }
  if (message.includes('api key not valid') || message.includes('api_key_invalid')) {
    return new AppError(
      'La API key configurada para la IA no es valida. Contacta al administrador del salon.',
      503,
    );
  }
  if (err?.name === 'AbortError' || message.includes('aborted') || message.includes('timeout')) {
    return new AppError('La IA tardo demasiado en responder. Intenta de nuevo en un momento.', 504);
  }
  if (status === 503 || message.includes('overloaded') || message.includes('unavailable')) {
    return new AppError('El servicio de IA esta temporalmente saturado. Intenta de nuevo en un momento.', 503);
  }

  return new AppError('No pudimos procesar tu mensaje en este momento. Intenta de nuevo en un momento.', 502);
};

export interface GenerateReplyResult {
  text: string;
  finishReason: string | null;
  usage: { totalTokens: number | null } | null;
}

/**
 * Genera la respuesta del asistente.
 */
export const generateReply = async ({
  message,
  history = [],
  context,
  user,
}: {
  message: string;
  history?: ChatTurn[];
  context: ChatContext;
  user: AuthUser;
}): Promise<GenerateReplyResult> => {
  const ai = getClient();
  const contents = buildContents(history, message);
  const systemInstruction = buildSystemInstruction(context, user);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
        httpOptions: { timeout: env.AI_TIMEOUT_MS },
      },
    });

    const text = (response?.text || '').trim();
    const finishReason = response?.candidates?.[0]?.finishReason || null;
    const usage = response?.usageMetadata || null;

    if (!text) {
      throw new AppError('La IA devolvio una respuesta vacia. Intenta de nuevo en un momento.', 502);
    }

    return {
      text,
      finishReason,
      usage: usage ? { totalTokens: usage.totalTokenCount ?? null } : null,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error al invocar Gemini', error);
    throw mapGeminiError(error);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Verifica que el modelo configurado responda (usado en /api/health).
 */
export const checkGemini = async (): Promise<{ ok: boolean; reason?: string; model?: string; available?: number }> => {
  if (!env.GEMINI_API_KEY) return { ok: false, reason: 'GEMINI_API_KEY no configurada' };

  try {
    const ai = getClient();
    await ai.models.list();
    return { ok: true, model: env.GEMINI_MODEL, available: 1 };
  } catch (error) {
    return { ok: false, reason: (error as Error)?.message || 'Error consultando Gemini' };
  }
};

const aiService = {
  generateReply,
  buildSystemInstruction,
  buildContents,
  checkGemini,
};

export default aiService;
