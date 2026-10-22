/**
 * Servicio de chat: orquesta contexto + historial + IA.
 *
 * Reglas:
 *  - El historial se limita a los ultimos 10 mensajes (memoria del servidor).
 *  - El contexto se construye SIEMPRE con datos de Firestore.
 *  - Si la IA falla se devuelve un mensaje amable con datos de contacto.
 */
import { buildChatContext } from '@/lib/server/services/context';
import { generateReply } from '@/lib/server/services/ai';
import { getHistory, saveTurn } from '@/lib/server/services/conversation';
import { getBusinessInfo } from '@/lib/server/models/business-info';
import { createLogger } from '@/lib/server/logger';
import type { AuthUser } from '@/lib/server/auth';
import type { BusinessInfo } from '@/lib/types';

const logger = createLogger('chat');

const CONTACT_FALLBACK = {
  phone: '+57 604 000 0000',
  whatsapp: '+57 300 000 0000',
  email: 'contacto@beautysalon.co',
};

const buildFallbackMessage = (business: BusinessInfo | null) => {
  const phone = business?.phone || CONTACT_FALLBACK.phone;
  const whatsapp = business?.whatsapp || CONTACT_FALLBACK.whatsapp;
  const email = business?.email || CONTACT_FALLBACK.email;
  return `Perdon, tengo problemas tecnicos en este momento y no pude responder tu mensaje. Puedes contactarnos al telefono ${phone}, por WhatsApp al ${whatsapp} o escribirnos a ${email}.`;
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
 * Procesa un mensaje del usuario.
 */
export const sendMessage = async ({
  user,
  message,
  history = [],
}: {
  user: AuthUser;
  message: string;
  history?: unknown[];
}): Promise<SendMessageResult> => {
  const key = user.uid || 'anon';
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
    logger.warn('Fallo al generar la respuesta de la IA', (error as Error)?.message);
    const business = context.business || (await getBusinessInfo().catch(() => null));
    const reply = buildFallbackMessage(business);
    saveTurn(key, message, reply);
    return {
      reply,
      fallback: true,
      timestamp: new Date().toISOString(),
      error: (error as Error)?.message,
    };
  }
};

const chatService = { sendMessage };

export default chatService;
