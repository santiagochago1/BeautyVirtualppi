'use client';

/**
 * Agenda del profesional (empleado) y vista operativa del administrador.
 */
import { useCallback, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppointmentCalendar from '@/components/AppointmentCalendar';
import AppointmentList from '@/components/AppointmentList';
import LoadingSpinner from '@/components/LoadingSpinner';
import StatusBadge from '@/components/StatusBadge';
import { apiRequest } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth } from '@/components/AuthProvider';
import {
  buildWhatsAppConfirmUrl,
  extractPhoneFromAuthEmail,
  formatLongDate,
  formatTime,
  todayISO,
} from '@/lib/format';
import type { Appointment } from '@/lib/types';

const FILTERS = [
  { id: 'today', label: 'Hoy' },
  { id: 'upcoming', label: 'Proximas' },
  { id: 'all', label: 'Todas' },
];

function EmployeeAgenda() {
  const { getIdToken, role, profile } = useAuth();
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar');
  const [filter, setFilter] = useState('today');

  const fetchAppointments = useCallback(async (): Promise<Appointment[]> => {
    const token = await getIdToken();
    const data = await apiRequest<{ appointments: Appointment[] }>('/appointments', { token });
    return data.appointments || [];
  }, [getIdToken]);

  const {
    data: appointments,
    error,
    loading,
    reload,
  } = useAsyncData(fetchAppointments, {
    initialData: [] as Appointment[],
    errorMessage: 'No fue posible cargar la agenda.',
  });

  const filtered = useMemo(() => {
    const today = todayISO();
    if (filter === 'today') return appointments.filter((item) => item.date === today && item.status !== 'cancelled');
    if (filter === 'upcoming') return appointments.filter((item) => item.date > today && item.status !== 'cancelled');
    return appointments;
  }, [appointments, filter]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Appointment[]>>((acc, item) => {
      acc[item.date] = acc[item.date] || [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando la agenda..." />
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {role === 'admin' ? 'Vista de administrador' : 'Profesional'}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-brand-800">Agenda diaria</h1>
          <p className="mt-2 text-slate-600">
            {role === 'admin'
              ? 'Vista horaria con columnas paralelas por cada profesional y duraciones proporcionales.'
              : `Hola ${profile?.name?.split(' ')[0] || ''}, esta es tu agenda horaria del dia.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-brand-100 bg-white p-1">
            <button
              type="button"
              onClick={() => setDisplayMode('calendar')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                displayMode === 'calendar'
                  ? 'bg-gradient-to-r from-brand-500 to-plum-600 text-white'
                  : 'text-slate-600 hover:text-brand-700'
              }`}
            >
              🕒 Agenda horaria
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                displayMode === 'list'
                  ? 'bg-gradient-to-r from-brand-500 to-plum-600 text-white'
                  : 'text-slate-600 hover:text-brand-700'
              }`}
            >
              📋 Lista
            </button>
          </div>

          {displayMode === 'list' && (
            <div className="flex gap-2 rounded-full border border-brand-100 bg-white p-1">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    filter === item.id
                      ? 'bg-gradient-to-r from-brand-500 to-plum-600 text-white'
                      : 'text-slate-600 hover:text-brand-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {error && <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {displayMode === 'calendar' ? (
        <AppointmentCalendar appointments={appointments} onUpdated={() => void reload()} />
      ) : filtered.length === 0 ? (
        <div className="card text-sm text-slate-500">No hay citas para mostrar en este filtro.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 font-display text-lg font-semibold capitalize text-brand-700">
                {formatLongDate(date)} · {items.length} cita{items.length === 1 ? '' : 's'}
              </h2>

              <div className="grid gap-3 md:grid-cols-2">
                {items.map((appointment) => {
                  const clientPhone =
                    appointment.userPhone || extractPhoneFromAuthEmail(appointment.userEmail) || '';
                  const whatsappUrl = buildWhatsAppConfirmUrl({
                    phone: clientPhone,
                    clientName: appointment.userName || 'Cliente',
                    serviceName: appointment.serviceName,
                    date: appointment.date,
                    time: appointment.time,
                  });

                  return (
                    <article key={appointment.id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-base font-semibold text-slate-800">
                            {formatTime(appointment.time)} · {appointment.serviceName}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Cliente: <strong className="font-semibold text-slate-700">{appointment.userName}</strong>
                          </p>
                          {appointment.employeeName && role === 'admin' && (
                            <p className="text-xs text-brand-700">Profesional: {appointment.employeeName}</p>
                          )}
                          {clientPhone && <p className="text-xs text-slate-500">📱 Tel: {clientPhone}</p>}
                          {appointment.notes && <p className="mt-2 text-xs italic text-slate-500">“{appointment.notes}”</p>}
                        </div>
                        <StatusBadge status={appointment.status} />
                      </div>

                      <div className="mt-3 border-t border-brand-50 pt-3">
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.44-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.85 9.85 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 6.99 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.88 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                          </svg>
                          Confirmar por WhatsApp
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-800">Gestionar estados</h2>
        <AppointmentList appointments={appointments} onUpdated={() => void reload()} showClient={role === 'admin'} />
      </div>
    </div>
  );
}

export default function EmployeePage() {
  return (
    <ProtectedRoute roles={['employee', 'admin']}>
      <EmployeeAgenda />
    </ProtectedRoute>
  );
}
