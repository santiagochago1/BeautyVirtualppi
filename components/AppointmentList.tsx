'use client';

/**
 * Lista de citas con acciones segun el rol del usuario.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import StatusBadge from '@/components/StatusBadge';
import CancelAppointmentModal from '@/components/CancelAppointmentModal';
import {
  buildWhatsAppConfirmUrl,
  extractPhoneFromAuthEmail,
  formatCurrency,
  formatLongDate,
  formatTime,
} from '@/lib/format';
import { isBreakAppointment } from '@/lib/schedule-utils';
import type { Appointment, AppointmentStatus } from '@/lib/types';

const EMPLOYEE_ACTIONS: Array<{ status: AppointmentStatus; label: string; className: string }> = [
  { status: 'confirmed', label: 'Confirmar', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { status: 'completed', label: 'Completar', className: 'bg-slate-700 text-white hover:bg-slate-800' },
  { status: 'cancelled', label: 'Cancelar cita', className: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50' },
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
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Appointment>>({});

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';

  useEffect(() => {
    if (!successBanner) return undefined;
    const timer = setTimeout(() => setSuccessBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [successBanner]);

  const effectiveAppointments = useMemo(
    () => appointments.map((item) => localOverrides[item.id] || item),
    [appointments, localOverrides],
  );

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

      setLocalOverrides((prev) => ({
        ...prev,
        [appointmentId]: data.appointment,
      }));

      if (status === 'cancelled') {
        setAppointmentToCancel(null);
        setSuccessBanner('Cita cancelada correctamente');
      }

      const statusMessages: Record<AppointmentStatus, { title: string; description: string; variant: 'success' | 'info' | 'warning' }> = {
        confirmed: {
          title: 'Cita confirmada',
          description: `La cita de ${data.appointment.serviceName} fue confirmada.`,
          variant: 'success',
        },
        completed: {
          title: 'Cita completada',
          description: `La cita de ${data.appointment.serviceName} fue marcada como completada.`,
          variant: 'success',
        },
        cancelled: {
          title: 'Cita cancelada correctamente',
          description: `El turno de ${data.appointment.serviceName} quedó liberado.`,
          variant: 'success',
        },
        blocked: {
          title: 'Descanso bloqueado',
          description: 'El bloqueo de descanso fue actualizado.',
          variant: 'info',
        },
        pending: {
          title: 'Estado actualizado',
          description: `La cita de ${data.appointment.serviceName} está pendiente.`,
          variant: 'info',
        },
      };

      const feedback = statusMessages[status];
      if (feedback) {
        toast.showToast(feedback);
      }

      onUpdated?.(data.appointment);
    } catch (requestError: unknown) {
      const errMsg = getErrorMessage(requestError, 'No fue posible actualizar la cita.');
      setError(errMsg);
      toast.error('Error al actualizar cita', errMsg);
    } finally {
      setBusyId(null);
    }
  };

  if (effectiveAppointments.length === 0) {
    return (
      <div className="card text-sm text-slate-500">
        Todavia no hay citas registradas. Usa el formulario para agendar tu primera cita.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {successBanner && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ {successBanner}
        </p>
      )}

      {effectiveAppointments.map((appointment) => {
        const isBreak = isBreakAppointment(appointment);
        const canCancel =
          !isBreak &&
          appointment.status !== 'cancelled' &&
          appointment.status !== 'completed' &&
          role === 'client';

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
          <article
            key={appointment.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              isBreak
                ? 'border-slate-300 bg-slate-100/80'
                : 'border-brand-100 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-slate-800">
                  {isBreak ? '☕ Descanso / Almuerzo' : appointment.serviceName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  📅 {formatLongDate(appointment.date)} · 🕒 {formatTime(appointment.time)} · ⏱ {appointment.durationMinutes} min
                </p>
                {!isBreak && (
                  <p className="mt-1 text-sm font-medium text-brand-700">{formatCurrency(appointment.servicePrice)}</p>
                )}
                {!isBreak && showClient && appointment.userName && (
                  <p className="mt-1 text-xs text-slate-500">
                    Cliente: {appointment.userName}
                    {clientPhone ? ` · 📱 ${clientPhone}` : ''}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Profesional: <strong className="font-medium text-slate-700">{appointment.employeeName || 'Por asignar'}</strong>
                </p>
                {appointment.notes && <p className="mt-2 text-xs italic text-slate-500">“{appointment.notes}”</p>}
              </div>

              <StatusBadge status={appointment.status} />
            </div>

            {(isEmployee || isAdmin) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-50 pt-3">
                {!isBreak && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.44-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.85 9.85 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 6.99 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.88 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                    </svg>
                    Confirmar por WhatsApp
                  </a>
                )}

                {isBreak && appointment.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={busyId === appointment.id}
                    onClick={() => void changeStatus(appointment.id, 'cancelled')}
                    className="rounded-full border border-rose-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    Liberar bloqueo
                  </button>
                )}

                {!isBreak &&
                  appointment.status !== 'cancelled' &&
                  appointment.status !== 'completed' &&
                  EMPLOYEE_ACTIONS.map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      disabled={busyId === appointment.id}
                      onClick={() => {
                        if (action.status === 'cancelled') {
                          setAppointmentToCancel(appointment);
                        } else {
                          void changeStatus(appointment.id, action.status);
                        }
                      }}
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
                  onClick={() => setAppointmentToCancel(appointment)}
                  className="rounded-full border border-rose-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Cancelar cita
                </button>
              </div>
            )}
          </article>
        );
      })}

      <CancelAppointmentModal
        appointment={appointmentToCancel}
        isSubmitting={Boolean(appointmentToCancel && busyId === appointmentToCancel.id)}
        onClose={() => setAppointmentToCancel(null)}
        onConfirm={(target) => {
          void changeStatus(target.id, 'cancelled');
        }}
      />
    </div>
  );
}
