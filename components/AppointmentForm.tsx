'use client';

/**
 * Formulario de agendamiento de citas (cliente).
 */
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { buildTimeSlots, todayISO } from '@/lib/format';
import type { Appointment, Service, UserProfile } from '@/lib/types';

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

  const [serviceId, setServiceId] = useState(preselectedServiceId || '');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [appliedPreselection, setAppliedPreselection] = useState(preselectedServiceId);

  const timeSlots = useMemo(() => buildTimeSlots('08:00', '18:00'), []);

  useEffect(() => {
    let active = true;
    const loadEmployees = async () => {
      try {
        setEmployeesLoading(true);
        const token = await getIdToken().catch(() => null);
        const data = await apiRequest<{ employees?: UserProfile[]; users?: UserProfile[] }>('/employees', {
          token,
        });
        if (!active) return;
        setEmployees(data.employees || data.users || []);
      } catch {
        if (!active) return;
        setEmployees([]);
      } finally {
        if (active) setEmployeesLoading(false);
      }
    };
    void loadEmployees();
    return () => {
      active = false;
    };
  }, [getIdToken]);

  // Si el servicio preseleccionado cambia, se refleja en el selector durante
  // el render (en vez de un efecto) para no provocar renders en cascada.
  if (preselectedServiceId !== appliedPreselection) {
    setAppliedPreselection(preselectedServiceId);
    if (preselectedServiceId) setServiceId(preselectedServiceId);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!serviceId || !date || !time || !employeeId) {
      setError('Selecciona el servicio, el profesional, la fecha y la hora.');
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

      setSuccess(`¡Listo! Tu cita quedo registrada para el ${date} a las ${time}.`);
      setDate('');
      setTime('');
      setNotes('');
      setEmployeeId('');
      onCreated?.(data.appointment);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible agendar la cita.'));
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
          onChange={(event) => setEmployeeId(event.target.value)}
          required
          disabled={employeesLoading}
          className="input-field"
        >
          <option value="">Selecciona un profesional</option>
          {employees.map((employee) => (
            <option key={employee.id || employee.uid} value={employee.id || employee.uid}>
              {employee.displayName || employee.name || 'Profesional'}
            </option>
          ))}
        </select>
        {employeesLoading && <p className="mt-1 text-xs text-slate-500">Cargando profesionales...</p>}
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
            onChange={(event) => setDate(event.target.value)}
            required
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="time" className="label-field">
            Hora
          </label>
          <select
            id="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            className="input-field"
          >
            <option value="">Selecciona una hora</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-60">
        {isSubmitting && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        )}
        Confirmar cita
      </button>
    </form>
  );
}
