'use client';

/**
 * Agenda del profesional (empleado) y vista operativa del administrador.
 */
import { useCallback, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppointmentList from '@/components/AppointmentList';
import LoadingSpinner from '@/components/LoadingSpinner';
import StatusBadge from '@/components/StatusBadge';
import { apiRequest } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth } from '@/components/AuthProvider';
import { formatLongDate, formatTime, todayISO } from '@/lib/format';
import type { Appointment } from '@/lib/types';

const FILTERS = [
  { id: 'today', label: 'Hoy' },
  { id: 'upcoming', label: 'Proximas' },
  { id: 'all', label: 'Todas' },
];

function EmployeeAgenda() {
  const { getIdToken, role, profile } = useAuth();
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
          <h1 className="mt-1 font-display text-3xl font-bold text-brand-800">Agenda del dia</h1>
          <p className="mt-2 text-slate-600">
            {role === 'admin'
              ? 'Todas las citas registradas en el salon.'
              : `Hola ${profile?.name?.split(' ')[0] || ''}, estas son tus citas asignadas.`}
          </p>
        </div>

        <div className="flex gap-2 rounded-full border border-brand-100 bg-white p-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === item.id ? 'bg-gradient-to-r from-brand-500 to-plum-600 text-white' : 'text-slate-600 hover:text-brand-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {filtered.length === 0 ? (
        <div className="card text-sm text-slate-500">No hay citas para mostrar en este filtro.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 font-display text-lg font-semibold capitalize text-brand-700">
                {formatLongDate(date)} · {items.length} cita{items.length === 1 ? '' : 's'}
              </h2>

              <div className="grid gap-3 md:grid-cols-2">
                {items.map((appointment) => (
                  <article key={appointment.id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-base font-semibold text-slate-800">
                          {formatTime(appointment.time)} · {appointment.serviceName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Cliente: <strong className="font-semibold text-slate-700">{appointment.userName}</strong>
                        </p>
                        {appointment.userPhone && <p className="text-xs text-slate-500">Tel: {appointment.userPhone}</p>}
                        {appointment.notes && <p className="mt-2 text-xs italic text-slate-500">“{appointment.notes}”</p>}
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  </article>
                ))}
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
