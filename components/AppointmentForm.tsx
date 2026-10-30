'use client';

/**
 * Formulario de agendamiento de citas (cliente) con validación en tiempo real
 * del horario del salón, fechas especiales/festivos, jornada del profesional
 * y exclusión de citas o descansos bloqueados.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { todayISO } from '@/lib/format';
import {
  WEEK_DAYS,
  computeAvailableTimeSlots,
  normalizeEmployeeSchedule,
  type OccupiedSlotInterval,
} from '@/lib/schedule-utils';
import type { Appointment, BusinessInfo, Service, UserProfile } from '@/lib/types';

export default function AppointmentForm({
  services = [],
  onCreated,
  preselectedServiceId = null,
}: {
  services?: Service[];
  onCreated?: (appointment: Appointment) => void;
  preselectedServiceId?: string | null;
}) {
  const { getIdToken } = useAuth();
  const toast = useToast();

  const [serviceId, setServiceId] = useState(preselectedServiceId || '');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  const [occupiedIntervals, setOccupiedIntervals] = useState<OccupiedSlotInterval[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [appliedPreselection, setAppliedPreselection] = useState(preselectedServiceId);

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setEmployeesLoading(true);
        const token = await getIdToken().catch(() => null);
        const [empData, businessData] = await Promise.all([
          apiRequest<{ employees?: UserProfile[]; users?: UserProfile[] }>('/employees', {
            token,
          }),
          apiRequest<{ business: BusinessInfo }>('/business', { token }),
        ]);
        if (!active) return;
        setEmployees((empData.employees || empData.users || []).filter((e) => e.active !== false));
        setBusiness(businessData.business || null);
      } catch {
        if (!active) return;
        setEmployees([]);
      } finally {
        if (active) setEmployeesLoading(false);
      }
    };
    void loadInitial();
    return () => {
      active = false;
    };
  }, [getIdToken]);

  // Consulta las franjas ocupadas (citas y descansos) cuando cambian la fecha o el profesional
  useEffect(() => {
    if (!date) {
      setOccupiedIntervals([]);
      return undefined;
    }

    let active = true;
    const loadOccupied = async () => {
      setLoadingAvailability(true);
      try {
        const token = await getIdToken().catch(() => null);
        const query = new URLSearchParams({ date });
        if (employeeId) query.set('employeeId', employeeId);
        const res = await apiRequest<{ occupied: OccupiedSlotInterval[] }>(
          `/appointments/availability?${query.toString()}`,
          { token },
        );
        if (!active) return;
        setOccupiedIntervals(res.occupied || []);
      } catch {
        if (!active) return;
        setOccupiedIntervals([]);
      } finally {
        if (active) setLoadingAvailability(false);
      }
    };

    void loadOccupied();
    return () => {
      active = false;
    };
  }, [date, employeeId, getIdToken]);

  if (preselectedServiceId !== appliedPreselection) {
    setAppliedPreselection(preselectedServiceId);
    if (preselectedServiceId) setServiceId(preselectedServiceId);
  }

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId) || null,
    [services, serviceId],
  );

  const selectedEmployee = useMemo(
    () => employees.find((item) => (item.id || item.uid) === employeeId) || null,
    [employees, employeeId],
  );

  /** Resumen legible de los días laborables y horario del profesional seleccionado. */
  const employeeWorkSummary = useMemo(() => {
    if (!selectedEmployee) return null;
    const sched = normalizeEmployeeSchedule(selectedEmployee.schedule);
    const days = WEEK_DAYS.filter((d) => sched.workDays.includes(d.dayOfWeek))
      .map((d) => d.label)
      .join(', ');
    return `${days || 'Sin días configurados'} (${sched.startTime} a ${sched.endTime})`;
  }, [selectedEmployee]);

  /** Cálculo de ventana horaria y franjas disponibles para la fecha y profesional seleccionados. */
  const availability = useMemo(() => {
    if (!date) return null;
    return computeAvailableTimeSlots({
      dateIso: date,
      business,
      employee: selectedEmployee,
      serviceDurationMinutes: selectedService?.durationMinutes || 60,
      occupiedIntervals,
      stepMinutes: 30,
    });
  }, [date, business, selectedEmployee, selectedService?.durationMinutes, occupiedIntervals]);

  const isSelectedDateClosed = Boolean(date && availability && !availability.window.isOpen);
  const availableSlots = availability ? availability.slots : [];

  // Si la hora previamente elegida ya no está entre las disponibles, la limpiamos
  useEffect(() => {
    if (time && availability && !availability.slots.includes(time)) {
      setTime('');
    }
  }, [availability, time]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!serviceId || !date || !time || !employeeId) {
      setError('Selecciona el servicio, el profesional, la fecha y la hora.');
      return;
    }

    if (isSelectedDateClosed) {
      setError(
        availability?.window.reason ||
          'La fecha seleccionada no está disponible. Por favor elige otro día.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getIdToken();
      const data = await apiRequest<{ appointment: Appointment }>('/appointments', {
        method: 'POST',
        token,
        body: { serviceId, date, time, notes, employeeId },
      });

      const confirmationMsg = `Tu cita quedó registrada para el ${date} a las ${time}.`;
      setSuccess(`¡Listo! ${confirmationMsg}`);
      toast.success('¡Cita agendada con éxito!', confirmationMsg);
      setDate('');
      setTime('');
      setNotes('');
      setEmployeeId('');
      onCreated?.(data.appointment);
    } catch (requestError: unknown) {
      const errMsg = getErrorMessage(requestError, 'No fue posible agendar la cita.');
      setError(errMsg);
      toast.error('Error al agendar cita', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (services.length === 0) {
    return (
      <div className="card text-sm text-slate-500">
        No hay servicios disponibles en este momento. Escribe al salon para recibir informacion.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-display text-lg font-semibold text-brand-800">Agendar una cita</h2>

      <div>
        <label htmlFor="service" className="label-field">
          Servicio
        </label>
        <select
          id="service"
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          required
          className="input-field"
        >
          <option value="">Selecciona un servicio</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} — ${Number(service.price).toLocaleString('es-CO')} ({service.durationMinutes} min)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="employee" className="label-field">
          Profesional
        </label>
        <select
          id="employee"
          value={employeeId}
          onChange={(event) => {
            setEmployeeId(event.target.value);
            setError(null);
          }}
          required
          disabled={employeesLoading}
          className="input-field"
        >
          <option value="">Selecciona un profesional</option>
          {employees.map((employee) => (
            <option key={employee.id || employee.uid} value={employee.id || employee.uid}>
              {employee.displayName || 'Profesional'}
            </option>
          ))}
        </select>
        {employeesLoading && <p className="mt-1 text-xs text-slate-500">Cargando profesionales...</p>}
        {selectedEmployee && employeeWorkSummary && (
          <p className="mt-1.5 text-xs text-brand-700">
            🕒 Jornada de {selectedEmployee.displayName}: <strong>{employeeWorkSummary}</strong>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="label-field">
            Fecha
          </label>
          <input
            id="date"
            type="date"
            min={todayISO()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setTime('');
              setError(null);
            }}
            required
            className={`input-field ${
              isSelectedDateClosed ? 'border-amber-400 bg-amber-50/50 text-amber-900' : ''
            }`}
          />
        </div>

        <div>
          <label htmlFor="time" className="label-field">
            Hora disponible
          </label>
          <select
            id="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            disabled={!date || isSelectedDateClosed || loadingAvailability || availableSlots.length === 0}
            className="input-field disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {!date
                ? 'Elige primero una fecha'
                : loadingAvailability
                  ? 'Consultando disponibilidad...'
                  : isSelectedDateClosed
                    ? 'Fecha no disponible'
                    : availableSlots.length === 0
                      ? 'Sin cupos libres este día'
                      : 'Selecciona una hora'}
            </option>
            {availableSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Aviso cuando la fecha seleccionada está cerrada o es día libre del profesional */}
      {isSelectedDateClosed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="font-semibold">⚠ Fecha no habilitada para agendamiento</p>
          <p className="mt-0.5">{availability?.window.reason}</p>
          <p className="mt-1 text-amber-700">
            Por favor selecciona otra fecha habilitada para ver los horarios disponibles.
          </p>
        </div>
      )}

      {/* Información de jornada activa cuando la fecha sí está abierta */}
      {date && !isSelectedDateClosed && availability?.window.isOpen && (
        <p className="text-xs text-slate-500">
          Horario activo para el día seleccionado: <strong>{availability.window.openTime}</strong> a{' '}
          <strong>{availability.window.closeTime}</strong> ·{' '}
          {loadingAvailability
            ? 'Verificando turnos...'
            : `${availableSlots.length} horario${availableSlots.length === 1 ? '' : 's'} disponible${
                availableSlots.length === 1 ? '' : 's'
              }`}
        </p>
      )}

      <div>
        <label htmlFor="notes" className="label-field">
          Notas (opcional)
        </label>
        <textarea
          id="notes"
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Preferencias, alergias o indicaciones especiales..."
          className="input-field resize-none"
        />
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {success && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || isSelectedDateClosed || !time}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        )}
        Confirmar cita
      </button>
    </form>
  );
}
