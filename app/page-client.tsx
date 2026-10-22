'use client';

/**
 * Pagina principal (landing) de Beauty Virtual.
 *
 * Muestra el catalogo de servicios y la informacion del negocio consultada
 * en tiempo real desde la API (Firestore), y guia al agendamiento.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import ServiceCard from '@/components/ServiceCard';
import { formatCurrency } from '@/lib/format';
import type { BusinessInfo, Service } from '@/lib/types';

export default function HomePage() {
  const { isAuthenticated, isConfigured } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const agendaHref = isAuthenticated ? '/dashboard' : '/login?next=%2Fdashboard';
  const facialService = services.find((service) => service.id === 'limpieza-facial-profunda');

  return (
    <div>
      {/* HERO */}
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

          {/* Tarjeta ilustrativa */}
          <div className="relative animate-pop-in">
            <div className="rounded-3xl border border-brand-100 bg-white/90 p-6 shadow-chat backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-plum-600 text-2xl">
                  💅
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-brand-800">Asistente virtual</p>
                  <p className="text-sm text-slate-500">Responde sobre servicios, precios y horarios</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-brand-50 px-4 py-2.5 text-slate-700">
                  ¿Cuánto cuesta la limpieza facial profunda?
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-plum-600 px-4 py-2.5 text-white">
                  {facialService
                    ? `Cuesta ${formatCurrency(facialService.price)} y dura ${facialService.durationMinutes} minutos. ¿La agendo?`
                    : 'Cuesta $120.000 COP y dura 60 minutos. ¿La agendo?'}
                </div>
              </div>

              <p className="mt-5 text-center text-xs text-slate-400">
                Pulsa el boton flotante para hablar con el asistente 💬
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
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

      {/* AGENDA */}
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

      {/* ASISTENTE */}
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

        {!isConfigured && (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
            ⚠ Configura las variables <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code> en{' '}
            <code className="font-mono">.env.local</code> para activar el inicio de sesion y el asistente virtual.
          </p>
        )}
      </section>
    </div>
  );
}
