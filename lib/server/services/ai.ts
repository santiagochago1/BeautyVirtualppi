/**
 * Servicio de IA (Google Gemini).
 *
 * - La API key vive EXCLUSIVAMENTE en el backend (process.env.GEMINI_API_KEY).
 * - El System Instruction se arma dinámicamente con la lista de servicios activos
 *   (nombres, precios y duraciones) y los horarios reales del negocio desde Firestore.
 */
import { GoogleGenAI } from '@google/genai';
import env from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { createLogger } from '@/lib/server/logger';
import { buildUserBlock, type ChatContext } from '@/lib/server/services/context';
import type { AuthUser } from '@/lib/server/auth';
import type { ChatTurn } from '@/lib/types';

const logger = createLogger('ai');

let cachedClient: { key: string; client: GoogleGenAI } | null = null;

/** Instancia del cliente de Gemini autenticada con process.env.GEMINI_API_KEY. */
const getClient = (): GoogleGenAI => {
  const apiKey = (process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new AppError(
      'El asistente virtual requiere configurar la variable GEMINI_API_KEY en el servidor (.env.local).',
      503,
    );
  }
  if (!cachedClient || cachedClient.key !== apiKey) {
    cachedClient = {
      key: apiKey,
      client: new GoogleGenAI({ apiKey }),
    };
  }
  return cachedClient.client;
};

/**
 * Instrucción base del sistema: configura al bot como la recepcionista amable
 * de Beauty Virtual en Barbosa, Antioquia.
 */
export const SYSTEM_INSTRUCTION_BASE = `Eres la recepcionista virtual amable y profesional de "Beauty Virtual" (Beauty Salón), un salón de estética y cuidado personal ubicado en Barbosa, Antioquia (Colombia).

TU PERSONALIDAD Y ROL:
- Hablas en español colombiano con un tono cálido, amable, servicial y cercano (tratas al cliente de "tú").
- Eres concisa y clara: responde en máximo 4 o 5 frases, salvo que el cliente pida ver varios servicios o precios detallados.
- Usas emojis sutiles (💅, ✨, 📅, 💬) con moderación para transmitir calidez.
- Tu objetivo principal es resolver dudas sobre servicios, precios, duraciones y horarios de atención, y guiar amablemente al usuario para que agende su cita en la plataforma.

REGLAS ESTRICTAS (BASADAS EN DATOS REALES):
1. Tu única fuente de verdad es el bloque "DATOS VERIFICADOS DE BEAUTY VIRTUAL" incluido al final de este prompt, donde están inyectados dinámicamente los servicios activos (con nombre, precio y duración) y los horarios reales del salón.
2. NUNCA inventes servicios, precios, descuentos ni horarios que no aparezcan en los datos verificados.
3. Cuando te pregunten por precios o servicios, menciona el nombre exacto del servicio, su precio en pesos colombianos (COP) y su duración en minutos.
4. Cuando el usuario quiera agendar, reservar o pedir una cita:
   - Explícale con amabilidad que puede agendar en segundos desde la sección "Agendar mi cita" (o entrando a "Mi agenda" / "/dashboard" tras iniciar sesión con su número de teléfono), eligiendo el servicio, profesional, fecha y hora disponible.
   - También puedes ofrecerle el WhatsApp o teléfono oficial del salón si prefiere atención personalizada.
5. Si el usuario pregunta algo que no está en los datos del salón, indícale amablemente que no tienes ese dato específico y facilítale el WhatsApp y teléfono del salón.

FORMATO DE RESPUESTA:
- Usa texto claro y fácil de leer en un chat móvil.
- Si listas servicios o horarios, usa viñetas cortas con "- ".
- Cierra siempre con una invitación cálida a agendar su cita o resolver cualquier otra duda.`;

export const UNKNOWN_ANSWER_FALLBACK =
  'Por ahora no tengo esa información disponible. Puedes escribirnos por WhatsApp o llamarnos directamente al salón para asesorarte.';

/**
 * Construye el System Instruction final inyectando dinámicamente los servicios activos
 * y horarios del negocio.
 */
export const buildSystemInstruction = (context: ChatContext, user?: AuthUser | null): string =>
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

/** Convierte errores de la API de Gemini en mensajes claros en español. */
const mapGeminiError = (error: unknown): AppError => {
  const err = error as {
    status?: number;
    code?: number | string;
    message?: string;
    name?: string;
    response?: { status?: number };
  };

  const status =
    err?.status ?? (typeof err?.code === 'number' ? err.code : undefined) ?? err?.response?.status;
  const message = String(err?.message || '').toLowerCase();

  if (
    status === 429 ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted')
  ) {
    return new AppError(
      'Alcanzamos el límite de consultas de la IA en este momento. Intenta de nuevo en unos segundos.',
      429,
    );
  }
  if (status === 404 || (message.includes('not found') && message.includes('model'))) {
    return new AppError('El modelo de IA configurado no está disponible.', 503);
  }
  if (status === 401 || status === 403 || message.includes('api key not valid') || message.includes('api_key_invalid')) {
    return new AppError(
      'La clave GEMINI_API_KEY configurada no es válida. Verifica tu archivo .env.local.',
      503,
    );
  }
  if (err?.name === 'AbortError' || message.includes('aborted') || message.includes('timeout')) {
    return new AppError('La IA tardó demasiado en responder. Intenta de nuevo en un momento.', 504);
  }
  if (status === 503 || message.includes('overloaded') || message.includes('unavailable')) {
    return new AppError('El servicio de IA está temporalmente saturado. Intenta de nuevo en un momento.', 503);
  }

  return new AppError('No pudimos procesar tu mensaje en este momento. Intenta de nuevo.', 502);
};

export interface GenerateReplyResult {
  text: string;
  finishReason: string | null;
  usage: { totalTokens: number | null } | null;
}

/**
 * Genera la respuesta del asistente usando el modelo `gemini-2.5-flash` de `@google/genai`.
 */
export const generateReply = async ({
  message,
  history = [],
  context,
  user = null,
}: {
  message: string;
  history?: ChatTurn[];
  context: ChatContext;
  user?: AuthUser | null;
}): Promise<GenerateReplyResult> => {
  const ai = getClient();
  const modelName = process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = buildContents(history, message);
  const systemInstruction = buildSystemInstruction(context, user);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature: 0.35,
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
      throw new AppError('La IA devolvió una respuesta vacía. Intenta de nuevo en un momento.', 502);
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
export const checkGemini = async (): Promise<{
  ok: boolean;
  reason?: string;
  model?: string;
  available?: number;
}> => {
  const apiKey = (process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return { ok: false, reason: 'GEMINI_API_KEY no configurada' };

  try {
    const ai = getClient();
    await ai.models.list();
    return { ok: true, model: process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-2.5-flash', available: 1 };
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
