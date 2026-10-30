/**
 * Servicio de chat: orquesta contexto + historial + IA (Gemini 2.5 Flash).
 *
 * Reglas:
 *  - El historial se limita a los ultimos 10 mensajes.
 *  - El contexto se construye SIEMPRE con los servicios activos y horarios reales de Firestore.
 *  - Si la IA falla (o falta GEMINI_API_KEY), responde de forma inteligente con los datos reales
 *    del catálogo y horarios del negocio.
 */
import { buildChatContext, type ChatContext } from '@/lib/server/services/context';
import { generateReply } from '@/lib/server/services/ai';
import { getHistory, saveTurn } from '@/lib/server/services/conversation';
import { normalizeBusinessHours } from '@/lib/schedule-utils';
import { createLogger } from '@/lib/server/logger';
import type { AuthUser } from '@/lib/server/auth';

const logger = createLogger('chat');

const formatCop = (value: unknown): string => `$${Number(value || 0).toLocaleString('es-CO')} COP`;

/**
 * Respuesta inteligente de respaldo basada en los servicios activos y horarios reales
 * cuando Gemini no está disponible temporalmente.
 */
const buildSmartContextualFallback = (message: string, context: ChatContext): string => {
  const lower = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const { business, services } = context;
  const activeServices = services.filter((s) => s.active !== false);

  // Busca si el usuario preguntó por un servicio específico
  const matchedService = activeServices.find((service) => {
    const cleanName = service.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return (
      lower.includes(cleanName) ||
      cleanName
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((word) => lower.includes(word))
    );
  });

  if (matchedService) {
    return `¡Claro que sí! ✨ En Beauty Virtual (${business.city || 'Barbosa, Antioquia'}) el servicio de ${matchedService.name} tiene un valor de ${formatCop(matchedService.price)} y una duración aproximada de ${matchedService.durationMinutes} minutos.${
      matchedService.description ? ` ${matchedService.description}` : ''
    } ¿Te gustaría agendar tu cita desde el botón "Agendar mi cita"?`;
  }

  if (lower.includes('horario') || lower.includes('abren') || lower.includes('cierran') || lower.includes('atencion') || lower.includes('dias')) {
    const hoursLines = normalizeBusinessHours(business.hours)
      .map((h) => {
        const open = h.openTime || h.open;
        const close = h.closeTime || h.close;
        return h.isOpen === false || !open || open === '00:00'
          ? `- ${h.day}: Cerrado`
          : `- ${h.day}: ${open} a ${close}`;
      })
      .join('\n');

    return `¡Hola! 🕒 Nuestros horarios de atención en ${business.name || 'Beauty Virtual'} (${business.address}, ${business.city}) son:\n${hoursLines}\n\nPuedes agendar tu cita en línea en cualquier momento desde la sección "Agendar mi cita".`;
  }

  if (lower.includes('precio') || lower.includes('servicio') || lower.includes('catalogo') || lower.includes('cuanto') || lower.includes('cuesta') || lower.includes('valor')) {
    const list = activeServices
      .slice(0, 8)
      .map((s) => `- ${s.name}: ${formatCop(s.price)} (${s.durationMinutes} min)`)
      .join('\n');

    return `¡Con mucho gusto! 💅 Estos son nuestros servicios activos en Beauty Virtual (${business.city || 'Barbosa, Antioquia'}):\n${list}\n\n¿Cuál de estos servicios te gustaría agendar hoy?`;
  }

  if (lower.includes('agendar') || lower.includes('cita') || lower.includes('reservar') || lower.includes('turno')) {
    return `¡Encantada de ayudarte a agendar! 📅 Para reservar tu cita en Beauty Virtual:\n- Pulsa en "Agendar mi cita" o inicia sesión con tu número de teléfono.\n- Elige el servicio, el profesional de tu preferencia, la fecha y la hora disponible.\nTambién puedes escribirnos por WhatsApp al ${business.whatsapp || business.phone}.`;
  }

  const previewServices = activeServices
    .slice(0, 4)
    .map((s) => `- ${s.name}: ${formatCop(s.price)} (${s.durationMinutes} min)`)
    .join('\n');

  return `¡Hola! ✨ Te doy la bienvenida a ${business.name || 'Beauty Virtual'} en ${business.city || 'Barbosa'}, ${business.department || 'Antioquia'}. Algunos de nuestros servicios destacados son:\n${previewServices}\n\nPregúntame por precios, horarios de atención o pulsa en "Agendar mi cita" para reservar tu turno. 💬`;
};

export interface SendMessageResult {
  reply: string;
  finishReason?: string | null;
  timestamp: string;
  usage?: { totalTokens: number | null } | null;
  fallback?: boolean;
  error?: string;
}

/**
 * Procesa un mensaje del usuario (autenticado o visitante en la landing).
 */
export const sendMessage = async ({
  user = null,
  sessionKey = 'anon',
  message,
  history = [],
}: {
  user?: AuthUser | null;
  sessionKey?: string;
  message: string;
  history?: unknown[];
}): Promise<SendMessageResult> => {
  const key = user?.uid || sessionKey || 'anon';
  const context = await buildChatContext(user);
  const previous = getHistory(key, history);

  try {
    const { text, finishReason, usage } = await generateReply({
      message,
      history: previous,
      context,
      user,
    });

    saveTurn(key, message, text);

    return {
      reply: text,
      finishReason,
      timestamp: new Date().toISOString(),
      usage: usage ? { totalTokens: usage.totalTokens ?? null } : null,
    };
  } catch (error) {
    logger.warn('Usando respuesta contextual de respaldo para el chat:', (error as Error)?.message);
    const reply = buildSmartContextualFallback(message, context);
    saveTurn(key, message, reply);
    return {
      reply,
      fallback: true,
      timestamp: new Date().toISOString(),
    };
  }
};

const chatService = { sendMessage };

export default chatService;
