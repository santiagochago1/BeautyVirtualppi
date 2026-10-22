'use client';

/**
 * ChatbotWidget
 * ------------------------------------------------------------------
 * Widget flotante con el asistente virtual de Beauty Salon.
 *
 * Funcionalidades:
 *  - Boton flotante con animacion de pulso y contador de mensajes sin leer.
 *  - Panel responsivo (movil / escritorio) con cabecera degradada.
 *  - Animacion de "escribiendo" (puntos rebotando) mientras espera a la IA.
 *  - Scroll automatico al ultimo mensaje.
 *  - Manejo de errores: sin conexion, sesion expirada y limite de peticiones.
 *  - Historial limitado (ultimos 10 mensajes) para optimizar consumo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { apiRequest, ApiError } from '@/lib/api';
import { formatMessageTime } from '@/lib/format';
import type { ChatTurn } from '@/lib/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    '¡Hola! ✨ Soy el asistente virtual de Beauty Salón. Te puedo informar sobre nuestros servicios, precios, horarios y tu agenda. ¿En qué te ayudo?',
  // Sin timestamp: `new Date()` a nivel de modulo se evaluaria durante el
  // prerender de este Client Component (Next.js aborta los valores
  // inestables) y ademas generaria un desajuste de hidratacion.
  timestamp: '',
};

const MAX_HISTORY = 10;
const MAX_INPUT_LENGTH = 1000;

export default function ChatbotWidget() {
  const { isAuthenticated, isConfigured, getIdToken } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [unread, setUnread] = useState(0);

  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  /* Estado de conexion */
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  /* Scroll automatico al ultimo mensaje */
  useEffect(() => {
    if (!isOpen) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (window.matchMedia('(min-width: 640px)').matches) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  /* Apertura/cierre del panel: al abrirlo se descartan los no leidos. */
  const toggleOpen = useCallback(() => {
    setUnread(0);
    setIsOpen((open) => !open);
  }, []);

  /* Envio de mensajes */
  const sendMessage = useCallback(
    async (text?: string) => {
      const message = (text ?? input).trim();
      if (!message || isLoading) return;

      if (!isOnline) {
        setError('No tienes conexion a internet. Recuperala para seguir chateando.');
        return;
      }

      if (!isAuthenticated) {
        setError('Inicia sesion para usar el asistente virtual.');
        return;
      }

      setError(null);
      setInput('');

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: message,
        timestamp: new Date().toISOString(),
      };

      const history: ChatTurn[] = messages
        .filter((item) => item.id !== 'welcome')
        .slice(-MAX_HISTORY)
        .map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', text: item.text }));

      setMessages((current) => [...current, userMessage]);
      setIsLoading(true);

      try {
        const token = await getIdToken();
        const data = await apiRequest<{ reply: string; timestamp?: string }>('/chat', {
          method: 'POST',
          token,
          body: { message, history },
        });

        const reply: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          timestamp: data.timestamp || new Date().toISOString(),
        };

        setMessages((current) => [...current, reply]);
        if (!isOpen) setUnread((count) => count + 1);
      } catch (requestError) {
        let errorMessage = 'No pudimos responder en este momento. Intenta de nuevo en un momento.';

        if (requestError instanceof ApiError) {
          if (requestError.status === 0) {
            errorMessage = 'No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.';
          } else if (requestError.status === 429) {
            errorMessage = 'Has enviado demasiados mensajes. Espera un minuto y vuelve a intentarlo.';
          } else if (requestError.status === 401) {
            errorMessage = 'Tu sesion expiro. Cierra sesion e inicia sesion nuevamente.';
          } else if (requestError.status === 403) {
            errorMessage = 'No tienes permisos para usar el chat en este momento.';
          } else {
            errorMessage = requestError.message || errorMessage;
          }
        }

        setError(errorMessage);
        setMessages((current) => [
          ...current,
          {
            id: `e-${Date.now()}`,
            role: 'system',
            text: errorMessage,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [getIdToken, input, isAuthenticated, isLoading, isOnline, isOpen, messages],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {/* Panel del chat */}
      {isOpen && (
        <section
          role="dialog"
          aria-label="Chat con el asistente virtual"
          className="flex h-[68vh] max-h-[560px] w-[calc(100vw-2rem)] max-w-sm animate-pop-in flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-chat"
        >
          {/* Cabecera */}
          <header className="flex items-center gap-3 bg-gradient-to-r from-brand-600 via-brand-500 to-plum-600 px-4 py-3 text-white">
            <div className="relative">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg"
                aria-hidden="true"
              >
                💅
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-brand-600 bg-emerald-400" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Asistente Beauty Salón</p>
              <p className="truncate text-xs text-white/80">
                {isOnline ? 'En linea · responde en segundos' : 'Sin conexion'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar chat"
              className="rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          {!isOnline && (
            <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700">
              ⚠ Sin conexion a internet. El chat se activara al recuperarla.
            </div>
          )}

          {/* Mensajes */}
          <div
            className="chat-scroll flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-brand-50/60 to-white px-4 py-4"
            role="log"
            aria-live="polite"
          >
            {messages.map((item) => (
              <Bubble key={item.id} message={item} />
            ))}

            {isLoading && (
              <div className="flex animate-fade-in-up items-end gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-plum-600 text-sm text-white">
                  💅
                </span>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                  <Dot delay="0ms" />
                  <Dot delay="150ms" />
                  <Dot delay="300ms" />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {error && (
            <div className="flex items-start gap-2 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
              <span aria-hidden="true">⚠️</span>
              <p className="flex-1">{error}</p>
              <button type="button" onClick={() => setError(null)} className="font-semibold underline" aria-label="Cerrar aviso">
                ✕
              </button>
            </div>
          )}

          {isAuthenticated && messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 border-t border-brand-100 px-4 py-2">
              {['Ver servicios y precios', '¿Cual es el horario?', 'Quiero agendar una cita'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-brand-100 bg-white p-3">
            <label htmlFor="chat-input" className="sr-only">
              Escribe tu mensaje
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={MAX_INPUT_LENGTH}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={
                isConfigured
                  ? isAuthenticated
                    ? 'Escribe tu mensaje...'
                    : 'Inicia sesion para chatear'
                  : 'Configura Firebase para usar el chat'
              }
              className="max-h-28 flex-1 resize-none rounded-2xl border border-brand-200 bg-brand-50/40 px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !isAuthenticated}
              aria-label="Enviar mensaje"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-plum-600 text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </form>

          {!isAuthenticated && (
            <div className="border-t border-brand-100 bg-brand-50/60 px-4 py-3 text-center text-xs text-slate-600">
              <Link href="/login" className="font-semibold text-brand-700 underline">
                Inicia sesion
              </Link>{' '}
              para hablar con el asistente virtual.
            </div>
          )}
        </section>
      )}

      {/* Boton flotante */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={isOpen ? 'Cerrar asistente virtual' : 'Abrir asistente virtual'}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 via-brand-600 to-plum-600 text-2xl text-white shadow-chat transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-brand-200 active:scale-95"
      >
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-400 opacity-60" aria-hidden="true" />
        <span className="relative">{isOpen ? '✕' : '💬'}</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{message.text}</div>
    );
  }

  return (
    <div className={`flex animate-fade-in-up items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-plum-600 text-sm text-white">
          💅
        </span>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-brand-500 to-plum-600 text-white'
            : 'rounded-bl-md border border-brand-100 bg-white text-slate-700'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        {formatMessageTime(message.timestamp) && (
          <span className={`mt-1 block text-[10px] ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
            {formatMessageTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce-dot rounded-full bg-brand-400"
      style={{ animationDelay: delay }}
      aria-hidden="true"
    />
  );
}
