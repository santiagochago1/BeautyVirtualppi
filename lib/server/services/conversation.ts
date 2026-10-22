/**
 * Memoria de conversaciones en el backend.
 *
 * Se mantiene en memoria (Map) con los ultimos N mensajes por usuario
 * (CHAT_HISTORY_LIMIT, 10 por defecto) para optimizar tokens y memoria.
 * La memoria expira tras 30 minutos de inactividad.
 *
 * Nota: el estado vive en memoria del proceso. En despliegues serverless cada
 * instancia tiene su propio historial (igual que el backend Express original).
 */
import env from '@/lib/server/env';
import type { ChatTurn } from '@/lib/types';

const TTL_MS = 30 * 60 * 1000; // 30 minutos de inactividad
const store = new Map<string, { messages: ChatTurn[]; updatedAt: number }>();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.updatedAt > TTL_MS) store.delete(key);
  }
};

const timer = setInterval(cleanup, 5 * 60 * 1000);
if (typeof timer.unref === 'function') timer.unref();

/** Normaliza un mensaje a { role, text }. */
const normalizeMessage = (message: unknown): ChatTurn | null => {
  if (!message || typeof message !== 'object') return null;
  const raw = message as { role?: unknown; text?: unknown };
  const role =
    raw.role === 'assistant' || raw.role === 'model'
      ? 'model'
      : raw.role === 'user'
        ? 'user'
        : null;
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 2000) : '';
  if (!role || !text) return null;
  return { role, text };
};

/**
 * Devuelve el historial (ultimos N mensajes) del usuario, ya sea desde la
 * memoria del servidor o desde el historial enviado por el cliente.
 */
export const getHistory = (key: string, clientHistory: unknown[] = []): ChatTurn[] => {
  const limit = env.CHAT_HISTORY_LIMIT;
  const entry = store.get(key);

  const fromMemory: ChatTurn[] = entry ? entry.messages.map((message) => ({ ...message })) : [];
  const fromClient: ChatTurn[] = Array.isArray(clientHistory)
    ? clientHistory.map(normalizeMessage).filter((item): item is ChatTurn => item !== null)
    : [];

  // Priorizamos la memoria del servidor; si esta vacia usamos la del cliente.
  const merged: ChatTurn[] = (fromMemory.length > 0 ? fromMemory : fromClient).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    text: m.text,
  } as ChatTurn));

  return merged.slice(-limit);
};

/** Guarda los mensajes (ultimo turno) en la memoria del usuario. */
export const saveTurn = (key: string, userMessage: string, assistantMessage: string): void => {
  const limit = env.CHAT_HISTORY_LIMIT;
  const entry = store.get(key) || { messages: [] as ChatTurn[], updatedAt: Date.now() };

  const turns: ChatTurn[] = [
    { role: 'user', text: userMessage },
    { role: 'model', text: assistantMessage },
  ];

  const messages: ChatTurn[] = [...entry.messages, ...turns].slice(-limit);

  store.set(key, { messages, updatedAt: Date.now() });
};

/** Limpia la memoria de un usuario (al cerrar sesion, por ejemplo). */
export const clearHistory = (key: string): void => {
  store.delete(key);
};

/** Cantidad de conversaciones activas (metricas). */
export const getStoreSize = (): number => store.size;
