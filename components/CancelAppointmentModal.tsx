'use client';

/**
 * Modal de confirmación de seguridad previo a cancelar una cita.
 */
import { formatLongDate, formatTime } from '@/lib/format';
import type { Appointment } from '@/lib/types';

export interface CancelAppointmentModalProps {
  appointment: Appointment | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (appointment: Appointment) => void;
}

export default function CancelAppointmentModal({
  appointment,
  isSubmitting = false,
  onClose,
  onConfirm,
}: CancelAppointmentModalProps) {
  if (!appointment) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-rose-950/45 p-4 backdrop-blur-xs"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cancel-appointment-modal-title"
      aria-describedby="cancel-appointment-modal-desc"
    >
      <div
        className="w-full max-w-md animate-pop-in rounded-3xl border border-brand-100 bg-white p-6 shadow-chat"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600"
            aria-hidden="true"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div className="min-w-0 flex-1">
            <h3
              id="cancel-appointment-modal-title"
              className="font-display text-xl font-bold text-brand-800"
            >
              ¿Deseas cancelar esta cita?
            </h3>
            <p
              id="cancel-appointment-modal-desc"
              className="mt-2 text-sm leading-relaxed text-slate-600"
            >
              Ten en cuenta que esta acción no se puede deshacer y el turno quedará liberado para otros clientes.
            </p>
          </div>
        </div>

        {/* Resumen de la cita a cancelar */}
        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-xs text-slate-700">
          <p className="font-display text-sm font-semibold text-brand-800">{appointment.serviceName}</p>
          <p className="mt-0.5 capitalize text-slate-600">
            📅 {formatLongDate(appointment.date)} · 🕒 {formatTime(appointment.time)}
          </p>
          {appointment.userName && (
            <p className="mt-0.5 text-slate-500">👤 Cliente: {appointment.userName}</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="btn-secondary px-5 py-2.5 text-xs disabled:opacity-50"
          >
            Mantener cita
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(appointment)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200 active:scale-[0.98] disabled:opacity-60"
          >
            {isSubmitting && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            )}
            Sí, cancelar cita
          </button>
        </div>
      </div>
    </div>
  );
}
