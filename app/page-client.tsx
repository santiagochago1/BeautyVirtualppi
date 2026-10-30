'use client';

/**
 * Pagina principal (landing) de Beauty Virtual.
 *
 * Muestra el catalogo de servicios y la informacion del negocio consultada
 * en tiempo real desde la API (Firestore), y guia al agendamiento.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import ServiceCard from '@/components/ServiceCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatCurrency } from '@/lib/format';
import type { BusinessInfo, ChatTurn, Service } from '@/lib/types';

interface LandingChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isConfigured, role, loading: authLoading, getIdToken } = useAuth();
  const isStaff = role === 'admin' || role === 'employee';
  const [services, setServices] = useState<Service[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Estado del chat interactivo de la Landing Page
  const [chatMessages, setChatMessages] = useState<LandingChatMessage[]>([
    {
      id: 'welcome-landing',
      role: 'assistant',
      text: '¡Hola! ✨ Soy la recepcionista virtual de Beauty Virtual en Barbosa, Antioquia. Pregúntame por precios, horarios o cómo agendar tu cita.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isStaff) {
      router.replace('/employee');
    }
  }, [authLoading, isAuthenticated, isStaff, router]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [servicesData, businessData] = await Promise.all([
          apiRequest<{ services: Service[] }>('/services'),
          apiRequest<{ business: BusinessInfo }>('/business'),
        ]);
        if (cancelled) return;
        setServices(servicesData.services || []);
        setBusiness(businessData.business || null);
      } catch (requestError: unknown) {
        if (!cancelled) setError(getErrorMessage(requestError, 'No fue posible cargar la informacion del salon.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, Service[]>();
    services.forEach((service) => {
      const category = service.category || 'General';
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(service);
    });
    return Array.from(map.entries());
  }, [services]);

  const agendaHref = !isAuthenticated
    ? '/login?next=%2Fdashboard'
    : isStaff
      ? '/employee'
      : '/dashboard';
  const facialService = services.find((service) => service.id === 'limpieza-facial-profunda');

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const sendLandingChat = async (textOverride?: string) => {
    const message = (textOverride ?? chatInput).trim();
    if (!message || chatLoading) return;

    const userMsg: LandingChatMessage = {
      id: `lu-${Date.now()}`,
      role: 'user',
      text: message,
    };

    const history: ChatTurn[] = chatMessages
      .filter((m) => m.id !== 'welcome-landing')
      .slice(-10)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text,
      }));

    setChatInput('');
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const token = await getIdToken().catch(() => null);
      const res = await apiRequest<{ reply: string }>('/chat', {
        method: 'POST',
        token,
        body: { message, history },
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `la-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
        },
      ]);
    } catch (err: unknown) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `le-${Date.now()}`,
          role: 'assistant',
          text: getErrorMessage(
            err,
            'En este momento no pude procesar tu mensaje. Intenta nuevamente en unos segundos.',
          ),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (isAuthenticated && isStaff) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Redirigiendo a tu agenda diaria..." />
      </div>
    );
  }

  return (
    <div>
      {/* HERO */}
      {!isStaff && (
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-plum-50">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-plum-100/60 blur-3xl" />

          <div className="container-page relative grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-1.5 text-xs font-semibold text-brand-700">
                ✨ Barbosa, Antioquia · Ahora con asistente virtual
              </span>

              <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-brand-800 sm:text-5xl lg:text-6xl">
                Tu belleza merece el{' '}
                <span className="bg-gradient-to-r from-brand-500 to-plum-600 bg-clip-text text-transparent">
                  mejor cuidado
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                En <strong>Beauty Salón</strong> encuentras tratamientos faciales y corporales, manicure, pedicure y
                depilación. Agenda en línea y resuelve tus dudas con nuestro asistente virtual, disponible a cualquier hora.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={agendaHref} className="btn-primary">
                  Agendar mi cita
                </Link>
                <a href="#servicios" className="btn-secondary">
                  Ver servicios y precios
                </a>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
                <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Servicios</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-brand-700">{services.length || '—'}</dd>
                </div>
                <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Atencion</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-brand-700">6 días</dd>
                </div>
                <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Asistente</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-brand-700">24/7</dd>
                </div>
              </dl>
            </div>

            {/* Tarjeta interactiva del Asistente Virtual en la Landing Page */}
            <div className="relative animate-pop-in">
              <div className="rounded-3xl border border-brand-100 bg-white/95 p-6 shadow-chat backdrop-blur">
                <div className="flex items-center justify-between gap-3 border-b border-brand-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-plum-600 text-2xl text-white">
                      💅
                    </span>
                    <div>
                      <p className="font-display text-lg font-semibold text-brand-800">Asistente virtual</p>
                      <p className="text-xs text-slate-500">
                        Recepcionista IA · Precios, horarios y citas en Barbosa
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> En línea
                  </span>
                </div>

                {/* Historial de mensajes */}
                <div
                  ref={chatScrollRef}
                  className="chat-scroll mt-4 max-h-64 min-h-[180px] space-y-3 overflow-y-auto pr-1 text-sm"
                  role="log"
                  aria-live="polite"
                >
                  {chatMessages.length === 1 && facialService && (
                    <div className="rounded-2xl bg-brand-50/60 px-3.5 py-2 text-xs text-slate-500">
                      💡 Ejemplo: la <strong>{facialService.name}</strong> cuesta{' '}
                      {formatCurrency(facialService.price)} ({facialService.durationMinutes} min).
                    </div>
                  )}

                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        msg.role === 'user'
                          ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-plum-600 px-4 py-2.5 text-white shadow-xs'
                          : 'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-brand-100 bg-brand-50/70 px-4 py-2.5 text-slate-700'
                      }
                    >
                      {msg.text}
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-brand-100 bg-white px-4 py-2.5 shadow-xs">
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 animate-bounce-dot rounded-full bg-brand-400"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce-dot rounded-full bg-brand-400"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce-dot rounded-full bg-brand-400"
                          style={{ animationDelay: '300ms' }}
                        />
                      </span>
                      <span className="text-xs font-medium text-slate-400">Escribiendo...</span>
                    </div>
                  )}
                </div>

                {/* Sugerencias rápidas */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    '¿Cuánto cuesta la limpieza facial?',
                    '¿Cuáles son los horarios?',
                    '¿Cómo agendo mi cita?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={chatLoading}
                      onClick={() => void sendLandingChat(prompt)}
                      className="rounded-full border border-brand-200 bg-brand-50/50 px-3 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Input y botón de enviar conectado a POST /api/chat */}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendLandingChat();
                  }}
                  className="mt-3 flex items-center gap-2 border-t border-brand-100 pt-3"
                >
                  <label htmlFor="landing-chat-input" className="sr-only">
                    Pregunta al asistente virtual
                  </label>
                  <input
                    id="landing-chat-input"
                    type="text"
                    value={chatInput}
                    disabled={chatLoading}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Escribe tu pregunta sobre servicios o precios..."
                    className="input-field py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    aria-label="Enviar mensaje al asistente"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-plum-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SERVICIOS */}
      {!isStaff && (
        <section id="servicios" className="container-page py-16">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-brand-800">Nuestros servicios</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Precios y duraciones actualizados en tiempo real. Si tienes dudas, nuestro asistente virtual te orienta.
            </p>
          </div>

          {loading && (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-48 animate-pulse rounded-2xl border border-brand-100 bg-brand-50/50" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
              {error}
            </div>
          )}

          {!loading && !error && services.length === 0 && (
            <p className="mt-10 text-center text-slate-500">El catalogo estara disponible muy pronto.</p>
          )}

          <div className="mt-10 space-y-12">
            {categories.map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-5 font-display text-xl font-semibold text-brand-700">{category}</h3>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((service) => (
                    <ServiceCard key={service.id} service={service} onSelect={() => window.location.assign(agendaHref)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AGENDA */}
      {!isStaff && (
        <section id="agenda" className="bg-gradient-to-br from-brand-600 via-brand-500 to-plum-600 py-16 text-white">
          <div className="container-page grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold">Agenda tu cita en segundos</h2>
              <p className="mt-4 max-w-lg text-white/90">
                Crea tu cuenta, elige el servicio, el dia y la hora que prefieras. Recibiras la confirmacion en tu panel y
                el profesional de turno la vera al instante.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/90">
                <li>✓ Sin llamadas: agenda a la hora que quieras</li>
                <li>✓ Recordatorios y gestion de citas en tu panel</li>
                <li>✓ Asistente virtual disponible 24/7</li>
              </ul>
              <Link
                href={agendaHref}
                className="mt-8 inline-flex rounded-full bg-white px-7 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                {isAuthenticated ? 'Ir a mi agenda' : 'Crear mi cuenta'}
              </Link>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur">
              <h3 className="font-display text-lg font-semibold">{business?.name || 'Beauty Salón'}</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/90">
                <li>
                  📍 {business?.address}, {business?.city}
                </li>
                <li>📞 {business?.phone}</li>
                <li>💬 WhatsApp {business?.whatsapp}</li>
                <li>✉️ {business?.email}</li>
              </ul>

              <div className="mt-5 border-t border-white/20 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Horarios</p>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-white/90">
                  {(business?.hours || []).map((item) => (
                    <li key={item.day} className="flex justify-between gap-2">
                      <span>{item.day}</span>
                      <span className={!item.open || item.open === '00:00' ? 'text-white/60' : ''}>
                        {!item.open || item.open === '00:00' ? 'Cerrado' : `${item.open} - ${item.close}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ASISTENTE */}
      {!isStaff && (
        <section className="container-page py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: '💬',
                title: 'Asistente 24/7',
                text: 'Resuelve dudas de precios, horarios y servicios en cualquier momento del dia.',
              },
              {
                icon: '🔒',
                title: 'Informacion verificada',
                text: 'El asistente responde solo con datos reales del salon: nunca inventa precios ni politicas.',
              },
              {
                icon: '📅',
                title: 'Agenda simple',
                text: 'Consulta, reagenda o cancela tus citas desde tu panel, sin llamadas ni esperas.',
              },
            ].map((item) => (
              <div key={item.title} className="card">
                <span className="text-3xl">{item.icon}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-brand-800">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>

          {isClient && !isConfigured && (
            <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
              ⚠ Configura las variables <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code> en{' '}
              <code className="font-mono">.env.local</code> para activar el inicio de sesion y el asistente virtual.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
