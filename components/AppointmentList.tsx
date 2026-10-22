'use client';

/**
 * Lista de citas con acciones segun el rol del usuario.
 */
import { useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatLongDate, formatTime } from '@/lib/format';
import type { Appointment, AppointmentStatus } from '@/lib/types';

const EMPLOYEE_ACTIONS: Array<{ status: AppointmentStatus; label: string; className: string }> = [
  { status: 'confirmed', label: 'Confirmar', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { status: 'completed', label: 'Completar', className: 'bg-slate-700 text-white hover:bg-slate-800' },
  { status: 'cancelled', label: 'Cancelar', className: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50' },
];

export default function AppointmentList({
  appointments = [],
  onUpdated,
  showClient = true,
}: {
  appointments?: Appointment[];
  onUpdated?: (appointment: Appointment) => void;
  showClient?: boolean;
}) {
  const { getIdToken, role } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';

  const changeStatus = async (appointmentId: string, status: AppointmentStatus) => {
    setBusyId(appointmentId);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await apiRequest<{ appointment: Appointment }>(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      onUpdated?.(data.appointment);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible actualizar la cita.'));
    } finally {
      setBusyId(null);
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="card text-sm text-slate-500">
        Todavia no hay citas registradas. Usa el formulario para agendar tu primera cita.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {appointments.map((appointment) => {
        const canCancel =
          (showClient || isAdmin) &&
          appointment.status !== 'cancelled' &&
          appointment.status !== 'completed' &&
          (isAdmin || role === 'client');

        return (
          <article key={appointment.id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-slate-800">{appointment.serviceName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  📅 {formatLongDate(appointment.date)} · 🕒 {formatTime(appointment.time)} · ⏱ {appointment.durationMinutes} min
                </p>
                <p className="mt-1 text-sm font-medium text-brand-700">{formatCurrency(appointment.servicePrice)}</p>
                {showClient && appointment.userName && (
                  <p className="mt-1 text-xs text-slate-500">Cliente: {appointment.userName}</p>
                )}
                {appointment.employeeName && (
                  <p className="mt-1 text-xs text-slate-500">Profesional: {appointment.employeeName}</p>
                )}
                {appointment.notes && <p className="mt-2 text-xs italic text-slate-500">“{appointment.notes}”</p>}
              </div>

              <StatusBadge status={appointment.status} />
            </div>

            {(isEmployee || isAdmin) && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-50 pt-3">
                {EMPLOYEE_ACTIONS.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    disabled={busyId === appointment.id}
                    onClick={() => changeStatus(appointment.id, action.status)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${action.className}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {canCancel && (
              <div className="mt-4 border-t border-brand-50 pt-3">
                <button
                  type="button"
                  disabled={busyId === appointment.id}
                  onClick={() => changeStatus(appointment.id, 'cancelled')}
                  className="rounded-full border border-rose-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Cancelar cita
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
